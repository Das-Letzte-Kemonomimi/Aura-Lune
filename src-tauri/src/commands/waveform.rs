//! Seekbar waveforms: the `get_track_waveform` command, its caches, and the decode it shares with
//! silence detection.
//!
//! A waveform is looked up in the database (`track_waveform_profiles`), then in a small in-memory
//! cache (for files that are not in the library), and only then decoded. Every decode registers a
//! [`WaveformJob`] for its file, so a second request for the same file waits for the first one
//! instead of decoding again. The silence trimmer registers one too when it decodes a new track for
//! both the waveform and the silence bounds ([`audio_engine::analyze_waveform_and_silence`]).

use super::error::CommandError;
use crate::AppState;
use audio_engine::{extract_track_waveform_spectrum, WAVEFORM_ANALYZER_VERSION};
use domain::analysis::TrackWaveformData;
use std::collections::{HashMap, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;
use storage::Database;
use tauri::State;
use tokio::sync::watch;

/// Bucket count the player's seekbar requests (`WAVEFORM_BUCKETS` in
/// `src/hooks/useCurrentTrackInfo.ts`). The silence trimmer's shared decode builds this size.
pub(crate) const DEFAULT_WAVEFORM_BUCKETS: usize = 160;
const MIN_WAVEFORM_BUCKETS: usize = 32;
const MAX_WAVEFORM_BUCKETS: usize = 512;
const WAVEFORM_MEMORY_CACHE_CAP: usize = 32;
/// Longest wait for a waveform decode started by someone else (the decode itself stops at 60 s).
const SHARED_JOB_WAIT: Duration = Duration::from_secs(75);

/// Computes (or returns from cache) the real FFT spectral waveform profile for an audio track.
#[tauri::command]
pub async fn get_track_waveform(
    path: String,
    track_id: Option<i64>,
    sample_count: Option<usize>,
    force_recompute: Option<bool>,
    state: State<'_, AppState>,
) -> Result<TrackWaveformData, CommandError> {
    let resolved = super::paths::ensure_readable(Path::new(&path), super::paths::AUDIO_EXTENSIONS)?;
    let resolved_str = resolved.to_string_lossy().into_owned();
    let count = sample_count
        .unwrap_or(DEFAULT_WAVEFORM_BUCKETS)
        .clamp(MIN_WAVEFORM_BUCKETS, MAX_WAVEFORM_BUCKETS);
    let recompute = force_recompute.unwrap_or(false);
    let mtime = file_mtime_secs(&resolved).await;

    let effective_track_id = match track_id {
        Some(id) => Some(id),
        None => state
            .db
            .find_track_by_path_or_uri(&resolved_str)
            .await
            .ok()
            .flatten()
            .map(|t| t.id),
    };

    if !recompute {
        if let Some(hit) =
            cached_waveform(&state.db, effective_track_id, &resolved, mtime, count).await
        {
            return Ok(hit);
        }
        // The same file may be decoding already (the silence trimmer's shared decode on a
        // track change, or a concurrent request): wait for it rather than decode twice.
        if wait_for_waveform_job(&resolved).await {
            if let Some(mut mem) = read_memory_waveform(&resolved, mtime, count) {
                mem.track_id = effective_track_id;
                return Ok(mem);
            }
        }
    }

    // `None` only when another decode started in the meantime; decoding anyway is still correct.
    let job = begin_waveform_job(&resolved);
    let path_for_decode = resolved_str.clone();
    let data = tokio::task::spawn_blocking(move || {
        extract_track_waveform_spectrum(&path_for_decode, count, effective_track_id)
    })
    .await
    .map_err(|e| CommandError::from(e).context("Waveform analysis thread error"))?
    .map_err(|e| CommandError::from(e).context("Waveform analysis error"))?;

    store_waveform(&state.db, effective_track_id, resolved, mtime, count, &data).await;
    drop(job);
    Ok(data)
}

/// File modification time in whole seconds since the Unix epoch (0 when unknown): the cache key
/// of stored waveforms.
pub(crate) async fn file_mtime_secs(path: &Path) -> i64 {
    tokio::fs::metadata(path)
        .await
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// A stored waveform of `count` buckets for this file version, from the database (by track) or
/// the in-memory cache (by path).
pub(crate) async fn cached_waveform(
    db: &Database,
    track_id: Option<i64>,
    path: &Path,
    mtime: i64,
    count: usize,
) -> Option<TrackWaveformData> {
    if let Some(id) = track_id {
        if let Ok(Some(cached)) = db
            .get_track_waveform_profile(id, count as i64, WAVEFORM_ANALYZER_VERSION, mtime)
            .await
        {
            if let (Ok(peaks), Ok(bands)) = (
                serde_json::from_str::<Vec<f32>>(&cached.peaks_json),
                serde_json::from_str::<Vec<[f32; 3]>>(&cached.bands_json),
            ) {
                if peaks.len() == count && bands.len() == count {
                    return Some(TrackWaveformData {
                        track_id: Some(id),
                        sample_count: count,
                        peaks,
                        bands,
                        analyzer_version: cached.analyzer_version,
                    });
                }
            }
        }
    }
    let mut mem = read_memory_waveform(path, mtime, count)?;
    mem.track_id = track_id;
    Some(mem)
}

/// Saves a computed waveform to the database (library tracks) and the in-memory cache.
pub(crate) async fn store_waveform(
    db: &Database,
    track_id: Option<i64>,
    path: PathBuf,
    mtime: i64,
    count: usize,
    data: &TrackWaveformData,
) {
    if let Some(id) = track_id {
        if let (Ok(peaks_json), Ok(bands_json)) = (
            serde_json::to_string(&data.peaks),
            serde_json::to_string(&data.bands),
        ) {
            let _ = db
                .save_track_waveform_profile(
                    id,
                    count as i64,
                    &peaks_json,
                    &bands_json,
                    &data.analyzer_version,
                    mtime,
                )
                .await;
        }
    }
    write_memory_waveform(path, mtime, count, data.clone());
}

// ---------------------------------------------------------------------------
// In-flight decodes
// ---------------------------------------------------------------------------

type WaveformJobs = Mutex<HashMap<PathBuf, watch::Receiver<()>>>;

fn waveform_jobs() -> &'static WaveformJobs {
    static JOBS: OnceLock<WaveformJobs> = OnceLock::new();
    JOBS.get_or_init(|| Mutex::new(HashMap::new()))
}

/// A waveform decode in progress for one (canonical) file path. Dropping it wakes every waiter,
/// whether the decode succeeded, failed or was cancelled.
pub(crate) struct WaveformJob {
    path: PathBuf,
    done: watch::Sender<()>,
}

impl Drop for WaveformJob {
    fn drop(&mut self) {
        if let Ok(mut jobs) = waveform_jobs().lock() {
            if jobs
                .get(&self.path)
                .is_some_and(|rx| rx.same_channel(&self.done.subscribe()))
            {
                jobs.remove(&self.path);
            }
        }
        // Dropping `done` right after this closes the channel: waiters' `changed()` returns.
    }
}

/// Registers a waveform decode for `path`, or `None` if one is already running.
pub(crate) fn begin_waveform_job(path: &Path) -> Option<WaveformJob> {
    let mut jobs = waveform_jobs().lock().ok()?;
    if jobs.contains_key(path) {
        return None;
    }
    let (done, rx) = watch::channel(());
    jobs.insert(path.to_path_buf(), rx);
    Some(WaveformJob {
        path: path.to_path_buf(),
        done,
    })
}

/// Waits (up to [`SHARED_JOB_WAIT`]) for a running decode of `path`. Returns whether there was one.
pub(crate) async fn wait_for_waveform_job(path: &Path) -> bool {
    let rx = waveform_jobs()
        .lock()
        .ok()
        .and_then(|jobs| jobs.get(path).cloned());
    let Some(mut rx) = rx else {
        return false;
    };
    // Resolves with `Err` once the job's sender is dropped; nothing is ever sent.
    let _ = tokio::time::timeout(SHARED_JOB_WAIT, rx.changed()).await;
    true
}

// ---------------------------------------------------------------------------
// In-memory cache (files that are not library tracks have no database row)
// ---------------------------------------------------------------------------

#[derive(Clone)]
struct MemoryWaveformEntry {
    path: PathBuf,
    mtime: i64,
    sample_count: usize,
    data: TrackWaveformData,
}

fn waveform_memory_cache() -> &'static Mutex<VecDeque<MemoryWaveformEntry>> {
    static CACHE: OnceLock<Mutex<VecDeque<MemoryWaveformEntry>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(VecDeque::with_capacity(WAVEFORM_MEMORY_CACHE_CAP)))
}

fn read_memory_waveform(path: &Path, mtime: i64, sample_count: usize) -> Option<TrackWaveformData> {
    let guard = waveform_memory_cache().lock().ok()?;
    guard
        .iter()
        .find(|e| e.path == path && e.mtime == mtime && e.sample_count == sample_count)
        .map(|e| e.data.clone())
}

fn write_memory_waveform(path: PathBuf, mtime: i64, sample_count: usize, data: TrackWaveformData) {
    let Ok(mut guard) = waveform_memory_cache().lock() else {
        return;
    };
    guard.retain(|e| !(e.path == path && e.sample_count == sample_count));
    if guard.len() >= WAVEFORM_MEMORY_CACHE_CAP {
        guard.pop_front();
    }
    guard.push_back(MemoryWaveformEntry {
        path,
        mtime,
        sample_count,
        data,
    });
}

#[cfg(test)]
#[path = "waveform_test.rs"]
mod tests;
