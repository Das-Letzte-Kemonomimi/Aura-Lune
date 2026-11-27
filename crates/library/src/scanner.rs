use lofty::config::ParseOptions;
use lofty::file::{AudioFile, TaggedFileExt};
use lofty::probe::Probe;
use lofty::tag::Accessor;
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, RwLock};
use std::time::UNIX_EPOCH;
use storage::{Database, ScannedTrack, TrackRecord, TrackScanEntry};
use thiserror::Error;
use tokio::sync::{mpsc, Semaphore};
use tokio::task::JoinSet;
use tracing::{debug, info, warn};
use walkdir::WalkDir;

const SCAN_DB_BATCH_SIZE: usize = 256;
static EMBED_COVER_TMP_SEQ: AtomicU64 = AtomicU64::new(0);

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

/// An audio file found while walking a directory.
struct ScannedFile {
    path: PathBuf,
    path_str: String,
    file_size: i64,
    modified_time: i64,
}

#[derive(Default)]
struct WalkResult {
    root_canon: PathBuf,
    root_str: String,
    root_is_dir: bool,
    files: Vec<ScannedFile>,
    walk_errors: usize,
    /// Files whose metadata could not be read: they still exist, so they must not
    /// be removed from the database as stale.
    unreadable_paths: Vec<String>,
}

#[derive(Default)]
struct ScanContext {
    dir_direct_covers: RwLock<HashMap<PathBuf, Option<PathBuf>>>,
    album_has_cover: RwLock<HashMap<(String, String), bool>>,
    dir_album_hint: RwLock<HashMap<PathBuf, Option<(String, String)>>>,
}

impl ScanContext {
    fn from_cover_map(album_has_cover: HashMap<(String, String), bool>) -> Self {
        Self {
            dir_direct_covers: RwLock::new(HashMap::new()),
            album_has_cover: RwLock::new(album_has_cover),
            dir_album_hint: RwLock::new(HashMap::new()),
        }
    }

    fn has_album_cover(&self, title: &str, album_artist: &str) -> bool {
        self.album_has_cover
            .read()
            .ok()
            .and_then(|map| {
                map.iter()
                    .find(|((t, a), _)| t == title && a == album_artist)
                    .map(|(_, has)| *has)
            })
            .unwrap_or(false)
    }

    fn mark_album_cover(&self, title: String, album_artist: String) {
        if let Ok(mut map) = self.album_has_cover.write() {
            map.insert((title, album_artist), true);
        }
    }

    fn should_skip_embedded_cover(&self, parent: Option<&Path>) -> bool {
        let Some(dir) = parent else {
            return false;
        };
        let hint = self
            .dir_album_hint
            .read()
            .ok()
            .and_then(|map| map.get(dir).cloned().flatten());
        let Some(album_key) = hint else {
            return false;
        };
        self.album_has_cover
            .read()
            .ok()
            .and_then(|map| map.get(&album_key).copied())
            .unwrap_or(false)
    }

    fn mark_dir_mixed(&self, parent: Option<&Path>) {
        if let Some(dir) = parent {
            if let Ok(mut map) = self.dir_album_hint.write() {
                map.insert(dir.to_path_buf(), None);
            }
        }
    }

    fn record_dir_album(&self, parent: Option<&Path>, title: &str, album_artist: &str) {
        let Some(dir) = parent else {
            return;
        };
        if let Ok(mut map) = self.dir_album_hint.write() {
            match map.get(dir) {
                None => {
                    map.insert(
                        dir.to_path_buf(),
                        Some((title.to_string(), album_artist.to_string())),
                    );
                }
                Some(Some((prev_t, prev_a))) if prev_t != title || prev_a != album_artist => {
                    map.insert(dir.to_path_buf(), None);
                }
                _ => {}
            }
        }
    }
}

