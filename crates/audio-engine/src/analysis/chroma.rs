//! Chromagram: okienkowane FFT, szczyty widma z interpolacją paraboliczną, globalny strój,
//! kompresja logarytmiczna i lekkie tłumienie alikwotów.
//!
//! Wejściem są próbki mono; wyjściem wektory 12 klas wysokości dźwięku na ramkę STFT. Wektory
//! ramek są później agregowane medianą w obrębie uderzenia (zob. [`StftChroma::beat_chroma`]).

use crate::hpss::fft_radix2;
use std::f64::consts::PI;

/// Rozmiar okna STFT (≈186 ms przy 22,05 kHz).
pub const CHROMA_FFT_SIZE: usize = 4096;
/// Przesunięcie okna STFT (50% nakładania).
pub const CHROMA_HOP: usize = 2048;
/// Najniższy uwzględniany dźwięk (MIDI 38 = D2); niżej rozdzielczość FFT jest za mała.
const MIDI_LOW: f64 = 38.0;
/// Najwyższy uwzględniany dźwięk (MIDI 96 = C7).
const MIDI_HIGH: f64 = 96.0;
/// Szczyt musi mieć co najmniej taki ułamek największego szczytu ramki (≈ −30 dB).
const PEAK_REL_THRESHOLD: f32 = 0.03;
/// Siła kompresji logarytmicznej `ln(1 + γ·mag/max)`.
const LOG_COMPRESSION_GAMMA: f64 = 50.0;
/// Ułamek energii podstawy odejmowany od 3. i 5. alikwotu.
const PARTIAL3_SUPPRESSION: f64 = 0.25;
const PARTIAL5_SUPPRESSION: f64 = 0.12;
/// Poniżej tej wysokości (MIDI) waga basu rośnie liniowo od 0,15 do 1.
const BASS_FULL_WEIGHT_MIDI: f64 = 55.0;
/// Powyżej tej wysokości (MIDI) waga maleje do 0,5 przy `MIDI_HIGH`.
const TREBLE_ROLLOFF_MIDI: f64 = 84.0;
/// Minimalna energia (po zsumowaniu), poniżej której wektor chromatyczny uznajemy za zerowy.
const MIN_CHROMA_NORM: f64 = 1e-5;

/// Szczyt widma: wysokość w półtonach MIDI (ułamkowa) i waga.
type Peak = (f64, f64);

/// Szczyty jednej ramki wraz z jej energią (RMS) sprzed okienkowania.
#[derive(Debug, Clone, Default)]
pub(super) struct FramePeaks {
    pub rms: f64,
    pub peaks: Vec<Peak>,
}

/// Analizator pojedynczych ramek z powtórnie używanymi buforami FFT.
pub(super) struct PeakAnalyzer {
    size: usize,
    window: Vec<f32>,
    re: Vec<f32>,
    im: Vec<f32>,
    mags: Vec<f32>,
}

impl PeakAnalyzer {
    /// `size` – rozmiar FFT (potęga dwójki), `win_len` – długość okna Hanninga (≤ `size`).
    pub(super) fn new(size: usize, win_len: usize) -> Self {
        let win_len = win_len.clamp(2, size);
        let window = (0..win_len)
            .map(|i| (0.5 - 0.5 * (2.0 * PI * i as f64 / win_len as f64).cos()) as f32)
            .collect();
        Self {
            size,
            window,
            re: vec![0.0; size],
            im: vec![0.0; size],
            mags: vec![0.0; size / 2],
        }
    }

