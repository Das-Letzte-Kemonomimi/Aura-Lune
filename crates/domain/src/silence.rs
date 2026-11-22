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
    if samples.is_empty() || sample_rate == 0 {
        return None;
    }
    let window = ((sample_rate as u64 * SILENCE_WINDOW_MS) / 1000).max(1) as usize;
    let threshold_rms = 10f64.powf(threshold_db / 20.0);
    let is_audible = |chunk: &[f32]| {
        let sum_sq: f64 = chunk.iter().map(|&s| (s as f64) * (s as f64)).sum();
        (sum_sq / chunk.len() as f64).sqrt() > threshold_rms
    };

    let chunks: Vec<&[f32]> = samples.chunks(window).collect();
    let first = chunks.iter().position(|c| is_audible(c))?;
    let last = chunks.iter().rposition(|c| is_audible(c))?;

    let to_ms = |sample_idx: usize| (sample_idx as u64 * 1000) / sample_rate as u64;
    let end_sample = (last * window + chunks[last].len()).min(samples.len());
    Some(SilenceBounds {
        start_ms: to_ms(first * window),
        end_ms: Some(to_ms(end_sample)),
    })
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
