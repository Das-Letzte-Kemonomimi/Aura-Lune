use serde::{Deserialize, Serialize};

/// Konfiguracja automatycznego pomijania ciszy (Silence Trimming / Auto-skip silence).
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct SilenceTrimmingConfig {
    /// Czy automatyczne pomijanie ciszy jest aktywne.
    pub enabled: bool,
    /// Próg poziomu głośności w dBFS, poniżej którego dźwięk uznawany jest za ciszę (-80.0 dB do -20.0 dB).
    pub threshold_db: f64,
}

impl Default for SilenceTrimmingConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            threshold_db: -50.0,
        }
    }
}

impl SilenceTrimmingConfig {
    pub fn clamped(mut self) -> Self {
        self.threshold_db = self.threshold_db.clamp(-80.0, -20.0);
        self
    }
}

/// Wykryte granice dźwięku w utworze (wszystko poza nimi to cisza).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct SilenceBounds {
    /// Początek pierwszego fragmentu powyżej progu (ms).
    pub start_ms: u64,
    /// Koniec ostatniego fragmentu powyżej progu (ms). `None`, gdy koniec utworu nie został
    /// przeanalizowany (np. dekodowanie przerwane) — wtedy cisza końcowa nie jest pomijana.
    pub end_ms: Option<u64>,
}

/// Długość okna RMS używanego do wykrywania ciszy.
pub const SILENCE_WINDOW_MS: u64 = 50;
/// Minimalna cisza na początku utworu, którą warto pominąć.
pub const MIN_LEADING_SILENCE_MS: u64 = 500;
/// Minimalna cisza na końcu utworu, którą warto pominąć.
pub const MIN_TRAILING_SILENCE_MS: u64 = 1_000;
/// Margines przed pierwszym dźwiękiem, aby nie uciąć ataku pierwszej nuty.
pub const LEADING_PREROLL_MS: u64 = 100;

/// Znajduje granice dźwięku w monofonicznych próbkach `f32` (zakres -1.0..=1.0).
///
/// Sygnał jest dzielony na okna po [`SILENCE_WINDOW_MS`]; okno jest „dźwiękiem”, gdy jego
/// poziom RMS w dBFS przekracza `threshold_db`. Zwraca `None`, gdy cały sygnał to cisza.
/// `end_ms` jest zawsze ustawione — o tym, czy analizę objęto cały utwór, decyduje wywołujący.
pub fn find_silence_bounds(
    samples: &[f32],
    sample_rate: u32,
    threshold_db: f64,
) -> Option<SilenceBounds> {
    let mut scanner = SilenceScanner::new(sample_rate, threshold_db);
    scanner.push(samples);
    scanner.finish()
}

/// Strumieniowa wersja [`find_silence_bounds`]: próbki podawane porcjami (np. prosto
/// z dekodera), pamięć stała — nie trzeba trzymać całego utworu.
#[derive(Debug, Clone)]
pub struct SilenceScanner {
    sample_rate: u32,
    window: usize,
    threshold_rms: f64,
    window_sum_sq: f64,
    window_len: usize,
    samples_seen: usize,
    first_audible_start: Option<usize>,
    last_audible_end: Option<usize>,
}

impl SilenceScanner {
    pub fn new(sample_rate: u32, threshold_db: f64) -> Self {
        let window = ((sample_rate as u64 * SILENCE_WINDOW_MS) / 1000).max(1) as usize;
        Self {
            sample_rate,
            window,
            threshold_rms: 10f64.powf(threshold_db / 20.0),
            window_sum_sq: 0.0,
            window_len: 0,
            samples_seen: 0,
            first_audible_start: None,
            last_audible_end: None,
        }
    }

    /// Dodaje kolejną porcję próbek.
    pub fn push(&mut self, samples: &[f32]) {
        for &s in samples {
            self.window_sum_sq += (s as f64) * (s as f64);
            self.window_len += 1;
            self.samples_seen += 1;
            if self.window_len == self.window {
                self.close_window();
            }
        }
    }

    /// Liczba dotychczas przetworzonych próbek.
    pub fn samples_seen(&self) -> usize {
        self.samples_seen
    }

    /// Kończy analizę (z niepełnym ostatnim oknem) i zwraca granice dźwięku.
    pub fn finish(mut self) -> Option<SilenceBounds> {
        if self.window_len > 0 {
            self.close_window();
        }
        if self.sample_rate == 0 {
            return None;
        }
        let first = self.first_audible_start?;
        let last_end = self.last_audible_end?;
        let to_ms = |sample_idx: usize| (sample_idx as u64 * 1000) / self.sample_rate as u64;
        Some(SilenceBounds {
            start_ms: to_ms(first),
            end_ms: Some(to_ms(last_end)),
        })
    }

    fn close_window(&mut self) {
        let rms = (self.window_sum_sq / self.window_len as f64).sqrt();
        if rms > self.threshold_rms {
            let start = self.samples_seen - self.window_len;
            self.first_audible_start.get_or_insert(start);
            self.last_audible_end = Some(self.samples_seen);
        }
        self.window_sum_sq = 0.0;
        self.window_len = 0;
    }
}

/// Działanie, które odtwarzacz powinien wykonać w ramach pomijania ciszy.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrimAction {
    /// Przewiń do podanej pozycji (pominięcie ciszy na początku).
    SeekTo(u64),
    /// Zakończ utwór (pominięcie ciszy na końcu).
    FinishTrack,
}

/// Decyduje, czy w bieżącym momencie odtwarzania pominąć ciszę.
///
/// - Cisza początkowa jest pomijana tylko raz na utwór (`leading_done`) i tylko na samym
///   początku odtwarzania — ręczne przewinięcie w ciszę później nie jest „poprawiane”.
/// - Cisza końcowa jest pomijana po osiągnięciu `end_ms`, jeśli jest dostatecznie długa.
pub fn trim_action(
    position_ms: u64,
    duration_ms: u64,
    bounds: &SilenceBounds,
    leading_done: bool,
) -> Option<TrimAction> {
    if !leading_done
        && bounds.start_ms >= MIN_LEADING_SILENCE_MS
        && position_ms + LEADING_PREROLL_MS < bounds.start_ms
        && position_ms < MIN_LEADING_SILENCE_MS
    {
        return Some(TrimAction::SeekTo(bounds.start_ms - LEADING_PREROLL_MS));
    }
    if let Some(end_ms) = bounds.end_ms {
        let trailing = duration_ms.saturating_sub(end_ms);
        if duration_ms > 0 && trailing >= MIN_TRAILING_SILENCE_MS && position_ms >= end_ms {
            return Some(TrimAction::FinishTrack);
        }
    }
    None
}
