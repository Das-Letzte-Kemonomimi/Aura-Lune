//! Kolejka odtwarzania: modyfikacje oraz przejścia między utworami (następny/poprzedni/indeks).

use super::*;

impl AudioEngine {
    /// Zwraca kopię bieżącego stanu kolejki odtwarzania.
    pub fn queue(&self) -> PlaybackQueue {
        self.queue.lock_safe().clone()
    }

    /// Ustawia nową zawartość kolejki i opcjonalnie rozpoczyna odtwarzanie od wskazanego indeksu.
    pub fn set_queue(
        &self,
        items: Vec<QueueItem>,
        start_index: Option<usize>,
    ) -> Result<Option<QueueItem>, AudioEngineError> {
        let (_crossfade_ms, user_vol, is_playing, volume) = {
            let inner = self.inner.lock_safe();
            let is_playing = inner.pipeline.current_state() == gst::State::Playing;
            (
                inner.crossfade_duration_ms,
                inner.user_volume,
                is_playing,
                inner.volume.clone(),
            )
        };

        let active_item = {
            let mut q = self.queue.lock_safe();
            q.set_items(items, start_index);
            q.current_item().cloned()
        };

        if let Some(item) = &active_item {
            if is_playing && user_vol > 0.001 {
                let gen = self.fade_generation.fetch_add(1, Ordering::SeqCst) + 1;
                Self::fade_out_equal_power(
                    &volume,
                    user_vol,
                    Duration::from_millis(20),
                    &self.fade_generation,
                    gen,
                );
            }
            self.load_uri(&item.uri)?;
            self.play_with_fade(true)?;
        }
        Ok(active_item)
    }

    /// Przywraca elementy i indeks kolejki bez natychmiastowego ładowania i odtwarzania przez GStreamer (bezpieczny start aplikacji).
    pub fn restore_queue(&self, items: Vec<QueueItem>, current_index: Option<usize>) {
        let mut q = self.queue.lock_safe();
        q.set_items(items, current_index);
    }

    /// Ustawia lub dodaje bieżący aktywny utwór do kolejki.
    pub fn set_active_item(&self, item: QueueItem) {
        let mut q = self.queue.lock_safe();
        q.set_active_item(item);
    }

    /// Dodaje utwór na koniec bieżącej kolejki.
    pub fn add_to_queue(&self, item: QueueItem) {
        let mut q = self.queue.lock_safe();
        q.add_item(item);
    }

    /// Wstawia utwór jako następny po bieżącym.
    pub fn add_next_to_queue(&self, item: QueueItem) {
        let mut q = self.queue.lock_safe();
        q.add_next(item);
    }

    /// Usuwa utwór z kolejki po unikalnym identyfikatorze.
    pub fn remove_from_queue(&self, id: &str) -> Option<QueueItem> {
        let mut q = self.queue.lock_safe();
        q.remove_item(id)
    }

    /// Zmienia kolejność utworu w kolejce.
    pub fn move_in_queue(&self, from: usize, to: usize) -> bool {
        let mut q = self.queue.lock_safe();
        q.move_item(from, to)
    }

    /// Czyści całą kolejkę odtwarzania.
    pub fn clear_queue(&self) {
        let mut q = self.queue.lock_safe();
        q.clear();
    }

    /// Pobiera kopię aktualnego utworu w kolejce odtwarzania.
    pub fn current_queue_item(&self) -> Option<QueueItem> {
        let q = self.queue.lock_safe();
        q.current_item().cloned()
    }

    /// Odtwarza utwór ze wskazanego indeksu w kolejce.
    pub fn play_index(&self, index: usize) -> Result<Option<QueueItem>, AudioEngineError> {
        // Kolejność blokad: `inner` może być trzymany podczas pobierania `queue`, ale nigdy odwrotnie.
        // Najpierw migawka stanu silnika (blokada zwalniana), dopiero potem modyfikacja kolejki.
        let (user_vol, is_playing, volume, current_uri) = {
            let inner = self.inner.lock_safe();
            (
                inner.user_volume,
                inner.pipeline.current_state() == gst::State::Playing,
                inner.volume.clone(),
                inner.current_uri.clone(),
            )
        };
        let (item, is_same_track) = {
            let mut q = self.queue.lock_safe();
            let item = if index < q.items.len() {
                q.current_index = Some(index);
                if q.shuffle && !q.shuffle_order.is_empty() {
                    if let Some(pos) = q.shuffle_order.iter().position(|&x| x == index) {
                        q.shuffle_cursor = pos;
                    }
                }
                q.current_item().cloned()
            } else {
                None
            };
            let is_same = match (&item, &current_uri) {
                (Some(it), Some(cur)) => &it.uri == cur,
                _ => false,
            };
            (item, is_same)
        };

        if let Some(item) = &item {
            if is_same_track {
                if is_playing {
                    // Ten sam utwór i już gra — przewijamy do początku i upewniamy się, że głośność jest nominalna
                    self.seek(Duration::ZERO)?;
                    volume.set_property("volume", user_vol);
                } else {
                    self.play_with_fade(true)?;
                }
            } else {
                if is_playing && user_vol > 0.001 {
                    // Szybki anti-pop ramp (20 ms) przy bezpośrednim kliknięciu utworu w kolejce:
                    // eliminuje trzaski DAC bez wprowadzania opóźnień ani zamrażania UI (zero-freeze).
                    let gen = self.fade_generation.fetch_add(1, Ordering::SeqCst) + 1;
                    Self::fade_out_equal_power(
                        &volume,
                        user_vol,
                        Duration::from_millis(20),
                        &self.fade_generation,
                        gen,
                    );
                }
                self.load_uri(&item.uri)?;
                self.play_with_fade(true)?;
            }
        }
        Ok(item)
    }