    pub(super) fn analyze(&mut self, frame: &[f32], sample_rate: f64) -> FramePeaks {
        let n = frame.len().min(self.window.len());
        if n < 2 {
            return FramePeaks::default();
        }
        let rms = (frame[..n]
            .iter()
            .map(|&s| (s as f64) * (s as f64))
            .sum::<f64>()
            / n as f64)
            .sqrt();

        self.re.fill(0.0);
        self.im.fill(0.0);
        for ((re, &s), &w) in self.re.iter_mut().zip(&frame[..n]).zip(&self.window) {
            *re = s * w;
        }
        fft_radix2(&mut self.re, &mut self.im, false);
        let half = self.size / 2;
        for k in 0..half {
            self.mags[k] = (self.re[k] * self.re[k] + self.im[k] * self.im[k]).sqrt();
        }

        let bin_hz = sample_rate / self.size as f64;
        let k_min = ((midi_to_hz(MIDI_LOW) / bin_hz).floor() as usize).max(2);
        let k_max = ((midi_to_hz(MIDI_HIGH) / bin_hz).ceil() as usize).min(half.saturating_sub(2));
        if k_min >= k_max {
            return FramePeaks {
                rms,
                peaks: Vec::new(),
            };
        }
        let max_mag = self.mags[k_min..=k_max]
            .iter()
            .copied()
            .fold(0.0f32, f32::max);
        if max_mag < 1e-9 {
            return FramePeaks {
                rms,
                peaks: Vec::new(),
            };
        }

        let mut peaks: Vec<Peak> = Vec::new();
        for k in k_min..=k_max {
            let m = self.mags[k];
            let is_peak = m > self.mags[k - 1] && m >= self.mags[k + 1];
            if !is_peak || m < PEAK_REL_THRESHOLD * max_mag {
                continue;
            }
            let (a, b, c) = (
                (self.mags[k - 1] + 1e-12).ln() as f64,
                (m + 1e-12).ln() as f64,
                (self.mags[k + 1] + 1e-12).ln() as f64,
            );
            let denom = a - 2.0 * b + c;
            let delta = if denom.abs() > 1e-12 {
                (0.5 * (a - c) / denom).clamp(-0.5, 0.5)
            } else {
                0.0
            };
            let midi = hz_to_midi((k as f64 + delta) * bin_hz);
            if !(MIDI_LOW..=MIDI_HIGH).contains(&midi) {
                continue;
            }
            let weight =
                (1.0 + LOG_COMPRESSION_GAMMA * (m / max_mag) as f64).ln() * register_weight(midi);
            peaks.push((midi, weight));
        }
        suppress_harmonics(&mut peaks);
        FramePeaks { rms, peaks }
    }
}

fn midi_to_hz(midi: f64) -> f64 {
    440.0 * 2.0f64.powf((midi - 69.0) / 12.0)
}

fn hz_to_midi(hz: f64) -> f64 {
    69.0 + 12.0 * (hz / 440.0).log2()
}

/// Atenuacja basu (słabo rozdzielany przez FFT i zdominowany przez podstawy) oraz wysokich tonów.
fn register_weight(midi: f64) -> f64 {
    if midi < BASS_FULL_WEIGHT_MIDI {
        let t = ((midi - MIDI_LOW) / (BASS_FULL_WEIGHT_MIDI - MIDI_LOW)).clamp(0.0, 1.0);
        return 0.15 + 0.85 * t;
    }
    if midi > TREBLE_ROLLOFF_MIDI {
        let t = ((midi - TREBLE_ROLLOFF_MIDI) / (MIDI_HIGH - TREBLE_ROLLOFF_MIDI)).clamp(0.0, 1.0);
        return 1.0 - 0.5 * t;
    }
    1.0
}

/// Odejmuje część energii podstawy od jej 3. i 5. alikwotu (szczyty są posortowane rosnąco).
fn suppress_harmonics(peaks: &mut [Peak]) {
    const TOLERANCE: f64 = 0.4;
    // 12·log2(3) i 12·log2(5) półtonów ponad podstawą.
    const PARTIALS: [(f64, f64); 2] = [
        (19.019_550_008_653_875, PARTIAL3_SUPPRESSION),
        (27.863_137_138_648_348, PARTIAL5_SUPPRESSION),
    ];
    for i in 0..peaks.len() {
        let (midi, weight) = peaks[i];
        if weight <= 0.0 {
            continue;
        }
        for (offset, beta) in PARTIALS {
            let target = midi + offset;
            for peak in peaks[i + 1..].iter_mut() {
                if peak.0 > target + TOLERANCE {
                    break;
                }
                if peak.0 >= target - TOLERANCE {
                    peak.1 = (peak.1 - beta * weight).max(0.0);
                }
            }
        }
    }
}

/// Globalne odstrojenie (w półtonach, `[-0.5, 0.5]`) jako ważona średnia kołowa odchyleń
/// szczytów od najbliższego półtonu.
pub(super) fn estimate_tuning<'a>(frames: impl IntoIterator<Item = &'a FramePeaks>) -> f64 {
    let (mut sin_sum, mut cos_sum) = (0.0f64, 0.0f64);
    for frame in frames {
        for &(midi, weight) in &frame.peaks {
            if midi < 48.0 || weight <= 0.0 {
                continue;
            }
            let angle = 2.0 * PI * (midi - midi.round());
            sin_sum += weight * angle.sin();
            cos_sum += weight * angle.cos();
        }
    }
    if sin_sum.hypot(cos_sum) < 1e-9 {
        return 0.0;
    }
    sin_sum.atan2(cos_sum) / (2.0 * PI)
}

/// Składa nieznormalizowany wektor chromatyczny ze szczytów po korekcie strojenia.
pub(super) fn chroma_from_peaks(peaks: &[Peak], tuning: f64) -> [f64; 12] {
    let mut chroma = [0.0f64; 12];
    for &(midi, weight) in peaks {
        let pitch_class = ((midi - tuning).round() as i64).rem_euclid(12) as usize;
        chroma[pitch_class] += weight;
    }
    chroma
}

