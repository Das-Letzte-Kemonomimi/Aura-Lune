//! Backend playback status loop.
//!
//! Previously the GStreamer bus (end of track, move to the next one, loop) was drained
//! only when the frontend called `get_status`. A WebView hidden in the tray or throttled
//! therefore stopped the move from track to track.
//!
//! The ticker runs on its own thread, independent of the UI, and on every tick:
//! 1. builds the status through [`tick_status`] (drains the bus, updates Waybar),
//! 2. remembers it as the snapshot returned by the `get_status` command,
//! 3. emits the [`PLAYBACK_STATUS_EVENT`] event to the frontend,
//! 4. syncs MPRIS after an automatic track change,
//! 5. adds listening time to the statistics (Recap),
//! 6. applies silence trimming at the start and end of a track (when enabled).

use crate::commands::playback::{sync_mpris_from_queue_item, tick_status, PlaybackStatusDto};
use crate::setup::silence_trim::SilenceTrimmer;
use crate::AppState;
use domain::PlaybackState;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};
use tracing::{info, warn};

/// Name of the event carrying the playback status (`PlaybackStatusDto`).
pub const PLAYBACK_STATUS_EVENT: &str = "auralune://playback-status";
/// Event with a playback (GStreamer) error message for the UI: `{ "message": "…" }`.
pub const PLAYBACK_ERROR_EVENT: &str = "auralune://playback-error";

/// Tick interval while playing (smooth progress bar and visualisations).
pub const TICK_PLAYING: Duration = Duration::from_millis(100);
/// Tick interval while paused / stopped.
pub const TICK_IDLE: Duration = Duration::from_millis(250);
/// Keepalive / tray-hidden emit interval.
pub const EMIT_KEEPALIVE: Duration = Duration::from_secs(1);

/// Decides whether the ticker should emit [`PLAYBACK_STATUS_EVENT`] on this tick.
///
/// Always emits the first status (`prev` is `None`). While the window is hidden in the tray,
/// emits are capped at once per second (`>= EMIT_KEEPALIVE`). Otherwise emits whenever the DTO
/// changed or at least `EMIT_KEEPALIVE` has passed since the last emit.
pub fn should_emit(
    prev: Option<&PlaybackStatusDto>,
    next: &PlaybackStatusDto,
    since_last: Duration,
    hidden: bool,
) -> bool {
    let Some(prev) = prev else {
        return true;
    };
    if hidden {
        return since_last >= EMIT_KEEPALIVE;
    }
    prev != next || since_last >= EMIT_KEEPALIVE
}

/// Ticker stop flag and the lock of the running tick: [`stop_playback_ticker`] waits until
/// the current tick ends, so after it returns the ticker no longer writes the Waybar status.
static STOP_REQUESTED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
static TICK_IN_PROGRESS: std::sync::Mutex<()> = std::sync::Mutex::new(());

/// Stops the ticker (when the app quits) and waits for the running tick to finish.
pub fn stop_playback_ticker() {
    STOP_REQUESTED.store(true, std::sync::atomic::Ordering::SeqCst);
    drop(TICK_IN_PROGRESS.lock());
}

/// Starts the ticker on a dedicated thread. Called once, after `app.manage(AppState)`.
pub fn spawn_playback_ticker(app: AppHandle) {
    let spawn = std::thread::Builder::new()
        .name("auralune-playback-ticker".into())
        .spawn(move || run(app));
    if let Err(e) = spawn {
        warn!("Failed to start the playback status thread: {}", e);
    }
}