struct ScanState {
    known: HashMap<String, TrackScanEntry>,
    missing_covers: HashMap<String, i64>,
    recovered_albums: HashSet<i64>,
    checked_cover_dirs: HashSet<(i64, PathBuf)>,
    context: Arc<ScanContext>,
}

const COVER_STEMS: &[&str] = &["cover", "folder", "front", "album", "artwork"];
const COVER_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "webp"];

fn home_dir_canonical() -> Option<PathBuf> {
    std::env::var_os("HOME").map(|h| {
        let p = PathBuf::from(h);
        p.canonicalize().unwrap_or(p)
    })
}

fn entry_is_regular_file(entry: &fs::DirEntry, path: &Path) -> bool {
    match entry.file_type() {
        Ok(ft) if ft.is_symlink() => path.is_file(),
        Ok(ft) => ft.is_file(),
        Err(_) => path.is_file(),
    }
}

fn find_cover_in_dir(dir: &Path) -> Option<PathBuf> {
    let entries = fs::read_dir(dir).ok()?;
    let mut best: Option<(usize, usize, String, PathBuf)> = None;

    for entry in entries.flatten() {
        let path = entry.path();
        if !entry_is_regular_file(&entry, &path) {
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

/// Cached lookup of a cover image directly inside `dir`.
fn direct_cover_cached(ctx: &ScanContext, dir: &Path) -> Option<PathBuf> {
    if let Ok(guard) = ctx.dir_direct_covers.read() {
        if let Some(hit) = guard.get(dir) {
            return hit.clone();
        }
    }
    let found = find_cover_in_dir(dir);
    if let Ok(mut guard) = ctx.dir_direct_covers.write() {
        guard.insert(dir.to_path_buf(), found.clone());
    }
    found
}

fn find_folder_cover_cached(
    ctx: &ScanContext,
    track_dir: &Path,
    canon_root: Option<&Path>,
) -> Option<PathBuf> {
    if let Some(hit) = direct_cover_cached(ctx, track_dir) {
        return Some(hit);
    }

    if let Some(root) = canon_root {
        let mut current = if track_dir.starts_with(root) {
            track_dir.to_path_buf()
        } else {
            track_dir
                .canonicalize()
                .unwrap_or_else(|_| track_dir.to_path_buf())
        };

        while current != root && current.starts_with(root) {
            let Some(parent) = current.parent() else {
                break;
            };
            if !parent.starts_with(root) {
                break;
            }
            if let Some(hit) = direct_cover_cached(ctx, parent) {
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
    direct_cover_cached(ctx, parent)
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
        let mut state = Self::load_scan_state(db).await;
        self.scan_directory_with_state(dir.as_ref(), db, &mut state)
            .await
    }

    async fn load_scan_state(db: &Database) -> ScanState {
        let (known, missing_covers, album_has_cover) = tokio::join!(
            db.track_scan_index(),
            db.track_album_ids_without_cover(),
            db.album_cover_status_map(),
        );
        ScanState {
            known: known.unwrap_or_default(),
            missing_covers: missing_covers.unwrap_or_default(),
            recovered_albums: HashSet::new(),
            checked_cover_dirs: HashSet::new(),
            context: Arc::new(ScanContext::from_cover_map(
                album_has_cover.unwrap_or_default(),
            )),
        }
    }

    async fn scan_directory_with_state(
        &self,
        root: &Path,
        db: &Database,
        state: &mut ScanState,
    ) -> Result<ScanSummary, LibraryError> {
        info!("Starting incremental scan: {}", root.display());

        let mut summary = ScanSummary::default();

        // Walking the directory, canonicalize and stat are blocking, so they run off the Tokio threads.
        let walk_root = root.to_path_buf();
        let walk = tokio::task::spawn_blocking(move || Self::walk_audio_files(&walk_root)).await?;
        summary.total_files_found += walk.unreadable_paths.len();
        summary.errors += walk.unreadable_paths.len() + walk.walk_errors;

        for u_path in &walk.unreadable_paths {
            if let Some(entry) = state.known.get_mut(u_path) {
                entry.visited = true;
            }
        }

        let mut to_parse = Vec::new();
        let mut cover_recovery_candidates: Vec<(i64, PathBuf)> = Vec::new();

        for file in walk.files {
            summary.total_files_found += 1;
            if let Some(entry) = state.known.get_mut(&file.path_str) {
                entry.visited = true;
                if entry.file_size == file.file_size && entry.modified_time == file.modified_time {
                    summary.skipped_unchanged += 1;
                    if let (Some(&album_id), Some(parent)) =
                        (state.missing_covers.get(&file.path_str), file.path.parent())
                    {
                        if !state.recovered_albums.contains(&album_id)
                            && state
                                .checked_cover_dirs
                                .insert((album_id, parent.to_path_buf()))
                        {
                            cover_recovery_candidates.push((album_id, parent.to_path_buf()));
                        }
                    }
                    continue;
                }
            }
            to_parse.push(file);
        }

        if !cover_recovery_candidates.is_empty() {
            let ctx = state.context.clone();
            let canon_root = walk.root_canon.clone();
            let resolved_covers = tokio::task::spawn_blocking(move || {
                cover_recovery_candidates
                    .into_iter()
                    .filter_map(|(album_id, parent)| {
                        find_folder_cover_cached(&ctx, &parent, Some(&canon_root))
                            .map(|cover| (album_id, cover.display().to_string()))
                    })
                    .collect::<Vec<_>>()
            })
            .await?;

            for (album_id, cover_str) in resolved_covers {
                if state.recovered_albums.contains(&album_id) {
                    continue;
                }
                if db
                    .update_album_cover(album_id, &cover_str, None)
                    .await
                    .is_ok()
                {
                    state.recovered_albums.insert(album_id);
                }
            }
        }

        if !to_parse.is_empty() {
            let parallelism = std::thread::available_parallelism()
                .map(|n| n.get())
                .unwrap_or(4)
                .min(8);
            let sem = Arc::new(Semaphore::new(parallelism));
            let (tx, mut rx) = mpsc::channel::<Option<ScannedTrack>>(SCAN_DB_BATCH_SIZE * 2);
            let scanner = self.clone();
            let ctx = state.context.clone();
            let canon_root = walk.root_canon.clone();

            let producer = async move {
                let mut join_set: JoinSet<()> = JoinSet::new();
                for file in to_parse {
                    let Ok(permit) = sem.clone().acquire_owned().await else {
                        break;
                    };
                    let scanner = scanner.clone();
                    let ctx = ctx.clone();
                    let canon_root = canon_root.clone();
                    let tx = tx.clone();
                    join_set.spawn_blocking(move || {
                        let _permit = permit;
                        let item = match scanner.read_track_file_cached(
                            &file.path,
                            &file.path_str,
                            file.file_size,
                            file.modified_time,
                            Some(&canon_root),
                            &ctx,
                        ) {
                            Ok(parsed) => {
                                debug!("Indexed: {}", file.path.display());
                                Some(parsed)
                            }
                            Err(err) => {
                                warn!(
                                    "Failed to read tags from {}: {:?}",
                                    file.path.display(),
                                    err
                                );
                                None
                            }
                        };
                        let _ = tx.blocking_send(item);
                    });
                    while join_set.len() >= parallelism * 2 {
                        let _ = join_set.join_next().await;
                    }
                }
                while join_set.join_next().await.is_some() {}
                drop(tx);
            };

            let writer = async {
                let mut batch: Vec<ScannedTrack> = Vec::with_capacity(SCAN_DB_BATCH_SIZE);
                let mut indexed = 0usize;
                let mut errors = 0usize;

                while let Some(msg) = rx.recv().await {
                    match msg {
                        Some(track) => {
                            batch.push(track);
                            if batch.len() >= SCAN_DB_BATCH_SIZE {
                                let saved = db.save_scanned_tracks(&batch).await?;
                                indexed += saved.len();
                                batch.clear();
                            }
                        }
                        None => errors += 1,
                    }
                }
                if !batch.is_empty() {
                    let saved = db.save_scanned_tracks(&batch).await?;
                    indexed += saved.len();
                }
                Ok::<(usize, usize), LibraryError>((indexed, errors))
            };

            let ((), write_res) = tokio::join!(producer, writer);
            let (indexed, parse_errors) = write_res?;
            summary.new_or_updated_tracks += indexed;
            summary.errors += parse_errors;
        }

        // Remove files that disappeared from disk from the database. Only after a complete walk
        // of an existing directory: an unreachable drive or permission errors must not wipe the library.
        if walk.walk_errors == 0 && walk.root_is_dir {
            let prefix = format!("{}/", walk.root_str.trim_end_matches('/'));
            let stale: Vec<(i64, Option<i64>)> = state
                .known
                .iter()
                .filter(|(path, entry)| !entry.visited && path.starts_with(&prefix))
                .map(|(_, entry)| (entry.id, entry.album_id))
                .collect();
            let removed = db.delete_tracks_by_ids(&stale).await?;
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
        let mut state = Self::load_scan_state(db).await;
        for p in paths {
            let path = p.as_ref();
            if path.is_dir() {
                let s = self.scan_directory_with_state(path, db, &mut state).await?;
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
                    .extract_and_save_track(
                        path,
                        &path_str,
                        file_size,
                        modified_time,
                        None,
                        &state.context,
                        db,
                    )
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
    #[allow(clippy::too_many_arguments)]
    async fn extract_and_save_track(
        &self,
        file_path: &Path,
        canonical_path: &str,
        file_size: i64,
        modified_time: i64,
        scan_root: Option<&Path>,
        ctx: &Arc<ScanContext>,
        db: &Database,
    ) -> Result<(), LibraryError> {
        let scanner = self.clone();
        let file_path = file_path.to_path_buf();
        let canonical_path = canonical_path.to_string();
        let scan_root = scan_root.map(Path::to_path_buf);
        let ctx = ctx.clone();
        let parsed = tokio::task::spawn_blocking(move || {
            scanner.read_track_file_cached(
                &file_path,
                &canonical_path,
                file_size,
                modified_time,
                scan_root.as_deref(),
                &ctx,
            )
        })
        .await??;

        db.save_scanned_track(
            &parsed.record,
            &parsed.album_title,
            &parsed.album_artist,
            parsed.year,
            parsed.cover_path.as_deref(),
            parsed.release_mbid.as_deref(),
        )
        .await?;
        Ok(())
    }

    /// Blocking read of one file's tags (lofty) and cover, reusing scan-wide album/dir caches.
    fn read_track_file_cached(
        &self,
        file_path: &Path,
        canonical_path: &str,
        file_size: i64,
        modified_time: i64,
        scan_root: Option<&Path>,
        ctx: &ScanContext,
    ) -> Result<ScannedTrack, LibraryError> {
        let parent = file_path.parent();
        let skip_cover = ctx.should_skip_embedded_cover(parent);
        let mut tagged_file = Probe::open(file_path)?
            .options(ParseOptions::new().read_cover_art(!skip_cover))
            .read()?;

        let mut tag_ref = tagged_file
            .primary_tag()
            .or_else(|| tagged_file.first_tag());
        let artist_initial = tag_ref
            .and_then(|t| t.artist())
            .map(|s| s.to_string())
            .unwrap_or_else(|| "Unknown Artist".to_string());
        let album_initial = tag_ref
            .and_then(|t| t.album())
            .map(|s| s.to_string())
            .unwrap_or_else(|| "Unknown Album".to_string());
        let album_artist_initial = tag_ref
            .and_then(|t| t.get_string(lofty::tag::ItemKey::AlbumArtist))
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| artist_initial.clone());

        ctx.record_dir_album(parent, &album_initial, &album_artist_initial);
        let mut already_has_cover = ctx.has_album_cover(&album_initial, &album_artist_initial);
        if skip_cover && !already_has_cover {
            ctx.mark_dir_mixed(parent);
            tagged_file = Probe::open(file_path)?
                .options(ParseOptions::new().read_cover_art(true))
                .read()?;
            tag_ref = tagged_file
                .primary_tag()
                .or_else(|| tagged_file.first_tag());
            already_has_cover = ctx.has_album_cover(&album_initial, &album_artist_initial);
        }

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

        let tag = tag_ref;
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

        // Cover detection: 1. embedded, 2. folder / ancestor root (skipped when album already has art).
        let cover_path = if already_has_cover {
            None
        } else {
            let resolved = self.resolve_cover_art_cached(file_path, tag, scan_root, ctx);
            if resolved.is_some() {
                ctx.mark_album_cover(album_name.clone(), album_artist.clone());
            }
            resolved
        };

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

        Ok(ScannedTrack {
            record,
            album_title: album_name,
            album_artist,
            year,
            cover_path,
            release_mbid,
        })
    }

    /// Collects the supported audio files in a directory with their size and modification time.
    fn walk_audio_files(root: &Path) -> WalkResult {
        let root_is_dir = root.is_dir();
        let root_canon = root.canonicalize().unwrap_or_else(|_| root.to_path_buf());
        let root_str = root_canon.display().to_string();
        let mut out = WalkResult {
            root_canon: root_canon.clone(),
            root_str,
            root_is_dir,
            ..WalkResult::default()
        };

        // Track symlinked ancestor directories on the WalkDir depth-first stack so regular
        // files without symlinked ancestors skip redundant per-file `canonicalize()` syscalls.
        let mut symlink_dirs: Vec<usize> = Vec::new();
        for entry in WalkDir::new(&root_canon).follow_links(true) {
            let entry = match entry {
                Ok(e) => e,
                Err(e) => {
                    warn!("Error walking directory {}: {}", root.display(), e);
                    out.walk_errors += 1;
                    continue;
                }
            };
            while let Some(&depth) = symlink_dirs.last() {
                if entry.depth() <= depth {
                    symlink_dirs.pop();
                } else {
                    break;
                }
            }
            let ft = entry.file_type();
            if ft.is_dir() {
                if entry.path_is_symlink() {
                    symlink_dirs.push(entry.depth());
                }
                continue;
            }
            let path = entry.path();
            if !ft.is_file() || !Self::is_supported_audio_extension(path) {
                continue;
            }
            let path_str = if entry.path_is_symlink() || !symlink_dirs.is_empty() {
                match path.canonicalize() {
                    Ok(p) => p.display().to_string(),
                    Err(_) => path.display().to_string(),
                }
            } else {
                path.display().to_string()
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
    fn resolve_cover_art_cached(
        &self,
        file_path: &Path,
        tag: Option<&lofty::tag::Tag>,
        scan_root: Option<&Path>,
        ctx: &ScanContext,
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
                    let seq = EMBED_COVER_TMP_SEQ.fetch_add(1, Ordering::Relaxed);
                    let tmp_path = self.cache_dir.join("covers").join(format!(
                        ".tmp_{}_{}_{}.jpg",
                        std::process::id(),
                        seq,
                        hash_str
                    ));
                    if fs::write(&tmp_path, data).is_ok() {
                        if fs::rename(&tmp_path, &target_path).is_err() {
                            let _ = fs::remove_file(&tmp_path);
                        }
                    } else {
                        let _ = fs::remove_file(&tmp_path);
                    }
                }
                return Some(target_path.display().to_string());
            }
        }

        // 2. Look for a cover image in the track's folder or ancestor root
        if let Some(parent) = file_path.parent() {
            if let Some(cand_path) = find_folder_cover_cached(ctx, parent, scan_root) {
                return Some(cand_path.display().to_string());
            }
        }

        None
    }
}
