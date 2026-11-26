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
    #[error("Database error: {0}")]
    Storage(#[from] storage::StorageError),
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("lofty file read error: {0}")]
    Lofty(#[from] lofty::error::FileParseError),
    #[error("Interrupted file read task: {0}")]
    Task(#[from] tokio::task::JoinError),
}

/// Summary of a scan run.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ScanSummary {
    pub total_files_found: usize,
    pub new_or_updated_tracks: usize,
    pub skipped_unchanged: usize,
    pub errors: usize,
    /// Number of records removed from the database because their files disappeared from disk.
    pub removed_stale: usize,
}

/// Result of the blocking read of one file (before the database write).
struct ParsedTrack {
    record: TrackRecord,
    album_name: String,
    album_artist: String,
    year: Option<i64>,
    cover_path: Option<String>,
    release_mbid: Option<String>,
}

/// An audio file found while walking a directory.
struct ScannedFile {
    path: PathBuf,
    path_str: String,
    file_size: i64,
    modified_time: i64,
}

#[derive(Default)]
struct WalkResult {
    files: Vec<ScannedFile>,
    walk_errors: usize,
    /// Files whose metadata could not be read: they still exist, so they must not
    /// be removed from the database as stale.
    unreadable_paths: Vec<String>,
}

const COVER_STEMS: &[&str] = &["cover", "folder", "front", "album", "artwork"];
const COVER_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "webp"];

fn home_dir_canonical() -> Option<PathBuf> {
    std::env::var_os("HOME").map(|h| {
        let p = PathBuf::from(h);
        p.canonicalize().unwrap_or(p)
    })
}

fn find_cover_in_dir(dir: &Path) -> Option<PathBuf> {
    let entries = fs::read_dir(dir).ok()?;
    let mut best: Option<(usize, usize, String, PathBuf)> = None;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(stem) = path.file_stem().and_then(|s| s.to_str()) else {
            continue;
        };
        let Some(ext) = path.extension().and_then(|s| s.to_str()) else {
            continue;
        };
        let stem_lower = stem.to_ascii_lowercase();
        let ext_lower = ext.to_ascii_lowercase();
        let Some(stem_idx) = COVER_STEMS.iter().position(|s| *s == stem_lower) else {
            continue;
        };
        let Some(ext_idx) = COVER_EXTENSIONS.iter().position(|e| *e == ext_lower) else {
            continue;
        };
        let name_lower = path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();

        let key = (stem_idx, ext_idx, name_lower);
        let replace = match &best {
            None => true,
            Some((bi, be, bn, _)) => key < (*bi, *be, bn.clone()),
        };
        if replace {
            best = Some((key.0, key.1, key.2, path));
        }
    }

    best.map(|(_, _, _, path)| path)
}

/// Finds a local cover image for a track directory (case-insensitive stems/extensions).
///
/// Always checks `track_dir` first. When `stop_at` is `Some(root)` (directory scan),
/// walks upward through ancestor directories up to and including `root`.
/// When `stop_at` is `None` (single-file lookup), falls back one parent level up
/// (e.g. an album or collection root above `Disc 1/`), excluding `/` and `$HOME`.
pub fn find_folder_cover(track_dir: &Path, stop_at: Option<&Path>) -> Option<PathBuf> {
    if let Some(hit) = find_cover_in_dir(track_dir) {
        return Some(hit);
    }

    if let Some(root) = stop_at {
        let canon_root = root.canonicalize().unwrap_or_else(|_| root.to_path_buf());
        let mut current = track_dir
            .canonicalize()
            .unwrap_or_else(|_| track_dir.to_path_buf());

        while current != canon_root && current.starts_with(&canon_root) {
            let Some(parent) = current.parent() else {
                break;
            };
            if !parent.starts_with(&canon_root) {
                break;
            }
            if let Some(hit) = find_cover_in_dir(parent) {
                return Some(hit);
            }
            current = parent.to_path_buf();
        }
        return None;
    }

    let parent = track_dir.parent()?;
    parent.parent()?;
    let canon_parent = parent
        .canonicalize()
        .unwrap_or_else(|_| parent.to_path_buf());
    if home_dir_canonical().as_ref() == Some(&canon_parent) {
        return None;
    }
    find_cover_in_dir(parent)
}

