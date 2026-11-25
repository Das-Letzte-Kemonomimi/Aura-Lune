//! Pomijanie ciszy na początku i końcu utworów (Silence Trimming).
//!
//! Wywoływane z pętli statusu odtwarzania ([`super::playback_ticker`]):
//! - przy zmianie utworu w tle wykrywa granice ciszy (`audio_engine::detect_silence_bounds`)
//!   i zapisuje je w bazie (`track_silence_bounds`), aby kolejne odtworzenia nie dekodowały pliku,
//! - na początku odtwarzania przewija za ciszę początkową,
//! - po osiągnięciu ciszy końcowej przewija tuż przed koniec pliku — dalszą obsługę
//!   (powtarzanie, „stop po bieżącym”, crossfade, następny utwór) wykonuje zwykła ścieżka EOS silnika.
//!
//! Dlaczego nie element GStreamera `cutter`: obsługuje wyłącznie S8/S16 (zniszczyłby ścieżkę
//! F32 / bit-perfect), a odrzucanie buforów przy zsynchronizowanym wyjściu nie skraca odtwarzania.

use crate::commands::playback::{seek_internal, PlaybackStatusDto};
use crate::AppState;
use domain::silence::{trim_action, SilenceBounds, TrimAction};
use domain::PlaybackState;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tracing::{debug, info, warn};

/// Ile przed końcem pliku przewinąć przy pomijaniu ciszy końcowej (wyzwala zwykły EOS).
const FINISH_SEEK_BEFORE_END_MS: u64 = 40;

/// Wynik wykrywania dostarczany z zadania w tle.
type DetectionSlot = Arc<Mutex<Option<Option<SilenceBounds>>>>;

#[derive(Debug, Default)]
pub struct SilenceTrimmer {
    track_key: Option<String>,
    bounds: Option<SilenceBounds>,
    detection: Option<DetectionSlot>,
    /// Anuluje dekodowanie poprzedniego utworu po zmianie utworu lub progu.
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

        // Klucz obejmuje próg: zmiana progu w trakcie utworu uruchamia wykrywanie od nowa.
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
                    "Pomijanie ciszy początkowej: {} ms → {} ms",
                    status.position_ms, target
                );
                self.leading_done = true;
                if let Err(e) = seek_internal(state, target, Some(true)) {
                    warn!("Nie udało się pominąć ciszy początkowej: {}", e);
                }
            }
            Some(TrimAction::FinishTrack) if !self.finished => {
                info!(
                    "Pomijanie ciszy końcowej od {} ms (utwór: {} ms)",
                    status.position_ms, duration_ms
                );
                self.finished = true;
                let target = duration_ms.saturating_sub(FINISH_SEEK_BEFORE_END_MS);
                if let Err(e) = seek_internal(state, target, Some(false)) {
                    warn!("Nie udało się pominąć ciszy końcowej: {}", e);
                }
            }
            _ => {}
        }

        // Po pierwszych sekundach utworu ciszy początkowej już nie poprawiamy
        // (np. gdy użytkownik celowo przewinie na sam początek).
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
            // Utwór bez wykrywalnego dźwięku (lub błąd analizy): nic nie pomijamy i nie
            // ponawiamy wykrywania do zmiany utworu.
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
                    debug!("Granice ciszy z pamięci podręcznej dla utworu {}", id);
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
                debug!("Wykrywanie ciszy anulowane (zmiana utworu): {}", uri);
                return;
            }
            let bounds = match detected {
                Ok(Ok(b)) => b,
                Ok(Err(e)) => {
                    warn!("Wykrywanie ciszy nie powiodło się dla {}: {}", uri, e);
                    None
                }
                Err(e) => {
                    warn!("Zadanie wykrywania ciszy przerwane: {}", e);
                    None
                }
            };

            if let (Some(id), Some(mtime), Some(b)) = (track_id, modified, bounds.as_ref()) {
                if let Err(e) = db.save_silence_bounds(id, threshold_db, mtime, b).await {
                    warn!("Nie udało się zapisać granic ciszy: {}", e);
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
