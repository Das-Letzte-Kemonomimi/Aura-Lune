use lofty::file::{AudioFile, TaggedFileExt};
use lofty::probe::Probe;
use lofty::tag::Accessor;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use storage::{Database, TrackRecord};
use thiserror::Error;
use tracing::{debug, info, warn};
use walkdir::WalkDir;

#[derive(Debug, Error)]
pub enum LibraryError {
    #[error("Błąd bazy danych: {0}")]
    Storage(#[from] storage::StorageError),
    #[error("Błąd I/O: {0}")]
    Io(#[from] std::io::Error),
    #[error("Błąd odczytu pliku lofty: {0}")]
    Lofty(#[from] lofty::error::FileParseError),
}

/// Podsumowanie przebiegu skanowania.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ScanSummary {
    pub total_files_found: usize,
    pub new_or_updated_tracks: usize,
    pub skipped_unchanged: usize,
    pub errors: usize,
}

/// Skaner biblioteki z obsługą przyrostowego indeksowania i wykrywania okładek.
pub struct LibraryScanner {
    cache_dir: PathBuf,
}

impl LibraryScanner {
    pub fn new(cache_dir: impl AsRef<Path>) -> Self {
        let covers_dir = cache_dir.as_ref().join("covers");
        let _ = fs::create_dir_all(&covers_dir);
        Self {
            cache_dir: cache_dir.as_ref().to_path_buf(),
        }
    }

    /// Sprawdza, czy rozszerzenie pliku wskazuje na obsługiwany format audio.
    pub fn is_supported_audio_extension(path: &Path) -> bool {
        match path
            .extension()
            .and_then(|s| s.to_str())
            .map(|s| s.to_lowercase())
        {
            Some(ext) => matches!(
                ext.as_str(),
                "flac" | "mp3" | "ogg" | "opus" | "wav" | "m4a" | "aac" | "alac" | "aiff"
            ),
            None => false,
        }
    }

    /// Przeprowadza rekursywne, przyrostowe skanowanie wskazanego katalogu.
    pub async fn scan_directory(
        &self,
        dir: impl AsRef<Path>,
        db: &Database,
    ) -> Result<ScanSummary, LibraryError> {
        let root = dir.as_ref();
        info!("Rozpoczynanie przyrostowego skanowania: {}", root.display());

        let mut summary = ScanSummary::default();
        let mut active_paths = Vec::new();

        for entry in WalkDir::new(root)
            .follow_links(true)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if !path.is_file() || !Self::is_supported_audio_extension(path) {
                continue;
            }

            summary.total_files_found += 1;
            let path_str = match path.canonicalize() {
                Ok(p) => p.display().to_string(),
                Err(_) => path.display().to_string(),
            };
            active_paths.push(path_str.clone());

            let metadata = match entry.metadata() {
                Ok(m) => m,
                Err(e) => {
                    warn!("Błąd odczytu metadanych pliku {}: {:?}", path.display(), e);
                    summary.errors += 1;
                    continue;
                }
            };

            let file_size = metadata.len() as i64;
            let modified_time = metadata
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_secs() as i64)
                .unwrap_or(0);

            // PRZYROSTOWE SPRAWDZENIE:
            // Czy plik już istnieje i nie zmienił się rozmiar ani czas modyfikacji?
            if let Ok(Some(existing)) = db.get_track_by_path(&path_str).await {
                if existing.file_size == file_size && existing.modified_time == modified_time {
                    summary.skipped_unchanged += 1;
                    continue;
                }
            }

            // Pełna ekstrakcja tagów przez lofty
            match self
                .extract_and_save_track(path, &path_str, file_size, modified_time, db)
                .await
            {
                Ok(_) => {
                    summary.new_or_updated_tracks += 1;
                    debug!("Zindeksowano: {}", path.display());
                }
                Err(err) => {
                    warn!("Błąd odczytu tagów z {}: {:?}", path.display(), err);
                    summary.errors += 1;
                }
            }
        }

        info!(
            "Zakończono skanowanie. Znaleziono: {}, Zindeksowano: {}, Pominięto (bez zmian): {}, Błędy: {}",
            summary.total_files_found,
            summary.new_or_updated_tracks,
            summary.skipped_unchanged,
            summary.errors
        );

        Ok(summary)
    }

