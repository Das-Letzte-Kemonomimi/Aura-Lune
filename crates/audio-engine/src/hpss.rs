//! Zaawansowany silnik separacji spektralnej Harmonic-Percussive (HPSS)
//! oraz dekompozycji panoramy stereo (Stereo Azimuth / Pan-based Separation).
//!
//! Zastępuje prymitywne filtry korektora (Biquad EQ Crossover) profesjonalną
//! analizą w dziedzinie częstotliwości i czasu (Short-Time Fourier Transform).
//! Gwarantuje zachowanie transjentów perkusyjnych (stopa, werbel, talerze)
//! w pełnym paśmie częstotliwości oraz matematyczną sumę 100% z sygnałem wejściowym.

use std::f32::consts::PI;

pub struct StereoStems {
    pub vocals: (Vec<f32>, Vec<f32>),
    pub drums: (Vec<f32>, Vec<f32>),
    pub bass: (Vec<f32>, Vec<f32>),
    pub other: (Vec<f32>, Vec<f32>),
}

/// Szybka transformata Fouriera Radix-2 (in-place Cooley-Tukey FFT / IFFT).
pub fn fft_radix2(real: &mut [f32], imag: &mut [f32], inverse: bool) {
    let n = real.len();
    assert!(n.is_power_of_two());

    // Permutacja bit-reversal
    let mut j = 0;
    for i in 0..n {
        if i < j {
            real.swap(i, j);
            imag.swap(i, j);
        }
        let mut bit = n >> 1;
        while j & bit != 0 {
            j ^= bit;
            bit >>= 1;
        }
        j ^= bit;
    }

    // Motylki Cooley-Tukey
    let sign = if inverse { 1.0 } else { -1.0 };
    let mut len = 2;
    while len <= n {
        let half_len = len / 2;
        let angle = sign * 2.0 * (PI as f64) / (len as f64);
        let w_step_re = angle.cos() as f32;
        let w_step_im = angle.sin() as f32;

        let mut i = 0;
        while i < n {
            let mut w_re = 1.0f32;
            let mut w_im = 0.0f32;
            for k in 0..half_len {
                let u_re = real[i + k];
                let u_im = imag[i + k];
                let v_re = real[i + k + half_len] * w_re - imag[i + k + half_len] * w_im;
                let v_im = real[i + k + half_len] * w_im + imag[i + k + half_len] * w_re;

                real[i + k] = u_re + v_re;
                imag[i + k] = u_im + v_im;
                real[i + k + half_len] = u_re - v_re;
                imag[i + k + half_len] = u_im - v_im;

                let next_w_re = w_re * w_step_re - w_im * w_step_im;
                let next_w_im = w_re * w_step_im + w_im * w_step_re;
                w_re = next_w_re;
                w_im = next_w_im;
            }
            i += len;
        }
        len <<= 1;
    }

    if inverse {
        let inv_n = 1.0 / (n as f32);
        for i in 0..n {
            real[i] *= inv_n;
            imag[i] *= inv_n;
        }
    }
}

/// Szybkie wyliczenie mediany dla małych wycinków.
#[inline]
fn quick_median(values: &mut [f32]) -> f32 {
    let len = values.len();
    if len == 0 {
        return 0.0;
    }
    if len == 1 {
        return values[0];
    }
    let mid = len / 2;
    values.select_nth_unstable_by(mid, |a, b| {
        a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal)
    });
    values[mid]
}

/// Widmo jednej ramki STFT obu kanałów (amplituda i faza dla `num_bins` binów).
struct StftFrame {
    mag_l: Vec<f32>,
    phase_l: Vec<f32>,
    mag_r: Vec<f32>,
    phase_r: Vec<f32>,
}

impl StftFrame {
    fn new(num_bins: usize) -> Self {
        Self {
            mag_l: vec![0.0; num_bins],
            phase_l: vec![0.0; num_bins],
            mag_r: vec![0.0; num_bins],
            phase_r: vec![0.0; num_bins],
        }
    }
}

