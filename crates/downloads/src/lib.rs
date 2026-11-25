//! Moduł pobierania legalnych źródeł audio (Etap 7 z AGENTS.md).
//!
//! ZGODNIE Z AGENTS.md I ZASADAMI BEZPIECZEŃSTWA:
//! - Pobieranie wyłącznie z legalnych, otwartych i bezpośrednich źródeł audio (Direct HTTP/HTTPS, Creative Commons, Archive.org, legalne podcasty/streamy).
//! - Żadnego obchodzenia zabezpieczeń DRM, paywalli ani restrykcji.
//! - Wszystkie ścieżki docelowe są normalizowane i chronione przed path traversal (../).
//! - Pobieranie odbywa się do pliku tymczasowego (`.auralune_tmp_*`) i dopiero po pomyślnej weryfikacji następuje atomowe przeniesienie (`fs::rename`).
//! - Opcjonalna weryfikacja sumy kontrolnej SHA-256 w locie.

use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use thiserror::Error;
use tokio::io::AsyncWriteExt;
use tracing::info;

#[derive(Debug, Error)]
pub enum DownloadError {
    #[error("HTTP network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("Disk I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("SHA-256 checksum mismatch (expected: {expected}, got: {actual})")]
    ChecksumMismatch { expected: String, actual: String },
    #[error("Unsafe path access attempt (path traversal): {0}")]
    PathTraversal(String),
    #[error("Brak wspieranego providera dla podanego adresu URL: {0}")]
    UnsupportedUrl(String),
    #[error("Download was cancelled by the user")]
    Cancelled,
    #[error("Download task error: {0}")]
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
            .connect_timeout(std::time::Duration::from_secs(30))
            .timeout(std::time::Duration::from_secs(3600))
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
            tokio::fs::create_dir_all(parent).await?;
        }

        // 2. Przygotowanie pliku tymczasowego obok pliku docelowego
        let file_stem = destination_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("download");
        // Licznik w nazwie: równoległe pobierania do tej samej nazwy nie dzielą pliku tymczasowego.
        let temp_filename = format!(
            ".auralune_tmp_{}_{}_{}",
            std::process::id(),
            next_sequence(),
            file_stem
        );
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
        let mut file = tokio::fs::File::create(&temp_path).await?;
        // Usuwa plik tymczasowy przy każdym wcześniejszym wyjściu (błąd sieci/dysku, anulowanie,
        // niezgodna suma kontrolna). Rozbrajany dopiero po atomowym przeniesieniu.
        let mut temp_guard = TempFileGuard::new(temp_path.clone());
        let mut hasher = Sha256::new();
        let mut downloaded_bytes: u64 = 0;

        let mut stream = res;
        let mut last_data = std::time::Instant::now();
        loop {
            if cancel_flag.load(Ordering::Relaxed) {
                return Err(DownloadError::Cancelled);
            }
            // Krótki limit na porcję: anulowanie działa także przy zawieszonym połączeniu.
            let chunk = match tokio::time::timeout(CANCEL_POLL_INTERVAL, stream.chunk()).await {
                Err(_) => {
                    if last_data.elapsed() > STALL_TIMEOUT {
                        return Err(DownloadError::General(format!(
                            "Brak danych od {} s — przerwano pobieranie",
                            STALL_TIMEOUT.as_secs()
                        )));
                    }
                    continue;
                }
                Ok(chunk) => match chunk? {
                    Some(chunk) => chunk,
                    None => break,
                },
            };
            last_data = std::time::Instant::now();

            file.write_all(&chunk).await?;
            hasher.update(&chunk);
            downloaded_bytes += chunk.len() as u64;

            if let Some(ref cb) = progress_callback {
                cb(downloaded_bytes, total_bytes);
            }
        }

        file.flush().await?;
        file.sync_all().await?;
        drop(file);

        // 4. Weryfikacja sumy kontrolnej SHA-256
        let calculated_sha256 = hex::encode(hasher.finalize());
        if let Some(expected) = expected_sha256 {
            let clean_expected = expected.trim().to_lowercase();
            if clean_expected != calculated_sha256.to_lowercase() {
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
        tokio::fs::rename(&temp_path, destination_path).await?;
        temp_guard.disarm();
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
            next_sequence()
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
            let mut list = self
                .jobs
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner);
            list.push(job);
        }

        let cancel_flag = Arc::new(AtomicBool::new(false));
        {
            let mut flags = self
                .active_cancel_flags
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner);
            flags.insert(job_id.clone(), cancel_flag.clone());
        }

        let provider = self.provider.clone();
        let jobs_ref = self.jobs.clone();
        let flags_ref = self.active_cancel_flags.clone();
        let target_job_id = job_id.clone();

        tokio::spawn(async move {
            {
                let mut list = jobs_ref
                    .lock()
                    .unwrap_or_else(std::sync::PoisonError::into_inner);
                if let Some(j) = list.iter_mut().find(|x| x.id == target_job_id) {
                    j.state = DownloadJobState::Downloading;
                }
            }

            let dest_path = PathBuf::from(&destination_path);
            let jobs_progress = jobs_ref.clone();
            let progress_id = target_job_id.clone();

            let progress_cb = Box::new(move |downloaded: u64, total: Option<u64>| {
                let mut list = jobs_progress
                    .lock()
                    .unwrap_or_else(std::sync::PoisonError::into_inner);
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

            let mut list = jobs_ref
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner);
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

            let mut flags = flags_ref
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner);
            flags.remove(&target_job_id);
        });

        Ok(job_id)
    }

    /// Anuluje aktywne zadanie pobierania.
    pub fn cancel_download(&self, job_id: &str) -> bool {
        let flags = self
            .active_cancel_flags
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        if let Some(flag) = flags.get(job_id) {
            flag.store(true, Ordering::Relaxed);
            true
        } else {
            false
        }
    }

    /// Zwraca listę wszystkich zadań pobierania.
    pub fn list_jobs(&self) -> Vec<DownloadJob> {
        self.jobs
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .clone()
    }
}

