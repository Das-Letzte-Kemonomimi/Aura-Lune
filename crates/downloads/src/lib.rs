//! Moduł pobierania legalnych źródeł audio (Etap 7 z AGENTS.md).
//!
//! ZGODNIE Z AGENTS.md I ZASADAMI BEZPIECZEŃSTWA:
//! - Pobieranie wyłącznie z legalnych, otwartych i bezpośrednich źródeł audio (Direct HTTP/HTTPS, Creative Commons, Archive.org, legalne podcasty/streamy).
//! - Żadnego obchodzenia zabezpieczeń DRM, paywalli ani restrykcji.
//! - Wszystkie ścieżki docelowe są normalizowane i chronione przed path traversal (../).
//! - Pobieranie odbywa się do pliku tymczasowego (`.auralune_tmp_*`) i dopiero po pomyślnej weryfikacji następuje atomowe przeniesienie (`fs::rename`).
//! - Opcjonalna weryfikacja sumy kontrolnej SHA-256 w locie.

use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use thiserror::Error;
use tracing::info;

#[derive(Debug, Error)]
pub enum DownloadError {
    #[error("Błąd sieciowy HTTP: {0}")]
    Network(#[from] reqwest::Error),
    #[error("Błąd wejścia/wyjścia dysku: {0}")]
    Io(#[from] std::io::Error),
    #[error("Niezgodność sumy kontrolnej SHA-256 (oczekiwano: {expected}, otrzymano: {actual})")]
    ChecksumMismatch { expected: String, actual: String },
    #[error("Próba niebezpiecznego dostępu do ścieżki (path traversal): {0}")]
    PathTraversal(String),
    #[error("Brak wspieranego providera dla podanego adresu URL: {0}")]
    UnsupportedUrl(String),
    #[error("Pobieranie zostało anulowane przez użytkowniczkę")]
    Cancelled,
    #[error("Błąd zadania pobierania: {0}")]
    General(String),
}

/// Stan zadania pobierania.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum DownloadJobState {
    Pending,
    Downloading,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

/// Metadane zadania pobierania w kolejce.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DownloadJob {
    pub id: String,
    pub provider: String,
    pub remote_url: String,
    pub destination_path: String,
    pub state: DownloadJobState,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub expected_sha256: Option<String>,
    pub actual_sha256: Option<String>,
    pub error: Option<String>,
    pub created_at: u64,
    pub completed_at: Option<u64>,
}

/// Kontrakt dla dostawców pobierania audio.
#[async_trait::async_trait]
pub trait DownloadProvider: Send + Sync {
    fn name(&self) -> &'static str;
    fn supports_url(&self, url: &str) -> bool;
    async fn download(
        &self,
        url: &str,
        destination_path: &Path,
        expected_sha256: Option<&str>,
        cancel_flag: Arc<AtomicBool>,
        progress_callback: Option<Box<dyn Fn(u64, Option<u64>) + Send + Sync>>,
    ) -> Result<PathBuf, DownloadError>;
}

/// Dostawca bezpośredniego pobierania przez protokół HTTP/HTTPS.
pub struct HttpDownloadProvider {
    client: reqwest::Client,
}

impl Default for HttpDownloadProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl HttpDownloadProvider {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .user_agent(format!(
                "Auralune/{} ( legal-download-client )",
                env!("CARGO_PKG_VERSION")
            ))
            .timeout(std::time::Duration::from_secs(60))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());

        Self { client }
    }
}

