//! Siatka uderzeń: faza z histogramu onsetów, pozycja pierwszego uderzenia taktu (4/4)
//! oraz lokalna korekta fazy każdego taktu (łapie dryf wynikający z niedokładnego BPM).

use super::BeatPoint;

/// Długość kroku obwiedni onsetów w próbkach (≈11,6 ms przy 22,05 kHz).
const ONSET_HOP: usize = 256;
/// Fragment początku utworu używany do wyznaczenia początkowej fazy i pierwszego uderzenia taktu.
const PHASE_SEARCH_SECONDS: f64 = 30.0;
/// Okno przyciągania uderzenia taktu do piku onsetu, jako ułamek długości uderzenia.
const SNAP_WINDOW_FRACTION: f64 = 0.10;
/// Jaką część różnicy (pik − przewidywanie) stosujemy przy korekcie fazy.
const SNAP_DAMPING: f64 = 0.5;
/// Pik musi przekraczać średnią obwiedni w sąsiedztwie tyle razy, by uznać go za uderzenie.
const SNAP_MIN_PEAK_RATIO: f64 = 1.5;
/// Metrum – siatka zawsze jest 4/4.
const BEATS_PER_BAR: usize = 4;

/// Obwiednia onsetów: dodatnia różnica logarytmu energii kolejnych kroków.
fn onset_envelope(samples: &[f32]) -> Vec<f64> {
    let mut flux = Vec::with_capacity(samples.len() / ONSET_HOP);
    let mut prev = 0.0f64;
    for chunk in samples.as_chunks::<ONSET_HOP>().0 {
        let energy = chunk.iter().map(|&s| (s as f64) * (s as f64)).sum::<f64>() / ONSET_HOP as f64;
        let level = (1.0 + 1e4 * energy).ln();
        flux.push((level - prev).max(0.0));
        prev = level;
    }
    flux
}

/// Wyznacza siatkę uderzeń (4/4) na podstawie próbek audio i tempa BPM.
///
/// Okres uderzenia jest liczony w `f64` i zaokrąglany dopiero przy zapisie milisekund.
pub fn extract_beat_grid(samples: &[f32], sample_rate: f64, bpm: f64) -> Vec<BeatPoint> {
    if samples.is_empty() || !(10.0..=400.0).contains(&bpm) {
        return Vec::new();
    }
    let period = 60.0 / bpm;
    let total_sec = samples.len() as f64 / sample_rate;
    let hop_sec = ONSET_HOP as f64 / sample_rate;
    let flux = onset_envelope(samples);

    let offset = initial_phase(&flux, hop_sec, period);
    let downbeat = first_downbeat(&flux, hop_sec, period, offset, total_sec);

    let mut grid = Vec::new();
    let mut shift = 0.0f64;
    let mut index = 0usize;
    loop {
        let nominal = offset + index as f64 * period;
        if nominal + shift >= total_sec {
            break;
        }
        let beat_in_bar = (index + BEATS_PER_BAR - downbeat) % BEATS_PER_BAR;
        if beat_in_bar == 0 {
            let predicted = nominal + shift;
            if let Some(peak) = snap_to_onset(&flux, hop_sec, period, predicted) {
                shift += SNAP_DAMPING * (peak - predicted);
            }
        }
        let time_sec = (nominal + shift).max(0.0);
        grid.push(BeatPoint {
            time_ms: (time_sec * 1000.0).round() as u64,
            beat_number: beat_in_bar as u32 + 1,
            is_downbeat: beat_in_bar == 0,
        });
        index += 1;
    }
    grid
}

/// Faza (sekundy od początku, `[0, period)`) – maksimum wygładzonego histogramu onsetów
/// zwiniętych modulo okres uderzenia, z początku utworu.
fn initial_phase(flux: &[f64], hop_sec: f64, period: f64) -> f64 {
    let bins = ((period / hop_sec).round() as usize).max(8);
    let limit = ((PHASE_SEARCH_SECONDS / hop_sec) as usize).min(flux.len());
    let mut hist = vec![0.0f64; bins];
    for (h, &f) in flux[..limit].iter().enumerate() {
        if f <= 0.0 {
            continue;
        }
        let phase = (h as f64 * hop_sec) % period / period;
        hist[((phase * bins as f64) as usize).min(bins - 1)] += f;
    }
    let smoothed: Vec<f64> = (0..bins)
        .map(|i| hist[(i + bins - 1) % bins] + 2.0 * hist[i] + hist[(i + 1) % bins])
        .collect();
    let best = smoothed
        .iter()
        .enumerate()
        .fold((0usize, f64::NEG_INFINITY), |acc, (i, &v)| {
            if v > acc.1 {
                (i, v)
            } else {
                acc
            }
        })
        .0;
    (best as f64 + 0.5) / bins as f64 * period
}

/// Który z czterech kolejnych uderzeń ma największą sumę onsetów – to pierwsze uderzenie taktu.
fn first_downbeat(flux: &[f64], hop_sec: f64, period: f64, offset: f64, total_sec: f64) -> usize {
    let mut strength = [0.0f64; BEATS_PER_BAR];
    let limit = total_sec.min(PHASE_SEARCH_SECONDS * 2.0);
    let mut index = 0usize;
    loop {
        let t = offset + index as f64 * period;
        if t >= limit {
            break;
        }
        let h = (t / hop_sec) as usize;
        let around = &flux[h.saturating_sub(1)..(h + 2).min(flux.len())];
        strength[index % BEATS_PER_BAR] += around.iter().copied().fold(0.0, f64::max);
        index += 1;
    }
    strength
        .iter()
        .enumerate()
        .fold((0usize, f64::NEG_INFINITY), |acc, (i, &v)| {
            if v > acc.1 + 1e-9 {
                (i, v)
            } else {
                acc
            }
        })
        .0
}

/// Czas (s) piku onsetu w ±10% uderzenia wokół `predicted`, o ile wyraźnie wystaje.
fn snap_to_onset(flux: &[f64], hop_sec: f64, period: f64, predicted: f64) -> Option<f64> {
    let half = (SNAP_WINDOW_FRACTION * period / hop_sec).ceil() as i64;
    let center = (predicted / hop_sec).round() as i64;
    let lo = (center - half).max(0) as usize;
    let hi = ((center + half) as usize).min(flux.len().saturating_sub(1));
    if lo >= hi {
        return None;
    }
    let (best_h, best) = (lo..=hi).fold((lo, 0.0f64), |acc, h| {
        if flux[h] > acc.1 {
            (h, flux[h])
        } else {
            acc
        }
    });
    let ctx_half = (0.5 * period / hop_sec) as usize;
    let ctx_lo = (center.max(0) as usize).saturating_sub(ctx_half);
    let ctx_hi = ((center.max(0) as usize) + ctx_half).min(flux.len());
    if ctx_lo >= ctx_hi {
        return None;
    }
    let mean = flux[ctx_lo..ctx_hi].iter().sum::<f64>() / (ctx_hi - ctx_lo) as f64;
    if best <= 0.0 || best < SNAP_MIN_PEAK_RATIO * mean {
        return None;
    }
    Some(best_h as f64 * hop_sec)
}
