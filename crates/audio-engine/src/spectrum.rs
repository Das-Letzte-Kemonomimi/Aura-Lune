//! Przetwarzanie danych analizatora widma GStreamera (`spectrum`) na pasma wizualizacji.
//!
//! Czyste funkcje (bez GStreamera) — testowane w `tests/spectrum_test.rs`.

/// Dolna granica zakresu dynamiki wizualizacji (dBFS).
pub const SPECTRUM_FLOOR_DB: f32 = -75.0;
/// Liczba pasm na kanał emitowanych do interfejsu.
pub const DISPLAY_BANDS: usize = 16;

/// Normalizuje poziomy w dBFS (`SPECTRUM_FLOOR_DB..=0`) do zakresu `0.0..=1.0`.
pub fn normalize_db(db: &[f32]) -> Vec<f32> {
    db.iter()
        .map(|&v| ((v - SPECTRUM_FLOOR_DB) / -SPECTRUM_FLOOR_DB).clamp(0.0, 1.0))
        .collect()
}

/// Logarytmiczne grupowanie 64 liniowych pasm FFT na 16 percepcyjnych pasm widma.
/// Zapewnia równomierną i czułą dynamikę od sub-basu (30-60 Hz) do najwyższych tonów (16-20 kHz).
/// Krótsze wejście (< 16 pasm) jest zwracane bez zmian.
pub fn log_pool_to_16_bands(raw: &[f32]) -> Vec<f32> {
    if raw.len() < DISPLAY_BANDS {
        return raw.to_vec();
    }
    let bin_ranges: [(usize, usize); DISPLAY_BANDS] = [
        (0, 1),   // 0: Sub-bass (~0 - 344 Hz)
        (1, 2),   // 1: Bass (~344 - 688 Hz)
        (2, 3),   // 2: Low Mids (~688 - 1032 Hz)
        (3, 4),   // 3: Midrange (~1032 - 1376 Hz)
        (4, 5),   // 4: Midrange (~1376 - 1720 Hz)
        (5, 6),   // 5: Upper Mids (~1720 - 2064 Hz)
        (6, 7),   // 6: Upper Mids (~2064 - 2408 Hz)
        (7, 8),   // 7: Presence low (~2408 - 2752 Hz)
        (8, 10),  // 8: Presence (~2752 - 3440 Hz)
        (10, 12), // 9: Presence high (~3440 - 4128 Hz)
        (12, 15), // 10: Brilliance low (~4128 - 5160 Hz)
        (15, 19), // 11: Brilliance mid (~5160 - 6536 Hz)
        (19, 24), // 12: Brilliance high (~6536 - 8260 Hz)
        (24, 32), // 13: Treble (~8260 - 11000 Hz)
        (32, 44), // 14: High Treble (~11000 - 15100 Hz)
        (44, 64), // 15: Air (~15100 - 22050 Hz)
    ];

    bin_ranges
        .iter()
        .map(|&(start, end)| {
            // Dla wejścia krótszego niż 64 pasma zakresy są przycinane do jego długości.
            let s = start.min(raw.len() - 1);
            let e = end.min(raw.len()).max(s + 1);
            let slice = &raw[s..e];
            let max_val = slice.iter().copied().fold(0.0f32, f32::max);
            let avg_val = slice.iter().sum::<f32>() / slice.len() as f32;
            (max_val * 0.7 + avg_val * 0.3).clamp(0.0, 1.0)
        })
        .collect()
}

/// Pasma jednego kanału gotowe do wyświetlenia: normalizacja dB, a dla pełnego
/// 64-pasmowego FFT — grupowanie do [`DISPLAY_BANDS`].
pub fn channel_display_bands(db: &[f32]) -> Vec<f32> {
    let normalized = normalize_db(db);
    if normalized.len() >= 64 {
        log_pool_to_16_bands(&normalized)
    } else {
        normalized
    }
}

/// Buduje widmo stereo (pasma lewego kanału, następnie prawego) z magnitud analizatora.
///
/// - co najmniej dwa kanały → prawdziwe stereo (L + R),
/// - jeden kanał lub płaska lista → mono powielone na oba kanały,
/// - brak danych → `None`.
pub fn stereo_display_spectrum(channel_mags: &[Vec<f32>], flat_db: &[f32]) -> Option<Vec<f32>> {
    if let [left, right, ..] = channel_mags {
        let mut spectrum = channel_display_bands(left);
        spectrum.extend(channel_display_bands(right));
        return Some(spectrum);
    }
    let mono = channel_mags.first().map(Vec::as_slice).unwrap_or(flat_db);
    if mono.is_empty() {
        return None;
    }
    let bands = channel_display_bands(mono);
    let mut spectrum = bands.clone();
    spectrum.extend(bands);
    Some(spectrum)
}