#[async_trait::async_trait]
impl DownloadProvider for HttpDownloadProvider {
    fn name(&self) -> &'static str {
        "DirectHttp"
    }

    fn supports_url(&self, url: &str) -> bool {
        url.starts_with("http://") || url.starts_with("https://")
    }

    async fn download(
        &self,
        url: &str,
        destination_path: &Path,
        expected_sha256: Option<&str>,
        cancel_flag: Arc<AtomicBool>,
        progress_callback: Option<Box<dyn Fn(u64, Option<u64>) + Send + Sync>>,
    ) -> Result<PathBuf, DownloadError> {
        // 1. Walidacja bezpieczeństwa ścieżki docelowej przed path traversal
        validate_safe_destination_path(destination_path)?;

        // Upewnij się, że katalog docelowy istnieje
        if let Some(parent) = destination_path.parent() {
            fs::create_dir_all(parent)?;
        }

        // 2. Przygotowanie pliku tymczasowego obok pliku docelowego
        let file_stem = destination_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("download");
        let temp_filename = format!(".auralune_tmp_{}_{}", std::process::id(), file_stem);
        let temp_path = destination_path
            .parent()
            .map(|p| p.join(&temp_filename))
            .unwrap_or_else(|| PathBuf::from(&temp_filename));

        info!(
            "Rozpoczynanie pobierania {} -> plik tymczasowy: {:?}",
            url, temp_path
        );

        // 3. Rozpoczęcie pobierania strumieniowego
        let res = self.client.get(url).send().await?;
        if !res.status().is_success() {
            return Err(DownloadError::General(format!(
                "Serwer zwrócił błąd HTTP: {}",
                res.status()
            )));
        }

        let total_bytes = res.content_length();
        let mut file = File::create(&temp_path)?;
        let mut hasher = Sha256::new();
        let mut downloaded_bytes: u64 = 0;

        let mut stream = res;
        while let Some(chunk) = stream.chunk().await? {
            if cancel_flag.load(Ordering::Relaxed) {
                drop(file);
                let _ = fs::remove_file(&temp_path);
                return Err(DownloadError::Cancelled);
            }

            file.write_all(&chunk)?;
            hasher.update(&chunk);
            downloaded_bytes += chunk.len() as u64;

            if let Some(ref cb) = progress_callback {
                cb(downloaded_bytes, total_bytes);
            }
        }

        file.flush()?;
        drop(file);

        // 4. Weryfikacja sumy kontrolnej SHA-256
        let calculated_sha256 = hex::encode(hasher.finalize());
        if let Some(expected) = expected_sha256 {
            let clean_expected = expected.trim().to_lowercase();
            if clean_expected != calculated_sha256.to_lowercase() {
                let _ = fs::remove_file(&temp_path);
                return Err(DownloadError::ChecksumMismatch {
                    expected: clean_expected,
                    actual: calculated_sha256,
                });
            }
            info!(
                "Suma kontrolna SHA-256 zweryfikowana pomyślnie ({})",
                calculated_sha256
            );
        }

        // 5. Atomowe przeniesienie pliku tymczasowego na ścieżkę docelową
        fs::rename(&temp_path, destination_path)?;
        info!(
            "Pobieranie ukończone sukcesem! Zapisano atomowo w: {:?}",
            destination_path
        );

        Ok(destination_path.to_path_buf())
    }
}

/// Menedżer kolejki pobierania audio.
#[derive(Clone)]
pub struct DownloadManager {
    provider: Arc<HttpDownloadProvider>,
    jobs: Arc<Mutex<Vec<DownloadJob>>>,
    active_cancel_flags: Arc<Mutex<std::collections::HashMap<String, Arc<AtomicBool>>>>,
}

impl Default for DownloadManager {
    fn default() -> Self {
        Self::new()
    }
}

impl DownloadManager {
    pub fn new() -> Self {
        Self {
            provider: Arc::new(HttpDownloadProvider::new()),
            jobs: Arc::new(Mutex::new(Vec::new())),
            active_cancel_flags: Arc::new(Mutex::new(std::collections::HashMap::new())),
        }
    }

