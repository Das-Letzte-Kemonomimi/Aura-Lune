//! Backendowa pętla statusu odtwarzania.
//!
//! Wcześniej magistrala GStreamera (koniec utworu, przejście do następnego, zapętlenie) była
//! opróżniana wyłącznie wtedy, gdy frontend wywołał `get_status`. Ukryte do zasobnika lub
//! zdławione okno WebView zatrzymywało więc przechodzenie między utworami.
//!
//! Ticker działa w osobnym wątku niezależnie od interfejsu i w każdym takcie:
//! 1. buduje status przez [`get_status_internal`] (opróżnia magistralę, aktualizuje Waybar),
//! 2. zapamiętuje go jako migawkę zwracaną przez komendę `get_status`,
//! 3. emituje zdarzenie [`PLAYBACK_STATUS_EVENT`] do frontendu,
//! 4. synchronizuje MPRIS po automatycznej zmianie utworu,
//! 5. nalicza czas słuchania do statystyk (Recap),
//! 6. stosuje pomijanie ciszy na początku i końcu utworu (jeśli włączone).

use crate::commands::playback::{
    get_status_internal, sync_mpris_from_queue_item, PlaybackStatusDto,
};
use crate::setup::silence_trim::SilenceTrimmer;
use crate::AppState;
use domain::PlaybackState;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};
use tracing::{info, warn};

/// Nazwa zdarzenia ze statusem odtwarzania (`PlaybackStatusDto`).
pub const PLAYBACK_STATUS_EVENT: &str = "auralune://playback-status";

/// Interwał taktu podczas odtwarzania (płynny pasek postępu i wizualizacje).
pub const TICK_PLAYING: Duration = Duration::from_millis(100);
/// Interwał taktu w pauzie / po zatrzymaniu.
pub const TICK_IDLE: Duration = Duration::from_millis(250);

/// Uruchamia ticker w dedykowanym wątku. Wywoływane raz, po `app.manage(AppState)`.
pub fn spawn_playback_ticker(app: AppHandle) {
    let spawn = std::thread::Builder::new()
        .name("auralune-playback-ticker".into())
        .spawn(move || run(app));
    if let Err(e) = spawn {
        warn!("Nie udało się uruchomić wątku statusu odtwarzania: {}", e);
    }
}

fn run(app: AppHandle) {
    let Some(state) = app.try_state::<AppState>().map(|s| s.inner().clone()) else {
        warn!("Ticker odtwarzania: brak AppState — pętla nie wystartowała");
        return;
    };
    info!("Ticker odtwarzania uruchomiony");

    let started = Instant::now();
    let mut listening = ListeningTracker::default();
    let mut track_watch = TrackChangeWatcher::default();
    let mut trimmer = SilenceTrimmer::default();

    loop {
        let status = get_status_internal(&state);
        let now_ms = started.elapsed().as_millis() as u64;

        if let Ok(mut cached) = state.last_status.write() {
            *cached = Some(status.clone());
        }
        let _ = app.emit(PLAYBACK_STATUS_EVENT, &status);

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
                    warn!("Nie udało się zapisać czasu słuchania: {}", e);
                }
            });
        }

        trimmer.on_tick(&state, &status);

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

/// Wykrywa zmianę bieżącego elementu kolejki (po `id`), w tym automatyczne przejście po EOS.
#[derive(Debug, Default)]
pub struct TrackChangeWatcher {
    last_id: Option<String>,
}

impl TrackChangeWatcher {
    /// Zwraca `true` przy pierwszym takcie z innym utworem niż poprzednio.
    pub fn changed(&mut self, status: &PlaybackStatusDto) -> bool {
        let id = status.current_track.as_ref().map(|t| t.id.clone());
        if id == self.last_id {
            return false;
        }
        let is_first_observation = self.last_id.is_none();
        self.last_id = id;
        // Pierwszy odczyt po starcie to stan przywrócony z sesji — nie nadpisujemy MPRIS.
        !is_first_observation
    }
}

/// Nalicza rzeczywisty czas odtwarzania utworu i zwraca porcje do zapisania w bazie.
///
/// - liczy tylko czas w stanie `Playing`,
/// - pojedynczy przyrost jest ograniczony do [`ListeningTracker::MAX_TICK_GAP_MS`]
///   (uśpienie systemu lub zawieszenie wątku nie dolicza godzin),
/// - zapis następuje co [`ListeningTracker::FLUSH_EVERY_MS`] oraz przy zmianie utworu.
#[derive(Debug, Default)]
pub struct ListeningTracker {
    track_id: Option<i64>,
    pending_ms: u64,
    last_tick_ms: Option<u64>,
}

impl ListeningTracker {
    pub const FLUSH_EVERY_MS: u64 = 5_000;
    pub const MAX_TICK_GAP_MS: u64 = 1_000;

    /// Rejestruje takt. Zwraca `(track_id, ms)` do zapisania, jeśli przyszła pora.
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