/// Sprawdza cel pobierania wg wspólnych zasad `domain::paths::check_write_target`:
/// ścieżka absolutna, bez `..`, poza katalogami systemowymi i ukrytymi wpisami `$HOME`
/// (z wyjątkiem katalogów danych/cache aplikacji, gdzie trafiają modele AI).
pub fn validate_safe_destination_path(path: &Path) -> Result<(), DownloadError> {
    let home = std::env::var_os("HOME").map(std::path::PathBuf::from);
    let app_roots: Vec<std::path::PathBuf> = [
        ("XDG_DATA_HOME", ".local/share"),
        ("XDG_CACHE_HOME", ".cache"),
    ]
    .iter()
    .filter_map(|(var, fallback)| {
        std::env::var_os(var)
            .map(std::path::PathBuf::from)
            .or_else(|| home.as_ref().map(|h| h.join(fallback)))
    })
    // Modele AI i cache stemów leżą w `<base>/auralune/...` (audio_engine::model_manager),
    // a dane Tauri w `<base>/com.auralune.player` — oba katalogi należą do aplikacji.
    .flat_map(|base| [base.join("auralune"), base.join("com.auralune.player")])
    .collect();
    let roots: Vec<&Path> = app_roots.iter().map(|p| p.as_path()).collect();
    domain::paths::check_write_target(path, home.as_deref(), &roots)
        .map_err(|e| DownloadError::PathTraversal(e.to_string()))
}

/// Usuwa wskazany plik przy zniszczeniu, chyba że wywołano [`TempFileGuard::disarm`].
struct TempFileGuard {
    path: PathBuf,
    armed: bool,
}

impl TempFileGuard {
    fn new(path: PathBuf) -> Self {
        Self { path, armed: true }
    }

    fn disarm(&mut self) {
        self.armed = false;
    }
}

impl Drop for TempFileGuard {
    fn drop(&mut self) {
        if self.armed {
            let _ = fs::remove_file(&self.path);
        }
    }
}

/// Co ile sprawdzana jest flaga anulowania, gdy serwer nie przysyła danych.
const CANCEL_POLL_INTERVAL: std::time::Duration = std::time::Duration::from_millis(500);
/// Po takim czasie bez żadnych danych pobieranie jest przerywane.
const STALL_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(120);

/// Rosnący licznik procesu — unikalne identyfikatory zadań i nazwy plików tymczasowych.
fn next_sequence() -> u64 {
    static SEQUENCE: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    SEQUENCE.fetch_add(1, Ordering::Relaxed)
}