    /// Wyciąga tagi, okładkę i zapisuje encje do bazy.
    async fn extract_and_save_track(
        &self,
        file_path: &Path,
        canonical_path: &str,
        file_size: i64,
        modified_time: i64,
        db: &Database,
    ) -> Result<(), LibraryError> {
        let probe = Probe::open(file_path)?;
        let tagged_file = probe.read()?;

        let properties = tagged_file.properties();
        let duration_ms = properties.duration().as_millis() as i64;
        let sample_rate = properties.sample_rate().unwrap_or(44100) as i64;
        let channels = properties.channels().unwrap_or(2) as i64;
        let bit_depth = properties.bit_depth().map(|b| b as i64);

        let format = file_path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("AUDIO")
            .to_uppercase();

        let tag = tagged_file
            .primary_tag()
            .or_else(|| tagged_file.first_tag());

        let title = tag
            .as_ref()
            .and_then(|t| t.title())
            .map(|s| s.to_string())
            .unwrap_or_else(|| {
                file_path
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("Nieznany utwór")
                    .to_string()
            });

        let artist = tag
            .as_ref()
            .and_then(|t| t.artist())
            .map(|s| s.to_string())
            .unwrap_or_else(|| "Nieznany wykonawca".to_string());

        let album_name = tag
            .as_ref()
            .and_then(|t| t.album())
            .map(|s| s.to_string())
            .unwrap_or_else(|| "Nieznany album".to_string());

        let track_no = tag.as_ref().and_then(|t| t.track()).map(|t| t as i64);
        let disc_no = tag.as_ref().and_then(|t| t.disk()).map(|d| d as i64);
        let year = tag.as_ref().and_then(|t| t.date()).map(|d| d.year as i64);

        // Wykrywanie okładki: 1. Embedded, 2. Pliki w folderze
        let cover_path = self.resolve_cover_art(file_path, tag);

        // Zapis w bazie SQLite:
        let _artist_id = db.upsert_artist(&artist).await?;
        let album_id = db
            .upsert_album(&album_name, &artist, year, cover_path.as_deref())
            .await?;

        let record = TrackRecord {
            id: 0,
            path: canonical_path.to_string(),
            title,
            artist,
            album_artist: Some(album_name),
            album_id: Some(album_id),
            disc_no,
            track_no,
            duration_ms,
            format,
            sample_rate,
            channels,
            bit_depth,
            file_size,
            modified_time,
        };

        db.upsert_track(&record).await?;
        Ok(())
    }

    /// Szuka okładki w tagach lub w katalogu pliku.
    fn resolve_cover_art(&self, file_path: &Path, tag: Option<&lofty::tag::Tag>) -> Option<String> {
        // 1. Sprawdzenie osadzonej grafiki w tagach
        if let Some(tag) = tag {
            if let Some(pic) = tag.pictures().first() {
                let data = pic.data();
                let mut hasher = Sha256::new();
                hasher.update(data);
                let hash_str = hex::encode(hasher.finalize());
                let target_path = self
                    .cache_dir
                    .join("covers")
                    .join(format!("{}.jpg", hash_str));

                if !target_path.exists() {
                    let _ = fs::write(&target_path, data);
                }
                return Some(target_path.display().to_string());
            }
        }

        // 2. Poszukiwanie pliku graficznego w tym samym folderze
        if let Some(parent) = file_path.parent() {
            let candidates = [
                "cover.jpg",
                "cover.png",
                "folder.jpg",
                "folder.png",
                "front.jpg",
                "front.png",
                "Cover.jpg",
                "Folder.jpg",
            ];
            for cand in candidates {
                let cand_path = parent.join(cand);
                if cand_path.is_file() {
                    return Some(cand_path.display().to_string());
                }
            }
        }

        None
    }
}