    /// Dodaje nowe zadanie pobierania do kolejki i rozpoczyna pobieranie asynchronicznie.
    pub async fn add_download_job(
        &self,
        remote_url: String,
        destination_path: String,
        expected_sha256: Option<String>,
    ) -> Result<String, DownloadError> {
        let job_id = format!(
            "dl_{}_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis(),
            remote_url.len()
        );

        let now_ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let job = DownloadJob {
            id: job_id.clone(),
            provider: self.provider.name().to_string(),
            remote_url: remote_url.clone(),
            destination_path: destination_path.clone(),
            state: DownloadJobState::Pending,
            downloaded_bytes: 0,
            total_bytes: None,
            expected_sha256: expected_sha256.clone(),
            actual_sha256: None,
            error: None,
            created_at: now_ts,
            completed_at: None,
        };

        {
            let mut list = self.jobs.lock().unwrap();
            list.push(job);
        }

        let cancel_flag = Arc::new(AtomicBool::new(false));
        {
            let mut flags = self.active_cancel_flags.lock().unwrap();
            flags.insert(job_id.clone(), cancel_flag.clone());
        }

        let provider = self.provider.clone();
        let jobs_ref = self.jobs.clone();
        let flags_ref = self.active_cancel_flags.clone();
        let target_job_id = job_id.clone();

        tokio::spawn(async move {
            {
                let mut list = jobs_ref.lock().unwrap();
                if let Some(j) = list.iter_mut().find(|x| x.id == target_job_id) {
                    j.state = DownloadJobState::Downloading;
                }
            }

            let dest_path = PathBuf::from(&destination_path);
            let jobs_progress = jobs_ref.clone();
            let progress_id = target_job_id.clone();

            let progress_cb = Box::new(move |downloaded: u64, total: Option<u64>| {
                let mut list = jobs_progress.lock().unwrap();
                if let Some(j) = list.iter_mut().find(|x| x.id == progress_id) {
                    j.downloaded_bytes = downloaded;
                    j.total_bytes = total;
                }
            });

            let res = provider
                .download(
                    &remote_url,
                    &dest_path,
                    expected_sha256.as_deref(),
                    cancel_flag,
                    Some(progress_cb),
                )
                .await;

            let mut list = jobs_ref.lock().unwrap();
            if let Some(j) = list.iter_mut().find(|x| x.id == target_job_id) {
                match res {
                    Ok(_) => {
                        j.state = DownloadJobState::Completed;
                        j.completed_at = Some(
                            std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_secs(),
                        );
                    }
                    Err(DownloadError::Cancelled) => {
                        j.state = DownloadJobState::Cancelled;
                    }
                    Err(e) => {
                        j.state = DownloadJobState::Failed;
                        j.error = Some(e.to_string());
                    }
                }
            }

            let mut flags = flags_ref.lock().unwrap();
            flags.remove(&target_job_id);
        });

        Ok(job_id)
    }

    /// Anuluje aktywne zadanie pobierania.
    pub fn cancel_download(&self, job_id: &str) -> bool {
        let flags = self.active_cancel_flags.lock().unwrap();
        if let Some(flag) = flags.get(job_id) {
            flag.store(true, Ordering::Relaxed);
            true
        } else {
            false
        }
    }

    /// Zwraca listę wszystkich zadań pobierania.
    pub fn list_jobs(&self) -> Vec<DownloadJob> {
        self.jobs.lock().unwrap().clone()
    }
}

/// Zapewnia ochronę przed path traversal (ścieżka nie może zawierać `..` ani odwoływać się do katalogów systemowych).
pub fn validate_safe_destination_path(path: &Path) -> Result<(), DownloadError> {
    for comp in path.components() {
        if let std::path::Component::ParentDir = comp {
            return Err(DownloadError::PathTraversal(format!(
                "Wykryto niedozwolone odwołanie nadrzędne ('..') w ścieżce: {:?}",
                path
            )));
        }
    }

    let path_str = path.to_string_lossy();
    if path_str.starts_with("/etc") || path_str.starts_with("/root") || path_str.starts_with("/bin")
    {
        return Err(DownloadError::PathTraversal(format!(
            "Zapis do katalogów systemowych jest zabroniony: {:?}",
            path
        )));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_path_traversal_detection() {
        let unsafe_path = Path::new("/home/mimi/Music/../../etc/passwd");
        assert!(validate_safe_destination_path(unsafe_path).is_err());

        let system_path = Path::new("/etc/auralune/music.flac");
        assert!(validate_safe_destination_path(system_path).is_err());

        let safe_path = Path::new("/home/mimi/Music/Downloads/anime_track.flac");
        assert!(validate_safe_destination_path(safe_path).is_ok());
    }

    #[test]
    fn test_download_job_creation() {
        let mgr = DownloadManager::new();
        assert_eq!(mgr.list_jobs().len(), 0);
    }
}
