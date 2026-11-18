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

/// Wykonuje zaawansowaną separację spektralną HPSS i panoramy stereo na parze próbek L/R.
pub fn separate_stereo_hpss<F>(
    left: &[f32],
    right: &[f32],
    sample_rate: u32,
    mut progress_cb: Option<&mut F>,
) -> StereoStems
where
    F: FnMut(f32, &str) + ?Sized,
{
    let n_samples = left.len().min(right.len());
    let fft_size = 2048;
    let hop_size = 512; // 75% overlap dla Hann window

    if n_samples < fft_size {
        // Fallback dla bardzo krótkich sygnałów
        return StereoStems {
            vocals: (left.to_vec(), right.to_vec()),
            drums: (vec![0.0; n_samples], vec![0.0; n_samples]),
            bass: (vec![0.0; n_samples], vec![0.0; n_samples]),
            other: (vec![0.0; n_samples], vec![0.0; n_samples]),
        };
    }

    if let Some(ref mut cb) = progress_cb {
        cb(
            0.35,
            "STFT: Analiza czasowo-częstotliwościowa (Hann 2048/512)...",
        );
    }

    // 1. Okno Hanna
    let mut window = vec![0.0f32; fft_size];
    for (i, w) in window.iter_mut().enumerate() {
        *w = 0.5 * (1.0 - (2.0 * PI * (i as f32) / (fft_size as f32)).cos());
    }

    let num_frames = (n_samples - fft_size) / hop_size + 1;
    let num_bins = fft_size / 2 + 1;

    // Bufory STFT (magnitude i phase)
    let mut mag_left = vec![vec![0.0f32; num_bins]; num_frames];
    let mut phase_left = vec![vec![0.0f32; num_bins]; num_frames];
    let mut mag_right = vec![vec![0.0f32; num_bins]; num_frames];
    let mut phase_right = vec![vec![0.0f32; num_bins]; num_frames];

    let mut temp_re = vec![0.0f32; fft_size];
    let mut temp_im = vec![0.0f32; fft_size];

    for frame in 0..num_frames {
        let offset = frame * hop_size;

        // Kanał lewy
        for i in 0..fft_size {
            temp_re[i] = left[offset + i] * window[i];
            temp_im[i] = 0.0;
        }
        fft_radix2(&mut temp_re, &mut temp_im, false);
        for k in 0..num_bins {
            let re = temp_re[k];
            let im = temp_im[k];
            mag_left[frame][k] = (re * re + im * im).sqrt();
            phase_left[frame][k] = im.atan2(re);
        }

        // Kanał prawy
        for i in 0..fft_size {
            temp_re[i] = right[offset + i] * window[i];
            temp_im[i] = 0.0;
        }
        fft_radix2(&mut temp_re, &mut temp_im, false);
        for k in 0..num_bins {
            let re = temp_re[k];
            let im = temp_im[k];
            mag_right[frame][k] = (re * re + im * im).sqrt();
            phase_right[frame][k] = im.atan2(re);
        }
    }

    if let Some(ref mut cb) = progress_cb {
        cb(
            0.50,
            "HPSS: Filtracja medianowa (Harmoniczne vs Transjenty)...",
        );
    }

    // 2. Filtracja medianowa dla HPSS
    // Promień w czasie (harmoniczne): ~15 ramek (~174 ms przy hop 512, 44.1 kHz)
    // Promień w częstotliwości (perkusja): ~15 binów (~322 Hz przy 21.5 Hz/bin)
    let r_time = 7usize;
    let r_freq = 7usize;

    let mut harm_left = vec![vec![0.0f32; num_bins]; num_frames];
    let mut perc_left = vec![vec![0.0f32; num_bins]; num_frames];
    let mut harm_right = vec![vec![0.0f32; num_bins]; num_frames];
    let mut perc_right = vec![vec![0.0f32; num_bins]; num_frames];

    let mut scratch = Vec::with_capacity(32);

    for f in 0..num_frames {
        for k in 0..num_bins {
            // Harmoniczna lewa: mediana w czasie (poziomo)
            let f_start = f.saturating_sub(r_time);
            let f_end = (f + r_time + 1).min(num_frames);
            scratch.clear();
            for row in mag_left.iter().take(f_end).skip(f_start) {
                scratch.push(row[k]);
            }
            harm_left[f][k] = quick_median(&mut scratch);

            // Percussive lewa: mediana w częstotliwości (pionowo)
            let k_start = k.saturating_sub(r_freq);
            let k_end = (k + r_freq + 1).min(num_bins);
            scratch.clear();
            scratch.extend_from_slice(&mag_left[f][k_start..k_end]);
            perc_left[f][k] = quick_median(&mut scratch);

            // Harmoniczna prawa
            scratch.clear();
            for row in mag_right.iter().take(f_end).skip(f_start) {
                scratch.push(row[k]);
            }
            harm_right[f][k] = quick_median(&mut scratch);

            // Percussive prawa
            scratch.clear();
            scratch.extend_from_slice(&mag_right[f][k_start..k_end]);
            perc_right[f][k] = quick_median(&mut scratch);
        }
    }

    if let Some(ref mut cb) = progress_cb {
        cb(
            0.65,
            "Separacja źródeł: Dekompozycja panoramy stereo i masek...",
        );
    }

    // 3. Rozdzielenie na 4 maski: Drums, Bass, Vocals, Other
    // Częstotliwości graniczne
    let hz_per_bin = (sample_rate as f32) / (fft_size as f32);
    let bass_cutoff_bin = ((220.0 / hz_per_bin).round() as usize).min(num_bins - 1);
    let vocal_low_bin = ((160.0 / hz_per_bin).round() as usize).min(num_bins - 1);
    let vocal_high_bin = ((7500.0 / hz_per_bin).round() as usize).min(num_bins - 1);

    // Bufory wyjściowe w dziedzinie częstotliwości
    let mut out_vocals_l = vec![vec![0.0f32; num_bins]; num_frames];
    let mut out_vocals_r = vec![vec![0.0f32; num_bins]; num_frames];
    let mut out_drums_l = vec![vec![0.0f32; num_bins]; num_frames];
    let mut out_drums_r = vec![vec![0.0f32; num_bins]; num_frames];
    let mut out_bass_l = vec![vec![0.0f32; num_bins]; num_frames];
    let mut out_bass_r = vec![vec![0.0f32; num_bins]; num_frames];
    let mut out_other_l = vec![vec![0.0f32; num_bins]; num_frames];
    let mut out_other_r = vec![vec![0.0f32; num_bins]; num_frames];

    for f in 0..num_frames {
        for k in 0..num_bins {
            let m_l = mag_left[f][k];
            let m_r = mag_right[f][k];

            let h_l = harm_left[f][k];
            let p_l = perc_left[f][k];
            let h_r = harm_right[f][k];
            let p_r = perc_right[f][k];

            // Maski Wienera HPSS (kwadraty dla wyrazistej separacji)
            let eps = 1e-6f32;
            let mask_perc_l = (p_l * p_l) / (p_l * p_l + h_l * h_l + eps);
            let mask_harm_l = 1.0 - mask_perc_l;

            let mask_perc_r = (p_r * p_r) / (p_r * p_r + h_r * h_r + eps);
            let mask_harm_r = 1.0 - mask_perc_r;

            // Pan-based Center vs Side extraction
            let diff = (m_l - m_r).abs();
            let sum = m_l + m_r + eps;
            let pan_side = (diff / sum).min(1.0); // 0.0 = idealny środek, 1.0 = skrajna panorama
            let pan_center = (1.0 - 1.6 * pan_side).clamp(0.0, 1.0);

            // 1. DRUMS (Wszystkie transjenty i składowe perkusyjne w całym paśmie)
            // Stopa (<120Hz), werbel (200-2000Hz), hi-haty (>4000Hz)
            out_drums_l[f][k] = m_l * mask_perc_l;
            out_drums_r[f][k] = m_r * mask_perc_r;

            // Pozostała energia harmoniczna
            let rem_h_l = m_l * mask_harm_l;
            let rem_h_r = m_r * mask_harm_r;

            // 2. BASS (Harmoniczne w centrum poniżej 220 Hz)
            if k <= bass_cutoff_bin {
                let bass_weight = (1.0 - (k as f32 / bass_cutoff_bin as f32).powi(2)).max(0.0);
                let bass_mask = bass_weight * (0.3 + 0.7 * pan_center);
                out_bass_l[f][k] = rem_h_l * bass_mask;
                out_bass_r[f][k] = rem_h_r * bass_mask;
            }

            // 3. VOCALS (Harmoniczne w centrum w paśmie wokalnym 160 Hz - 7.5 kHz)
            let voc_candidate_l = rem_h_l - out_bass_l[f][k];
            let voc_candidate_r = rem_h_r - out_bass_r[f][k];

            if k >= vocal_low_bin && k <= vocal_high_bin {
                // Wokal prowadzący dominuje w centrum panoramy
                let vocal_mask = pan_center.powf(1.2);
                out_vocals_l[f][k] = voc_candidate_l * vocal_mask;
                out_vocals_r[f][k] = voc_candidate_r * vocal_mask;
            }

            // 4. OTHER / RESIDUAL (Gitary, instrumenty klawiszowe, syntezatory, pogłosy, chórki w panoramie)
            out_other_l[f][k] =
                (m_l - (out_drums_l[f][k] + out_bass_l[f][k] + out_vocals_l[f][k])).max(0.0);
            out_other_r[f][k] =
                (m_r - (out_drums_r[f][k] + out_bass_r[f][k] + out_vocals_r[f][k])).max(0.0);
        }
    }

    if let Some(ref mut cb) = progress_cb {
        cb(
            0.80,
            "ISTFT: Rekonstrukcja Overlap-Add sygnału w pełnym stereo...",
        );
    }

    // 4. Rekonstrukcja sygnałów czasowych (ISTFT + Overlap-Add)
    let mut rec_vocals_l = vec![0.0f32; n_samples];
    let mut rec_vocals_r = vec![0.0f32; n_samples];
    let mut rec_drums_l = vec![0.0f32; n_samples];
    let mut rec_drums_r = vec![0.0f32; n_samples];
    let mut rec_bass_l = vec![0.0f32; n_samples];
    let mut rec_bass_r = vec![0.0f32; n_samples];
    let mut rec_other_l = vec![0.0f32; n_samples];
    let mut rec_other_r = vec![0.0f32; n_samples];

    let norm_factor = 1.5f32; // Suma kwadratów okna Hanna przy 75% overlap

    for frame in 0..num_frames {
        let offset = frame * hop_size;

        // Vocals L
        synth_frame(
            &out_vocals_l[frame],
            &phase_left[frame],
            &window,
            norm_factor,
            &mut rec_vocals_l[offset..offset + fft_size],
        );
        // Vocals R
        synth_frame(
            &out_vocals_r[frame],
            &phase_right[frame],
            &window,
            norm_factor,
            &mut rec_vocals_r[offset..offset + fft_size],
        );

        // Drums L
        synth_frame(
            &out_drums_l[frame],
            &phase_left[frame],
            &window,
            norm_factor,
            &mut rec_drums_l[offset..offset + fft_size],
        );
        // Drums R
        synth_frame(
            &out_drums_r[frame],
            &phase_right[frame],
            &window,
            norm_factor,
            &mut rec_drums_r[offset..offset + fft_size],
        );

        // Bass L
        synth_frame(
            &out_bass_l[frame],
            &phase_left[frame],
            &window,
            norm_factor,
            &mut rec_bass_l[offset..offset + fft_size],
        );
        // Bass R
        synth_frame(
            &out_bass_r[frame],
            &phase_right[frame],
            &window,
            norm_factor,
            &mut rec_bass_r[offset..offset + fft_size],
        );

        // Other L
        synth_frame(
            &out_other_l[frame],
            &phase_left[frame],
            &window,
            norm_factor,
            &mut rec_other_l[offset..offset + fft_size],
        );
        // Other R
        synth_frame(
            &out_other_r[frame],
            &phase_right[frame],
            &window,
            norm_factor,
            &mut rec_other_r[offset..offset + fft_size],
        );
    }

    // 5. Dokładna korekta residualna: Suma stemów musi być w 100% równa oryginałowi
    for i in 0..n_samples {
        let sum_l = rec_vocals_l[i] + rec_drums_l[i] + rec_bass_l[i] + rec_other_l[i];
        let diff_l = left[i] - sum_l;
        rec_other_l[i] = (rec_other_l[i] + diff_l).clamp(-1.0, 1.0);

        let sum_r = rec_vocals_r[i] + rec_drums_r[i] + rec_bass_r[i] + rec_other_r[i];
        let diff_r = right[i] - sum_r;
        rec_other_r[i] = (rec_other_r[i] + diff_r).clamp(-1.0, 1.0);
    }

    StereoStems {
        vocals: (rec_vocals_l, rec_vocals_r),
        drums: (rec_drums_l, rec_drums_r),
        bass: (rec_bass_l, rec_bass_r),
        other: (rec_other_l, rec_other_r),
    }
}

/// Rekonstruuje pojedynczą ramkę FFT do dziedziny czasu z oknem syntezy.
#[inline]
fn synth_frame(mag: &[f32], phase: &[f32], window: &[f32], norm_factor: f32, out: &mut [f32]) {
    let fft_size = window.len();
    let num_bins = mag.len();
    let mut temp_re = vec![0.0f32; fft_size];
    let mut temp_im = vec![0.0f32; fft_size];

    for k in 0..num_bins {
        let m = mag[k];
        let p = phase[k];
        let re = m * p.cos();
        let im = m * p.sin();
        temp_re[k] = re;
        temp_im[k] = im;
        if k > 0 && k < num_bins - 1 {
            temp_re[fft_size - k] = re;
            temp_im[fft_size - k] = -im;
        }
    }

    fft_radix2(&mut temp_re, &mut temp_im, true);

    for i in 0..fft_size {
        out[i] += temp_re[i] * window[i] / norm_factor;
    }
}

#[cfg(test)]
#[path = "hpss_test.rs"]
mod tests;