fn run(app: AppHandle) {
    let Some(state) = app.try_state::<AppState>().map(|s| s.inner().clone()) else {
        warn!("Playback ticker: no AppState, the loop did not start");
        return;
    };
    info!("Playback ticker started");

    let started = Instant::now();
    let mut listening = ListeningTracker::default();
    let mut track_watch = TrackChangeWatcher::default();
    let mut trimmer = SilenceTrimmer::default();
    let mut last_emitted: Option<Arc<PlaybackStatusDto>> = None;
    let mut last_emitted_at = Instant::now();

    let mut errors = Vec::new();
    loop {
        let tick_guard = TICK_IN_PROGRESS
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        if STOP_REQUESTED.load(Ordering::SeqCst) {
            info!("Playback ticker stopped");
            return;
        }
        let status = Arc::new(tick_status(&state, &mut errors));
        for message in errors.drain(..) {
            let _ = app.emit(
                PLAYBACK_ERROR_EVENT,
                serde_json::json!({ "message": message }),
            );
        }
        let now_ms = started.elapsed().as_millis() as u64;

        if let Ok(mut cached) = state.last_status.write() {
            *cached = Some(Arc::clone(&status));
        }

        let hidden = state.window_hidden.load(Ordering::Relaxed);
        if should_emit(
            last_emitted.as_deref(),
            &status,
            last_emitted_at.elapsed(),
            hidden,
        ) {
            let _ = app.emit(PLAYBACK_STATUS_EVENT, status.as_ref());
            last_emitted = Some(Arc::clone(&status));
            last_emitted_at = Instant::now();
        }

        if track_watch.changed(&status) {
            if let Some(item) = &status.current_track {
                sync_mpris_from_queue_item(item, &state);
            }
        }

        let track_id = status.current_track.as_ref().and_then(|t| t.track_id);
        let is_playing = status.state == PlaybackState::Playing;
        if let Some((id, ms)) = listening.on_tick(now_ms, is_playing, track_id) {
            let db = state.db.clone();
            state.rt.spawn(async move {
                if let Err(e) = db.record_track_listening(id, ms as i64).await {
                    warn!("Failed to save the listening time: {}", e);
                }
            });
        }

        trimmer.on_tick(&state, &status);
        drop(tick_guard);

        std::thread::sleep(next_interval(&status));
    }
}

fn next_interval(status: &PlaybackStatusDto) -> Duration {
    if status.state == PlaybackState::Playing {
        TICK_PLAYING
    } else {
        TICK_IDLE
    }
}

/// Detects a change of the current queue item (by `id`), including the automatic move after EOS.
#[derive(Debug, Default)]
pub struct TrackChangeWatcher {
    last_id: Option<String>,
}

impl TrackChangeWatcher {
    /// Returns `true` on the first tick with a different track than before.
    pub fn changed(&mut self, status: &PlaybackStatusDto) -> bool {
        let id = status.current_track.as_ref().map(|t| t.id.clone());
        if id == self.last_id {
            return false;
        }
        let is_first_observation = self.last_id.is_none();
        self.last_id = id;
        // The first read after start-up is the state restored from the session, so MPRIS is not overwritten.
        !is_first_observation
    }
}

/// Counts the real playback time of a track and returns chunks to store in the database.
///
/// - counts only time in the `Playing` state,
/// - a single increment is capped at [`ListeningTracker::MAX_TICK_GAP_MS`]
///   (system sleep or a stalled thread does not add hours),
/// - writes happen every [`ListeningTracker::FLUSH_EVERY_MS`] and on a track change.
#[derive(Debug, Default)]
pub struct ListeningTracker {
    track_id: Option<i64>,
    pending_ms: u64,
    last_tick_ms: Option<u64>,
}

impl ListeningTracker {
    pub const FLUSH_EVERY_MS: u64 = 5_000;
    pub const MAX_TICK_GAP_MS: u64 = 1_000;

    /// Records a tick. Returns `(track_id, ms)` to store when it is time.
    pub fn on_tick(
        &mut self,
        now_ms: u64,
        playing: bool,
        track_id: Option<i64>,
    ) -> Option<(i64, u64)> {
        let elapsed = self
            .last_tick_ms
            .map(|last| now_ms.saturating_sub(last).min(Self::MAX_TICK_GAP_MS))
            .unwrap_or(0);
        self.last_tick_ms = Some(now_ms);

        if track_id != self.track_id {
            let flushed = self.take_pending();
            self.track_id = track_id;
            return flushed;
        }

        if playing && self.track_id.is_some() {
            self.pending_ms += elapsed;
        }
        if self.pending_ms >= Self::FLUSH_EVERY_MS {
            return self.take_pending();
        }
        None
    }

    fn take_pending(&mut self) -> Option<(i64, u64)> {
        let id = self.track_id?;
        if self.pending_ms == 0 {
            return None;
        }
        let ms = std::mem::take(&mut self.pending_ms);
        Some((id, ms))
    }
}