/// Library scanner with incremental indexing and cover detection.
#[derive(Clone)]
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

    /// Checks whether the file extension denotes a supported audio format.
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

    /// Runs a recursive, incremental scan of the given directory.
    pub async fn scan_directory(
        &self,
        dir: impl AsRef<Path>,
        db: &Database,
    ) -> Result<ScanSummary, LibraryError> {
        let root = dir.as_ref();
        info!("Starting incremental scan: {}", root.display());

        let mut summary = ScanSummary::default();
        let mut active_paths = Vec::new();
        let mut walk_errors = 0usize;

        // Walking the directory, canonicalize and stat are blocking, so they run off the Tokio threads.
        let walk_root = root.to_path_buf();
        let walk = tokio::task::spawn_blocking(move || Self::walk_audio_files(&walk_root)).await?;
        walk_errors += walk.walk_errors;
        summary.total_files_found += walk.unreadable_paths.len();
        summary.errors += walk.unreadable_paths.len();
        active_paths.extend(walk.unreadable_paths);

        // Bulk lookups instead of querying the database per file.
        let known = db.track_file_stamps().await.unwrap_or_default();
        let missing_covers = db.track_album_ids_without_cover().await.unwrap_or_default();
        let mut checked_cover_dirs = std::collections::HashSet::new();
        let mut recovered_albums = std::collections::HashSet::new();

        for file in walk.files {
            summary.total_files_found += 1;
            active_paths.push(file.path_str.clone());
            let path = file.path.as_path();
            let path_str = file.path_str;
            let (file_size, modified_time) = (file.file_size, file.modified_time);

            // INCREMENTAL CHECK:
            // Does the file already exist with unchanged size and modification time?
            if known.get(&path_str) == Some(&(file_size, modified_time)) {
                summary.skipped_unchanged += 1;
                if let (Some(&album_id), Some(parent)) =
                    (missing_covers.get(&path_str), path.parent())
                {
                    if !recovered_albums.contains(&album_id)
                        && checked_cover_dirs.insert((album_id, parent.to_path_buf()))
                    {
                        if let Some(cover) = find_folder_cover(parent, Some(root)) {
                            let cover_str = cover.display().to_string();
                            if db
                                .update_album_cover(album_id, &cover_str, None)
                                .await
                                .is_ok()
                            {
                                recovered_albums.insert(album_id);
                            }
                        }
                    }
                }
                continue;
            }

            // Full tag extraction via lofty
            match self
                .extract_and_save_track(path, &path_str, file_size, modified_time, Some(root), db)
                .await
            {
                Ok(_) => {
                    summary.new_or_updated_tracks += 1;
                    debug!("Indexed: {}", path.display());
                }
                Err(err) => {
                    warn!("Failed to read tags from {}: {:?}", path.display(), err);
                    summary.errors += 1;
                }
            }
        }
        summary.errors += walk_errors;

        // Remove files that disappeared from disk from the database. Only after a complete walk
        // of an existing directory: an unreachable drive or permission errors must not wipe the library.
        if walk_errors == 0 && root.is_dir() {
            let root_str = match root.canonicalize() {
                Ok(p) => p.display().to_string(),
                Err(_) => root.display().to_string(),
            };
            let removed = db.delete_stale_tracks(&root_str, &active_paths).await?;
            summary.removed_stale = removed;
            if removed > 0 {
                info!("Removed {} missing tracks from the database", removed);
            }
        }

        info!(
            "Scan finished. Found: {}, Indexed: {}, Skipped (unchanged): {}, Errors: {}",
            summary.total_files_found,
            summary.new_or_updated_tracks,
            summary.skipped_unchanged,
            summary.errors
        );

        Ok(summary)
    }

    /// Scans a list of paths (files and/or directories), e.g. from drag and drop or the file picker.
    pub async fn scan_paths(
        &self,
        paths: &[impl AsRef<Path>],
        db: &Database,
    ) -> Result<ScanSummary, LibraryError> {
        let mut summary = ScanSummary::default();
        for p in paths {
            let path = p.as_ref();
            if path.is_dir() {
                let s = self.scan_directory(path, db).await?;
                summary.total_files_found += s.total_files_found;
                summary.new_or_updated_tracks += s.new_or_updated_tracks;
                summary.skipped_unchanged += s.skipped_unchanged;
                summary.errors += s.errors;
                summary.removed_stale += s.removed_stale;
            } else if path.is_file() {
                if !Self::is_supported_audio_extension(path) {
                    continue;
                }
                summary.total_files_found += 1;
                let path_str = match path.canonicalize() {
                    Ok(cp) => cp.display().to_string(),
                    Err(_) => path.display().to_string(),
                };
                let metadata = match fs::metadata(path) {
                    Ok(m) => m,
                    Err(e) => {
                        warn!(
                            "Failed to read metadata of file {}: {:?}",
                            path.display(),
                            e
                        );
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

                // Individual dropped/picked files are always re-indexed so tag updates on
                // disk take effect even when file size and 1-second mtime match.
                match self
                    .extract_and_save_track(path, &path_str, file_size, modified_time, None, db)
                    .await
                {
                    Ok(_) => {
                        summary.new_or_updated_tracks += 1;
                        debug!("Indexed: {}", path.display());
                    }
                    Err(err) => {
                        warn!("Failed to read tags from {}: {:?}", path.display(), err);
                        summary.errors += 1;
                    }
                }
            }
        }
        Ok(summary)
    }

    /// Extracts tags and the cover (in `spawn_blocking`), then writes the entities atomically.
    async fn extract_and_save_track(
        &self,
        file_path: &Path,
        canonical_path: &str,
        file_size: i64,
        modified_time: i64,
        scan_root: Option<&Path>,
        db: &Database,
    ) -> Result<(), LibraryError> {
        let scanner = self.clone();
        let file_path = file_path.to_path_buf();
        let canonical_path = canonical_path.to_string();
        let scan_root = scan_root.map(Path::to_path_buf);
        let parsed = tokio::task::spawn_blocking(move || {
            scanner.read_track_file(
                &file_path,
                &canonical_path,
                file_size,
                modified_time,
                scan_root.as_deref(),
            )
        })
        .await??;

        db.save_scanned_track(
            &parsed.record,
            &parsed.album_name,
            &parsed.album_artist,
            parsed.year,
            parsed.cover_path.as_deref(),
            parsed.release_mbid.as_deref(),
        )
        .await?;
        Ok(())
    }

    /// Blocking read of one file's tags (lofty) and cover.
    fn read_track_file(
        &self,
        file_path: &Path,
        canonical_path: &str,
        file_size: i64,
        modified_time: i64,
        scan_root: Option<&Path>,
    ) -> Result<ParsedTrack, LibraryError> {
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
                    .unwrap_or("Unknown Track")
                    .to_string()
            });

        let artist = tag
            .as_ref()
            .and_then(|t| t.artist())
            .map(|s| s.to_string())
            .unwrap_or_else(|| "Unknown Artist".to_string());

        let album_name = tag
            .as_ref()
            .and_then(|t| t.album())
            .map(|s| s.to_string())
            .unwrap_or_else(|| "Unknown Album".to_string());

        // Album artist (ALBUMARTIST tag): for compilations it differs from the track artist.
        // Without the tag the album is grouped by the track artist.
        let album_artist = tag
            .as_ref()
            .and_then(|t| t.get_string(lofty::tag::ItemKey::AlbumArtist))
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| artist.clone());

        let track_no = tag.as_ref().and_then(|t| t.track()).map(|t| t as i64);
        let disc_no = tag.as_ref().and_then(|t| t.disk()).map(|d| d as i64);
        let year = tag.as_ref().and_then(|t| t.date()).map(|d| d.year as i64);

        // Cover detection: 1. embedded, 2. folder / ancestor root
        let cover_path = self.resolve_cover_art(file_path, tag, scan_root);

        let release_mbid = tag
            .as_ref()
            .and_then(|t| t.get_string(lofty::tag::ItemKey::MusicBrainzReleaseId))
            .map(|s| s.trim().to_string())
            .filter(|s| {
                !s.is_empty()
                    && s.len() <= 64
                    && s.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
            });

        let bpm = tag
            .as_ref()
            .and_then(|t| t.get_string(lofty::tag::ItemKey::Bpm))
            .and_then(|s| s.parse::<f64>().ok())
            .filter(|&b| (40.0..=280.0).contains(&b))
            .map(|b| (b * 10.0).round() / 10.0);

        let initial_key = tag
            .as_ref()
            .and_then(|t| t.get_string(lofty::tag::ItemKey::InitialKey))
            .map(|s| s.to_string());

        let replaygain_track_gain = tag
            .as_ref()
            .and_then(|t| t.get_string(lofty::tag::ItemKey::ReplayGainTrackGain))
            .and_then(|s| {
                s.trim_end_matches(" dB")
                    .trim_end_matches("dB")
                    .trim()
                    .parse::<f64>()
                    .ok()
            });

        let replaygain_track_peak = tag
            .as_ref()
            .and_then(|t| t.get_string(lofty::tag::ItemKey::ReplayGainTrackPeak))
            .and_then(|s| s.trim().parse::<f64>().ok());

        let record = TrackRecord {
            id: 0,
            path: canonical_path.to_string(),
            title,
            artist,
            album_artist: Some(album_artist.clone()),
            album_id: None,
            disc_no,
            track_no,
            duration_ms,
            format,
            sample_rate,
            channels,
            bit_depth,
            file_size,
            modified_time,
            is_favorite: None,
            play_count: None,
            last_played_at: None,
            total_play_time_ms: None,
            bpm,
            initial_key,
            replaygain_track_gain,
            replaygain_track_peak,
            rating: None,
            added_at: None,
        };

        Ok(ParsedTrack {
            record,
            album_name,
            album_artist,
            year,
            cover_path,
            release_mbid,
        })
    }

    /// Collects the supported audio files in a directory with their size and modification time.
    fn walk_audio_files(root: &Path) -> WalkResult {
        let mut out = WalkResult::default();
        for entry in WalkDir::new(root).follow_links(true) {
            let entry = match entry {
                Ok(e) => e,
                Err(e) => {
                    warn!("Error walking directory {}: {}", root.display(), e);
                    out.walk_errors += 1;
                    continue;
                }
            };
            let path = entry.path();
            if !path.is_file() || !Self::is_supported_audio_extension(path) {
                continue;
            }
            let path_str = match path.canonicalize() {
                Ok(p) => p.display().to_string(),
                Err(_) => path.display().to_string(),
            };
            let metadata = match entry.metadata() {
                Ok(m) => m,
                Err(e) => {
                    warn!(
                        "Failed to read metadata of file {}: {:?}",
                        path.display(),
                        e
                    );
                    out.unreadable_paths.push(path_str);
                    continue;
                }
            };
            let modified_time = metadata
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_secs() as i64)
                .unwrap_or(0);
            out.files.push(ScannedFile {
                path: path.to_path_buf(),
                path_str,
                file_size: metadata.len() as i64,
                modified_time,
            });
        }
        out
    }

    /// Looks for a cover in the tags, the file's directory, or its ancestor root.
    fn resolve_cover_art(
        &self,
        file_path: &Path,
        tag: Option<&lofty::tag::Tag>,
        scan_root: Option<&Path>,
    ) -> Option<String> {
        // 1. Check for embedded artwork in the tags
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

        // 2. Look for a cover image in the track's folder or ancestor root
        if let Some(parent) = file_path.parent() {
            if let Some(cand_path) = find_folder_cover(parent, scan_root) {
                return Some(cand_path.display().to_string());
            }
        }

        None
    }
}