/// Normalizacja L2; zwraca `false` (i zeruje wektor), gdy energia jest znikoma.
pub(super) fn normalize_chroma(chroma: &mut [f64; 12]) -> bool {
    let norm = chroma.iter().map(|&v| v * v).sum::<f64>().sqrt();
    if norm <= MIN_CHROMA_NORM {
        *chroma = [0.0; 12];
        return false;
    }
    for v in chroma.iter_mut() {
        *v /= norm;
    }
    true
}

/// Ekstrahuje wektor chromagramu (12 klas wysokości dźwięku, norma L2) dla pojedynczej ramki PCM:
/// okno Hanninga, FFT, szczyty widma z kompresją logarytmiczną, tłumienie alikwotów i strój
/// estymowany z samej ramki.
pub fn extract_chroma_frame(frame: &[f32], sample_rate: f64) -> [f64; 12] {
    if frame.len() < 128 {
        return [0.0; 12];
    }
    let size = frame.len().next_power_of_two().clamp(256, 8192);
    let mut analyzer = PeakAnalyzer::new(size, frame.len().min(size));
    let analyzed = analyzer.analyze(frame, sample_rate);
    let tuning = estimate_tuning(std::iter::once(&analyzed));
    let mut chroma = chroma_from_peaks(&analyzed.peaks, tuning);
    normalize_chroma(&mut chroma);
    chroma
}

/// Chromagram całego utworu: ramki STFT (znormalizowane L2) z czasem środka i energią RMS.
pub(super) struct StftChroma {
    /// Czas środka ramki w ms.
    pub times_ms: Vec<f64>,
    pub chroma: Vec<[f64; 12]>,
    pub rms: Vec<f64>,
    /// Globalne odstrojenie użyte do złożenia chromagramu (półtony).
    pub tuning: f64,
}

impl StftChroma {
    pub(super) fn compute(samples: &[f32], sample_rate: f64) -> Self {
        let mut out = Self {
            times_ms: Vec::new(),
            chroma: Vec::new(),
            rms: Vec::new(),
            tuning: 0.0,
        };
        if samples.len() < CHROMA_FFT_SIZE {
            return out;
        }
        let mut analyzer = PeakAnalyzer::new(CHROMA_FFT_SIZE, CHROMA_FFT_SIZE);
        let num_frames = (samples.len() - CHROMA_FFT_SIZE) / CHROMA_HOP + 1;
        let mut frames = Vec::with_capacity(num_frames);
        for f in 0..num_frames {
            let start = f * CHROMA_HOP;
            frames.push(analyzer.analyze(&samples[start..start + CHROMA_FFT_SIZE], sample_rate));
            out.times_ms
                .push((start + CHROMA_FFT_SIZE / 2) as f64 / sample_rate * 1000.0);
        }
        out.tuning = estimate_tuning(&frames);
        for frame in &frames {
            let mut chroma = chroma_from_peaks(&frame.peaks, out.tuning);
            normalize_chroma(&mut chroma);
            out.chroma.push(chroma);
            out.rms.push(frame.rms);
        }
        out
    }

    /// Mediana wektorów chromatycznych ramek, których środek leży w `[start_ms, end_ms)`
    /// (gdy brak takich ramek – najbliższa ramka), znormalizowana L2, oraz mediana RMS.
    pub(super) fn beat_chroma(&self, start_ms: f64, end_ms: f64) -> ([f64; 12], f64) {
        if self.times_ms.is_empty() {
            return ([0.0; 12], 0.0);
        }
        let lo = self.times_ms.partition_point(|&t| t < start_ms);
        let hi = self.times_ms.partition_point(|&t| t < end_ms);
        let (lo, hi) = if lo < hi {
            (lo, hi)
        } else {
            let nearest = lo.min(self.times_ms.len() - 1);
            (nearest, nearest + 1)
        };

        let mut chroma = [0.0f64; 12];
        let mut column = Vec::with_capacity(hi - lo);
        for (pc, slot) in chroma.iter_mut().enumerate() {
            column.clear();
            column.extend(self.chroma[lo..hi].iter().map(|c| c[pc]));
            *slot = median(&mut column);
        }
        let mut rms_values: Vec<f64> = self.rms[lo..hi].to_vec();
        let rms = median(&mut rms_values);
        normalize_chroma(&mut chroma);
        (chroma, rms)
    }
}

/// Mediana (modyfikuje kolejność elementów); 0 dla pustego wejścia.
pub(super) fn median(values: &mut [f64]) -> f64 {
    if values.is_empty() {
        return 0.0;
    }
    values.sort_by(|a, b| a.total_cmp(b));
    let mid = values.len() / 2;
    if values.len() % 2 == 1 {
        values[mid]
    } else {
        0.5 * (values[mid - 1] + values[mid])
    }
}
