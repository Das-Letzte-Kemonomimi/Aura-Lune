//! Spectral Harmonic-Percussive source separation (HPSS)
//! combined with stereo panorama decomposition (stereo azimuth / pan-based separation).
//!
//! Replaces simple crossover filters (biquad EQ crossover) with analysis
//! in the time-frequency domain (short-time Fourier transform).
//! Keeps percussive transients (kick, snare, cymbals) across the full
//! frequency range, and the stems always sum to exactly 100% of the input.

use std::f32::consts::PI;

pub struct StereoStems {
    pub vocals: (Vec<f32>, Vec<f32>),
    pub drums: (Vec<f32>, Vec<f32>),
    pub bass: (Vec<f32>, Vec<f32>),
    pub other: (Vec<f32>, Vec<f32>),
}

/// Radix-2 fast Fourier transform (in-place Cooley-Tukey FFT / IFFT).
pub fn fft_radix2(real: &mut [f32], imag: &mut [f32], inverse: bool) {
    let n = real.len();
    assert!(n.is_power_of_two());

    // Bit-reversal permutation
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

    // Cooley-Tukey butterflies
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

/// Fast median for small slices.
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

/// Spectrum of one STFT channel: the complex bins and their magnitudes (`num_bins` each).
struct ChannelSpectrum {
    re: Vec<f32>,
    im: Vec<f32>,
    mag: Vec<f32>,
}

impl ChannelSpectrum {
    fn new(num_bins: usize) -> Self {
        Self {
            re: vec![0.0; num_bins],
            im: vec![0.0; num_bins],
            mag: vec![0.0; num_bins],
        }
    }
}

/// Spectrum of one STFT frame for both channels.
struct StftFrame {
    l: ChannelSpectrum,
    r: ChannelSpectrum,
}

impl StftFrame {
    fn new(num_bins: usize) -> Self {
        Self {
            l: ChannelSpectrum::new(num_bins),
            r: ChannelSpectrum::new(num_bins),
        }
    }
}

/// Reusable FFT buffers (no per-frame allocation).
struct FftScratch {
    re: Vec<f32>,
    im: Vec<f32>,
}

/// Spectrum (complex bins and magnitudes) of the windowed slice `signal[offset..offset + fft_size]`.
fn analyze_channel(
    signal: &[f32],
    offset: usize,
    window: &[f32],
    fft: &mut FftScratch,
    out: &mut ChannelSpectrum,
) {
    for (i, &w) in window.iter().enumerate() {
        fft.re[i] = signal[offset + i] * w;
        fft.im[i] = 0.0;
    }
    fft_radix2(&mut fft.re, &mut fft.im, false);
    let num_bins = out.mag.len();
    out.re.copy_from_slice(&fft.re[..num_bins]);
    out.im.copy_from_slice(&fft.im[..num_bins]);
    for (mag, (&re, &im)) in out.mag.iter_mut().zip(out.re.iter().zip(&out.im)) {
        *mag = (re * re + im * im).sqrt();
    }
}

/// Runs the HPSS and stereo-panorama separation on a pair of L/R sample buffers.
///
/// Takes the input by value: "other" is computed in place in the input buffers, so the input is
/// never held next to all eight output signals.
///
/// The harmonic median needs only ±`R_TIME` neighbouring frames, so the spectrum is computed
/// into a ring buffer of `2·R_TIME + 1` frames, and every frame is masked and
/// resynthesised right away (overlap-add). Memory beyond the output signals is constant; previously
/// 16 full spectrogram matrices took about 1.7 GB for a 5-minute track.
///
/// Every stem is a real-valued mask applied to the mixture spectrum, so it is resynthesised as
/// `gain · X` (no `atan2` / `sin` / `cos` round trip through polar form). "Other" is the exact
/// residual `input − vocals − drums − bass` in the time domain, so it needs no ISTFT of its own
/// and the four stems always sum to the input.
pub fn separate_stereo_hpss<F>(
    mut left: Vec<f32>,
    mut right: Vec<f32>,
    sample_rate: u32,
    mut progress_cb: Option<&mut F>,
) -> StereoStems
where
    F: FnMut(f32, &str) + ?Sized,
{
    const FFT_SIZE: usize = 2048;
    const HOP_SIZE: usize = 512; // 75% overlap for the Hann window
                                 // Time radius (harmonics): 7 frames ≈ ±81 ms at hop 512 and 44.1 kHz.
    const R_TIME: usize = 7;
    // Frequency radius (percussion): 7 bins ≈ ±151 Hz at 21.5 Hz/bin.
    const R_FREQ: usize = 7;
    const RING: usize = 2 * R_TIME + 1;
    const EPS: f32 = 1e-6;

    let n_samples = left.len().min(right.len());
    if n_samples < FFT_SIZE {
        // Fallback for very short signals
        return StereoStems {
            vocals: (left, right),
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
    report(0.35, "STFT: time-frequency analysis (Hann 2048/512)...");

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
    let mut computed = 0usize; // number of frames already analysed
    let mut scratch = Vec::with_capacity(2 * R_TIME.max(R_FREQ) + 1);

    // Per-bin spectral gains of the current frame: [vocals, drums, bass] × [L, R].
    let mut stem_gain = vec![vec![0.0f32; num_bins]; 6];
    let mut rec: Vec<Vec<f32>> = (0..6).map(|_| vec![0.0f32; n_samples]).collect();
    let norm_factor = 1.5f32; // Sum of squares of the Hann window at 75% overlap

    let mut next_report = 1usize;
    for f in 0..num_frames {
        // Analyse frames up to f + R_TIME (overwrites the slots of frames < f - R_TIME, no longer needed).
        let f_end = (f + R_TIME + 1).min(num_frames);
        while computed < f_end {
            let slot = &mut ring[computed % RING];
            let offset = computed * HOP_SIZE;
            analyze_channel(&left, offset, &window, &mut fft, &mut slot.l);
            analyze_channel(&right, offset, &window, &mut fft, &mut slot.r);
            computed += 1;
        }
        let f_start = f.saturating_sub(R_TIME);
        let cur = &ring[f % RING];

        for k in 0..num_bins {
            // Medians: harmonic along time (horizontal), percussive along frequency (vertical).
            let k_start = k.saturating_sub(R_FREQ);
            let k_end = (k + R_FREQ + 1).min(num_bins);
            scratch.clear();
            scratch.extend((f_start..f_end).map(|j| ring[j % RING].l.mag[k]));
            let h_l = quick_median(&mut scratch);
            scratch.clear();
            scratch.extend_from_slice(&cur.l.mag[k_start..k_end]);
            let p_l = quick_median(&mut scratch);
            scratch.clear();
            scratch.extend((f_start..f_end).map(|j| ring[j % RING].r.mag[k]));
            let h_r = quick_median(&mut scratch);
            scratch.clear();
            scratch.extend_from_slice(&cur.r.mag[k_start..k_end]);
            let p_r = quick_median(&mut scratch);

            let m_l = cur.l.mag[k];
            let m_r = cur.r.mag[k];

            // HPSS Wiener masks (squared for a crisper separation)
            let mask_perc_l = (p_l * p_l) / (p_l * p_l + h_l * h_l + EPS);
            let mask_harm_l = 1.0 - mask_perc_l;
            let mask_perc_r = (p_r * p_r) / (p_r * p_r + h_r * h_r + EPS);
            let mask_harm_r = 1.0 - mask_perc_r;

            // Panorama: 0.0 = dead centre, 1.0 = hard-panned
            let diff = (m_l - m_r).abs();
            let sum = m_l + m_r + EPS;
            let pan_side = (diff / sum).min(1.0);
            let pan_center = (1.0 - 1.6 * pan_side).clamp(0.0, 1.0);

            // Each stem's magnitude is `m × gain`; the gains below are those masks without `m`.
            // 1. DRUMS: every percussive component across the full range
            let (drums_l, drums_r) = (mask_perc_l, mask_perc_r);

            // 2. BASS: centred harmonics below 220 Hz
            let (bass_l, bass_r) = if k <= bass_cutoff_bin {
                let bass_weight = (1.0 - (k as f32 / bass_cutoff_bin as f32).powi(2)).max(0.0);
                let bass_mask = bass_weight * (0.3 + 0.7 * pan_center);
                (mask_harm_l * bass_mask, mask_harm_r * bass_mask)
            } else {
                (0.0, 0.0)
            };

            // 3. VOCALS: centred harmonics in the 160 Hz – 7.5 kHz band
            let (vocals_l, vocals_r) = if k >= vocal_low_bin && k <= vocal_high_bin {
                let vocal_mask = pan_center.powf(1.2);
                (
                    (mask_harm_l - bass_l) * vocal_mask,
                    (mask_harm_r - bass_r) * vocal_mask,
                )
            } else {
                (0.0, 0.0)
            };

            // 4. OTHER (guitars, keys, synths, reverb, panned backing vocals) is the time-domain
            // residual below.
            for (gain, v) in stem_gain
                .iter_mut()
                .zip([vocals_l, vocals_r, drums_l, drums_r, bass_l, bass_r])
            {
                gain[k] = v;
            }
        }

        // Frame reconstruction (ISTFT + overlap-add) for every stem.
        let offset = f * HOP_SIZE;
        for (i, (gain, out)) in stem_gain.iter().zip(rec.iter_mut()).enumerate() {
            let spectrum = if i % 2 == 0 { &cur.l } else { &cur.r };
            synth_frame(
                gain,
                spectrum,
                &window,
                norm_factor,
                &mut fft,
                &mut out[offset..offset + FFT_SIZE],
            );
        }

        // Progress uses the same stages as before (medians → masks → reconstruction).
        if next_report <= 2 && f + 1 >= num_frames * next_report / 3 {
            if next_report == 1 {
                report(0.50, "HPSS: median filtering (harmonics vs transients)...");
            } else {
                report(
                    0.65,
                    "Source separation: stereo panorama and mask decomposition...",
                );
            }
            next_report += 1;
        }
    }

    report(
        0.80,
        "ISTFT: overlap-add reconstruction of the full stereo signal...",
    );

    let mut rec = rec.into_iter();
    let mut take = || rec.next().unwrap_or_default();
    let (vocals_l, vocals_r) = (take(), take());
    let (drums_l, drums_r) = (take(), take());
    let (bass_l, bass_r) = (take(), take());

    // 5. OTHER: the exact residual, so the stems sum to the original (in the input buffers).
    let residual = |input: &mut Vec<f32>, v: &[f32], d: &[f32], b: &[f32]| {
        input.truncate(n_samples);
        for (i, s) in input.iter_mut().enumerate() {
            *s = (*s - (v[i] + d[i] + b[i])).clamp(-1.0, 1.0);
        }
    };
    residual(&mut left, &vocals_l, &drums_l, &bass_l);
    residual(&mut right, &vocals_r, &drums_r, &bass_r);
    let (other_l, other_r) = (left, right);

    StereoStems {
        vocals: (vocals_l, vocals_r),
        drums: (drums_l, drums_r),
        bass: (bass_l, bass_r),
        other: (other_l, other_r),
    }
}

/// Reconstructs one masked FFT frame (`gain[k] · X[k]`) into the time domain with a synthesis
/// window (overlap-add into `out`).
#[inline]
fn synth_frame(
    gain: &[f32],
    spectrum: &ChannelSpectrum,
    window: &[f32],
    norm_factor: f32,
    fft: &mut FftScratch,
    out: &mut [f32],
) {
    let fft_size = window.len();
    let num_bins = gain.len();
    fft.re.fill(0.0);
    fft.im.fill(0.0);
    for (k, ((&g, &x_re), &x_im)) in gain.iter().zip(&spectrum.re).zip(&spectrum.im).enumerate() {
        let (re, im) = (g * x_re, g * x_im);
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