/// Wielokrotnie używane bufory FFT (bez alokacji na ramkę).
struct FftScratch {
    re: Vec<f32>,
    im: Vec<f32>,
}

/// Amplituda i faza okienkowanego fragmentu `signal[offset..offset + fft_size]`.
fn analyze_channel(
    signal: &[f32],
    offset: usize,
    window: &[f32],
    fft: &mut FftScratch,
    mag: &mut [f32],
    phase: &mut [f32],
) {
    for (i, &w) in window.iter().enumerate() {
        fft.re[i] = signal[offset + i] * w;
        fft.im[i] = 0.0;
    }
    fft_radix2(&mut fft.re, &mut fft.im, false);
    for k in 0..mag.len() {
        let (re, im) = (fft.re[k], fft.im[k]);
        mag[k] = (re * re + im * im).sqrt();
        phase[k] = im.atan2(re);
    }
}

/// Wykonuje zaawansowaną separację spektralną HPSS i panoramy stereo na parze próbek L/R.
///
/// Mediana harmoniczna potrzebuje tylko ±`R_TIME` sąsiednich ramek, więc widmo jest liczone
/// w buforze pierścieniowym `2·R_TIME + 1` ramek, a każda ramka jest od razu maskowana i
/// syntetyzowana (overlap-add). Pamięć poza sygnałami wyjściowymi jest stała — wcześniej
/// 16 pełnych macierzy spektrogramu zajmowało ok. 1,7 GB dla 5-minutowego utworu.
pub fn separate_stereo_hpss<F>(
    left: &[f32],
    right: &[f32],
    sample_rate: u32,
    mut progress_cb: Option<&mut F>,
) -> StereoStems
where
    F: FnMut(f32, &str) + ?Sized,
{
    const FFT_SIZE: usize = 2048;
    const HOP_SIZE: usize = 512; // 75% overlap dla Hann window
                                 // Promień w czasie (harmoniczne): 7 ramek ≈ ±81 ms przy hop 512 i 44,1 kHz.
    const R_TIME: usize = 7;
    // Promień w częstotliwości (perkusja): 7 binów ≈ ±151 Hz przy 21,5 Hz/bin.
    const R_FREQ: usize = 7;
    const RING: usize = 2 * R_TIME + 1;
    const EPS: f32 = 1e-6;

    let n_samples = left.len().min(right.len());
    if n_samples < FFT_SIZE {
        // Fallback dla bardzo krótkich sygnałów
        return StereoStems {
            vocals: (left.to_vec(), right.to_vec()),
            drums: (vec![0.0; n_samples], vec![0.0; n_samples]),
            bass: (vec![0.0; n_samples], vec![0.0; n_samples]),
            other: (vec![0.0; n_samples], vec![0.0; n_samples]),
        };
    }

    let mut report = |p: f32, msg: &str| {
        if let Some(cb) = progress_cb.as_mut() {
            cb(p, msg);
        }
    };
    report(
        0.35,
        "STFT: Analiza czasowo-częstotliwościowa (Hann 2048/512)...",
    );

    let window: Vec<f32> = (0..FFT_SIZE)
        .map(|i| 0.5 * (1.0 - (2.0 * PI * (i as f32) / (FFT_SIZE as f32)).cos()))
        .collect();
    let num_frames = (n_samples - FFT_SIZE) / HOP_SIZE + 1;
    let num_bins = FFT_SIZE / 2 + 1;

    let hz_per_bin = (sample_rate as f32) / (FFT_SIZE as f32);
    let bass_cutoff_bin = ((220.0 / hz_per_bin).round() as usize).min(num_bins - 1);
    let vocal_low_bin = ((160.0 / hz_per_bin).round() as usize).min(num_bins - 1);
    let vocal_high_bin = ((7500.0 / hz_per_bin).round() as usize).min(num_bins - 1);

    let mut ring: Vec<StftFrame> = (0..RING.min(num_frames))
        .map(|_| StftFrame::new(num_bins))
        .collect();
    let mut fft = FftScratch {
        re: vec![0.0; FFT_SIZE],
        im: vec![0.0; FFT_SIZE],
    };
    let mut computed = 0usize; // liczba ramek już przeanalizowanych
    let mut scratch = Vec::with_capacity(2 * R_TIME.max(R_FREQ) + 1);

    // Widma stemów bieżącej ramki: [vocals, drums, bass, other] × [L, R].
    let mut stem_spec = vec![vec![0.0f32; num_bins]; 8];
    let mut rec: Vec<Vec<f32>> = (0..8).map(|_| vec![0.0f32; n_samples]).collect();
    let norm_factor = 1.5f32; // Suma kwadratów okna Hanna przy 75% overlap

    let mut next_report = 1usize;
    for f in 0..num_frames {
        // Doanalizuj ramki do f + R_TIME (nadpisuje sloty ramek < f - R_TIME, już niepotrzebne).
        let f_end = (f + R_TIME + 1).min(num_frames);
        while computed < f_end {
            let slot = &mut ring[computed % RING];
            let offset = computed * HOP_SIZE;
            analyze_channel(
                left,
                offset,
                &window,
                &mut fft,
                &mut slot.mag_l,
                &mut slot.phase_l,
            );
            analyze_channel(
                right,
                offset,
                &window,
                &mut fft,
                &mut slot.mag_r,
                &mut slot.phase_r,
            );
            computed += 1;
        }
        let f_start = f.saturating_sub(R_TIME);
        let cur = &ring[f % RING];

        for k in 0..num_bins {
            // Mediany: harmoniczna w czasie (poziomo), perkusyjna w częstotliwości (pionowo).
            let k_start = k.saturating_sub(R_FREQ);
            let k_end = (k + R_FREQ + 1).min(num_bins);
            scratch.clear();
            scratch.extend((f_start..f_end).map(|j| ring[j % RING].mag_l[k]));
            let h_l = quick_median(&mut scratch);
            scratch.clear();
            scratch.extend_from_slice(&cur.mag_l[k_start..k_end]);
            let p_l = quick_median(&mut scratch);
            scratch.clear();
            scratch.extend((f_start..f_end).map(|j| ring[j % RING].mag_r[k]));
            let h_r = quick_median(&mut scratch);
            scratch.clear();
            scratch.extend_from_slice(&cur.mag_r[k_start..k_end]);
            let p_r = quick_median(&mut scratch);

            let m_l = cur.mag_l[k];
            let m_r = cur.mag_r[k];

            // Maski Wienera HPSS (kwadraty dla wyrazistej separacji)
            let mask_perc_l = (p_l * p_l) / (p_l * p_l + h_l * h_l + EPS);
            let mask_harm_l = 1.0 - mask_perc_l;
            let mask_perc_r = (p_r * p_r) / (p_r * p_r + h_r * h_r + EPS);
            let mask_harm_r = 1.0 - mask_perc_r;

            // Panorama: 0.0 = idealny środek, 1.0 = skrajna panorama
            let diff = (m_l - m_r).abs();
            let sum = m_l + m_r + EPS;
            let pan_side = (diff / sum).min(1.0);
            let pan_center = (1.0 - 1.6 * pan_side).clamp(0.0, 1.0);

            // 1. DRUMS — wszystkie składowe perkusyjne w całym paśmie
            let drums_l = m_l * mask_perc_l;
            let drums_r = m_r * mask_perc_r;
            let rem_h_l = m_l * mask_harm_l;
            let rem_h_r = m_r * mask_harm_r;

            // 2. BASS — harmoniczne w centrum poniżej 220 Hz
            let (bass_l, bass_r) = if k <= bass_cutoff_bin {
                let bass_weight = (1.0 - (k as f32 / bass_cutoff_bin as f32).powi(2)).max(0.0);
                let bass_mask = bass_weight * (0.3 + 0.7 * pan_center);
                (rem_h_l * bass_mask, rem_h_r * bass_mask)
            } else {
                (0.0, 0.0)
            };

            // 3. VOCALS — harmoniczne w centrum w paśmie 160 Hz – 7,5 kHz
            let (vocals_l, vocals_r) = if k >= vocal_low_bin && k <= vocal_high_bin {
                let vocal_mask = pan_center.powf(1.2);
                (
                    (rem_h_l - bass_l) * vocal_mask,
                    (rem_h_r - bass_r) * vocal_mask,
                )
            } else {
                (0.0, 0.0)
            };

            // 4. OTHER — reszta (gitary, klawisze, syntezatory, pogłosy, chórki w panoramie)
            let other_l = (m_l - (drums_l + bass_l + vocals_l)).max(0.0);
            let other_r = (m_r - (drums_r + bass_r + vocals_r)).max(0.0);

            for (spec, v) in stem_spec.iter_mut().zip([
                vocals_l, vocals_r, drums_l, drums_r, bass_l, bass_r, other_l, other_r,
            ]) {
                spec[k] = v;
            }
        }

        // Rekonstrukcja ramki (ISTFT + overlap-add) dla wszystkich stemów.
        let offset = f * HOP_SIZE;
        for (i, (spec, out)) in stem_spec.iter().zip(rec.iter_mut()).enumerate() {
            let phase = if i % 2 == 0 {
                &cur.phase_l
            } else {
                &cur.phase_r
            };
            synth_frame(
                spec,
                phase,
                &window,
                norm_factor,
                &mut fft,
                &mut out[offset..offset + FFT_SIZE],
            );
        }

        // Postęp w tych samych etapach co wcześniej (mediany → maski → rekonstrukcja).
        if next_report <= 2 && f + 1 >= num_frames * next_report / 3 {
            if next_report == 1 {
                report(
                    0.50,
                    "HPSS: Filtracja medianowa (Harmoniczne vs Transjenty)...",
                );
            } else {
                report(
                    0.65,
                    "Separacja źródeł: Dekompozycja panoramy stereo i masek...",
                );
            }
            next_report += 1;
        }
    }

    report(
        0.80,
        "ISTFT: Rekonstrukcja Overlap-Add sygnału w pełnym stereo...",
    );

    let mut rec = rec.into_iter();
    let mut take = || rec.next().unwrap_or_default();
    let (vocals_l, vocals_r) = (take(), take());
    let (drums_l, drums_r) = (take(), take());
    let (bass_l, bass_r) = (take(), take());
    let (mut other_l, mut other_r) = (take(), take());

    // 5. Dokładna korekta residualna: suma stemów musi być równa oryginałowi
    for i in 0..n_samples {
        let sum_l = vocals_l[i] + drums_l[i] + bass_l[i] + other_l[i];
        other_l[i] = (other_l[i] + (left[i] - sum_l)).clamp(-1.0, 1.0);
        let sum_r = vocals_r[i] + drums_r[i] + bass_r[i] + other_r[i];
        other_r[i] = (other_r[i] + (right[i] - sum_r)).clamp(-1.0, 1.0);
    }

    StereoStems {
        vocals: (vocals_l, vocals_r),
        drums: (drums_l, drums_r),
        bass: (bass_l, bass_r),
        other: (other_l, other_r),
    }
}

/// Rekonstruuje pojedynczą ramkę FFT do dziedziny czasu z oknem syntezy (overlap-add do `out`).
#[inline]
fn synth_frame(
    mag: &[f32],
    phase: &[f32],
    window: &[f32],
    norm_factor: f32,
    fft: &mut FftScratch,
    out: &mut [f32],
) {
    let fft_size = window.len();
    let num_bins = mag.len();
    fft.re.fill(0.0);
    fft.im.fill(0.0);
    for k in 0..num_bins {
        let (re, im) = (mag[k] * phase[k].cos(), mag[k] * phase[k].sin());
        fft.re[k] = re;
        fft.im[k] = im;
        if k > 0 && k < num_bins - 1 {
            fft.re[fft_size - k] = re;
            fft.im[fft_size - k] = -im;
        }
    }
    fft_radix2(&mut fft.re, &mut fft.im, true);
    for i in 0..fft_size {
        out[i] += fft.re[i] * window[i] / norm_factor;
    }
}

#[cfg(test)]
#[path = "hpss_test.rs"]
mod tests;
