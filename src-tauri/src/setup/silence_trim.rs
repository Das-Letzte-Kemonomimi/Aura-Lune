//! Skipping silence at the start and end of tracks (Silence Trimming).
//!
//! Called from the playback status loop ([`super::playback_ticker`]):
//! - on a track change, detects the silence bounds in the background (`audio_engine::detect_silence_bounds`)
//!   and stores them in the database (`track_silence_bounds`), so later plays do not decode the file,
//! - at the start of playback, seeks past the leading silence,
//! - on reaching the trailing silence, seeks to just before the end of the file; the rest
//!   (repeat, "stop after current", crossfade, next track) is handled by the engine's normal EOS path.
//!
//! Why not the GStreamer `cutter` element: it only handles S8/S16 (it would break the
//! F32 / bit-perfect path), and dropping buffers on a synchronised output does not shorten playback.

use crate::commands::playback::{seek_internal, PlaybackStatusDto};
use crate::AppState;
use domain::silence::{trim_action, SilenceBounds, TrimAction};
use domain::PlaybackState;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tracing::{debug, info, warn};

/// How far before the end of the file to seek when skipping trailing silence (triggers the normal EOS).
const FINISH_SEEK_BEFORE_END_MS: u64 = 40;

/// Detection result delivered from the background task.
type DetectionSlot = Arc<Mutex<Option<Option<SilenceBounds>>>>;

#[derive(Debug, Default)]
pub struct SilenceTrimmer {
    track_key: Option<String>,
    bounds: Option<SilenceBounds>,
    detection: Option<DetectionSlot>,
    /// Cancels decoding of the previous track after a track or threshold change.
    cancel: Option<Arc<AtomicBool>>,
    leading_done: bool,
    finished: bool,
}

impl SilenceTrimmer {
    pub fn on_tick(&mut self, state: &AppState, status: &PlaybackStatusDto) {
        let config = state.engine.silence_trimming_config();
        let Some(item) = status.current_track.as_ref() else {
            return;
        };

        // The key includes the threshold: changing it mid-track restarts detection.
        let key = format!("{}@{}", item.id, config.threshold_db);
        if self.track_key.as_deref() != Some(key.as_str()) {
            self.reset_for(key);
        }
        if !config.enabled || is_stream(&item.uri) {
            return;
        }

        if self.detection.is_none() && self.bounds.is_none() {
            self.start_detection(state, item, status.duration_ms, config.threshold_db);
        }
        self.collect_detection();

        let Some(bounds) = self.bounds else {
            return;
        };
        if status.state != PlaybackState::Playing {
            return;
        }
        let duration_ms = status.duration_ms.unwrap_or(item.duration_ms);

        match trim_action(status.position_ms, duration_ms, &bounds, self.leading_done) {
            Some(TrimAction::SeekTo(target)) => {
                info!(
                    "Skipping leading silence: {} ms → {} ms",
                    status.position_ms, target
                );
                self.leading_done = true;
                if let Err(e) = seek_internal(state, target, Some(true)) {
                    warn!("Failed to skip the leading silence: {}", e);
                }
            }
            Some(TrimAction::FinishTrack) if !self.finished => {
                info!(
                    "Skipping trailing silence from {} ms (track: {} ms)",
                    status.position_ms, duration_ms
                );
                self.finished = true;
                let target = duration_ms.saturating_sub(FINISH_SEEK_BEFORE_END_MS);
                if let Err(e) = seek_internal(state, target, Some(false)) {
                    warn!("Failed to skip the trailing silence: {}", e);
                }
            }
            _ => {}
        }

        // After the first seconds of a track the leading silence is no longer corrected
        // (e.g. when the user deliberately seeks back to the very start).
        if status.position_ms > bounds.start_ms {
            self.leading_done = true;
        }
    }

    fn reset_for(&mut self, key: String) {
        if let Some(cancel) = self.cancel.take() {
            cancel.store(true, Ordering::Relaxed);
        }
        *self = Self {
            track_key: Some(key),
            ..Self::default()
        };
    }

    fn collect_detection(&mut self) {
        let Some(slot) = &self.detection else {
            return;
        };
        let ready = slot.lock().ok().and_then(|mut s| s.take());
        if let Some(result) = ready {
            self.bounds = result;
            // A track with no detectable sound (or an analysis error): skip nothing and do not
            // retry detection until the track changes.
            if self.bounds.is_none() {
                self.bounds = Some(SilenceBounds {
                    start_ms: 0,
                    end_ms: None,
                });
            }
            self.detection = None;
        }
    }

    fn start_detection(
        &mut self,
        state: &AppState,
        item: &domain::queue::QueueItem,
        duration_ms: Option<u64>,
        threshold_db: f64,
    ) {
        let slot: DetectionSlot = Arc::new(Mutex::new(None));
        self.detection = Some(slot.clone());
        let cancel = Arc::new(AtomicBool::new(false));
        self.cancel = Some(cancel.clone());

        let db = state.db.clone();
        let uri = item.uri.clone();
        let track_id = item.track_id;
        let expected = duration_ms.or(Some(item.duration_ms)).filter(|d| *d > 0);
        state.rt.spawn(async move {
            let modified = match track_id {
                Some(id) => db
                    .get_track_by_id(id)
                    .await
                    .ok()
                    .flatten()
                    .map(|t| t.modified_time),
                None => None,
            };

            if let (Some(id), Some(mtime)) = (track_id, modified) {
                if let Ok(Some(cached)) = db.get_silence_bounds(id, threshold_db, mtime).await {
                    debug!("Silence bounds from the cache for track {}", id);
                    if let Ok(mut s) = slot.lock() {
                        *s = Some(Some(cached));
                    }
                    return;
                }
            }

            let uri_for_task = uri.clone();
            let cancel_for_task = cancel.clone();
            let detected = tokio::task::spawn_blocking(move || {
                audio_engine::detect_silence_bounds(
                    &uri_for_task,
                    threshold_db,
                    expected,
                    Some(&cancel_for_task),
                )
            })
            .await;
            if cancel.load(Ordering::Relaxed) {
                debug!("Silence detection cancelled (track changed): {}", uri);
                return;
            }
            let bounds = match detected {
                Ok(Ok(b)) => b,
                Ok(Err(e)) => {
                    warn!("Silence detection failed for {}: {}", uri, e);
                    None
                }
                Err(e) => {
                    warn!("Silence detection task interrupted: {}", e);
                    None
                }
            };

            if let (Some(id), Some(mtime), Some(b)) = (track_id, modified, bounds.as_ref()) {
                if let Err(e) = db.save_silence_bounds(id, threshold_db, mtime, b).await {
                    warn!("Failed to save the silence bounds: {}", e);
                }
            }
            if let Ok(mut s) = slot.lock() {
                *s = Some(bounds);
            }
        });
    }
}

fn is_stream(uri: &str) -> bool {
    uri.starts_with("http://") || uri.starts_with("https://")
}