    /// Przechodzi do następnego utworu w kolejce według trybów Loop i Shuffle,
    /// stosując płynne przejście z krzywą equal-power, jeśli włączony jest crossfade.
    pub fn play_next(&self) -> Result<Option<QueueItem>, AudioEngineError> {
        let (crossfade_ms, user_vol, is_playing, volume) = {
            let inner = self.inner.lock_safe();
            let is_playing = inner.pipeline.current_state() == gst::State::Playing;
            (
                inner.crossfade_duration_ms,
                inner.user_volume,
                is_playing,
                inner.volume.clone(),
            )
        };

        if is_playing && crossfade_ms > 0 && user_vol > 0.001 {
            let fade_out_ms = (crossfade_ms / 8).clamp(30, 150);
            let gen = self.fade_generation.fetch_add(1, Ordering::SeqCst) + 1;
            Self::fade_out_equal_power(
                &volume,
                user_vol,
                Duration::from_millis(fade_out_ms),
                &self.fade_generation,
                gen,
            );
        }

        let next_item = {
            let mut q = self.queue.lock_safe();
            q.next().cloned()
        };

        match next_item {
            Some(item) => {
                self.load_uri(&item.uri)?;
                if crossfade_ms > 0 && user_vol > 0.001 {
                    let fade_in_ms = crossfade_ms / 2;
                    self.play_with_fade_duration(Duration::from_millis(fade_in_ms))?;
                } else {
                    self.play_with_fade(true)?;
                }
                Ok(Some(item))
            }
            None => {
                self.stop()?;
                Ok(None)
            }
        }
    }

    /// Przechodzi do poprzedniego utworu w kolejce (lub resetuje bieżący, jeśli grał > 3s).
    pub fn play_previous(&self) -> Result<Option<QueueItem>, AudioEngineError> {
        if let Some(pos) = self.position() {
            if pos.as_secs() >= 3 {
                self.seek(Duration::from_millis(0))?;
                let q = self.queue.lock_safe();
                return Ok(q.current_item().cloned());
            }
        }

        let (crossfade_ms, user_vol, is_playing, volume) = {
            let inner = self.inner.lock_safe();
            let is_playing = inner.pipeline.current_state() == gst::State::Playing;
            (
                inner.crossfade_duration_ms,
                inner.user_volume,
                is_playing,
                inner.volume.clone(),
            )
        };

        if is_playing && crossfade_ms > 0 && user_vol > 0.001 {
            let fade_out_ms = (crossfade_ms / 8).clamp(30, 150);
            let gen = self.fade_generation.fetch_add(1, Ordering::SeqCst) + 1;
            Self::fade_out_equal_power(
                &volume,
                user_vol,
                Duration::from_millis(fade_out_ms),
                &self.fade_generation,
                gen,
            );
        }

        let prev_item = {
            let mut q = self.queue.lock_safe();
            q.previous().cloned()
        };

        match prev_item {
            Some(item) => {
                self.load_uri(&item.uri)?;
                if crossfade_ms > 0 && user_vol > 0.001 {
                    let fade_in_ms = crossfade_ms / 2;
                    self.play_with_fade_duration(Duration::from_millis(fade_in_ms))?;
                } else {
                    self.play_with_fade(true)?;
                }
                Ok(Some(item))
            }
            None => Ok(None),
        }
    }

    /// Ustawia tryb powtarzania (None, Track, Queue).
    pub fn set_loop_mode(&self, mode: LoopMode) {
        let mut q = self.queue.lock_safe();
        q.set_loop_mode(mode);
    }

    /// Pobiera aktualny tryb powtarzania.
    pub fn loop_mode(&self) -> LoopMode {
        let q = self.queue.lock_safe();
        q.loop_mode
    }

    /// Włącza lub wyłącza tryb odtwarzania losowego (Shuffle).
    pub fn set_shuffle(&self, enabled: bool) {
        let mut q = self.queue.lock_safe();
        q.set_shuffle(enabled);
    }

    /// Pobiera stan trybu odtwarzania losowego (Shuffle).
    pub fn shuffle(&self) -> bool {
        let q = self.queue.lock_safe();
        q.shuffle
    }

    /// Włącza lub wyłącza tryb "Stop After Current Track" (zatrzymanie po zakończeniu bieżącego utworu).
    pub fn set_stop_after_current(&self, enabled: bool) {
        self.stop_after_current.store(enabled, Ordering::SeqCst);
    }

    /// Pobiera aktualny stan flagi "Stop After Current Track".
    pub fn stop_after_current(&self) -> bool {
        self.stop_after_current.load(Ordering::SeqCst)
    }
}
