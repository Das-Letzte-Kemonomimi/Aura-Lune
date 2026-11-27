use super::*;

#[test]
fn test_fft_radix2_roundtrip() {
    let n = 2048;
    let mut re = vec![0.0f32; n];
    let mut im = vec![0.0f32; n];
    for (i, r) in re.iter_mut().enumerate() {
        *r = ((i as f32) * 0.1).sin();
    }
    let orig = re.clone();

    fft_radix2(&mut re, &mut im, false);
    fft_radix2(&mut re, &mut im, true);

    for (i, &val) in orig.iter().enumerate() {
        assert!((re[i] - val).abs() < 1e-4);
    }
}

#[test]
fn test_hpss_stereo_sum_reconstruction() {
    let n = 8192;
    let mut left = vec![0.0f32; n];
    let mut right = vec![0.0f32; n];
    for i in 0..n {
        let t = i as f32 / 44100.0;
        left[i] = (2.0 * PI * 100.0 * t).sin() * 0.5 + (2.0 * PI * 1000.0 * t).sin() * 0.3;
        right[i] = (2.0 * PI * 100.0 * t).sin() * 0.5 + (2.0 * PI * 1200.0 * t).sin() * 0.3;
    }

    let stems = separate_stereo_hpss(
        left.clone(),
        right.clone(),
        44100,
        None::<&mut fn(f32, &str)>,
    );

    // Check the sum: all stems together must reproduce the input exactly
    for i in 2048..6144 {
        let sum_l = stems.vocals.0[i] + stems.drums.0[i] + stems.bass.0[i] + stems.other.0[i];
        let sum_r = stems.vocals.1[i] + stems.drums.1[i] + stems.bass.1[i] + stems.other.1[i];
        assert!(
            (sum_l - left[i]).abs() < 1e-3,
            "L reconstruction error at sample {}",
            i
        );
        assert!(
            (sum_r - right[i]).abs() < 1e-3,
            "R reconstruction error at sample {}",
            i
        );
    }
}

// ---------------------------------------------------------------------------
// Original implementation (full spectrogram matrices), the reference for the equivalence test.
// ---------------------------------------------------------------------------

/// The original `separate_stereo_hpss` from before the switch to a ring buffer.
fn reference_separate_stereo_hpss<F>(
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
    let hop_size = 512; // 75% overlap for the Hann window

    if n_samples < fft_size {
        // Fallback for very short signals
        return StereoStems {
            vocals: (left.to_vec(), right.to_vec()),
            drums: (vec![0.0; n_samples], vec![0.0; n_samples]),
            bass: (vec![0.0; n_samples], vec![0.0; n_samples]),
            other: (vec![0.0; n_samples], vec![0.0; n_samples]),
        };
    }

    if let Some(ref mut cb) = progress_cb {
        cb(0.35, "STFT: time-frequency analysis (Hann 2048/512)...");
    }

    // 1. Hann window
    let mut window = vec![0.0f32; fft_size];
    for (i, w) in window.iter_mut().enumerate() {
        *w = 0.5 * (1.0 - (2.0 * PI * (i as f32) / (fft_size as f32)).cos());
    }

    let num_frames = (n_samples - fft_size) / hop_size + 1;
    let num_bins = fft_size / 2 + 1;

    // STFT buffers (magnitude and phase)
    let mut mag_left = vec![vec![0.0f32; num_bins]; num_frames];
    let mut phase_left = vec![vec![0.0f32; num_bins]; num_frames];
    let mut mag_right = vec![vec![0.0f32; num_bins]; num_frames];
    let mut phase_right = vec![vec![0.0f32; num_bins]; num_frames];

    let mut temp_re = vec![0.0f32; fft_size];
    let mut temp_im = vec![0.0f32; fft_size];

    for frame in 0..num_frames {
        let offset = frame * hop_size;

        // Left channel
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

        // Right channel
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
        cb(0.50, "HPSS: median filtering (harmonics vs transients)...");
    }

    // 2. Median filtering for HPSS
    // Time radius (harmonics): ~15 frames (~174 ms at hop 512, 44.1 kHz)
    // Frequency radius (percussion): ~15 bins (~322 Hz at 21.5 Hz/bin)
    let r_time = 7usize;
    let r_freq = 7usize;

    let mut harm_left = vec![vec![0.0f32; num_bins]; num_frames];
    let mut perc_left = vec![vec![0.0f32; num_bins]; num_frames];
    let mut harm_right = vec![vec![0.0f32; num_bins]; num_frames];
    let mut perc_right = vec![vec![0.0f32; num_bins]; num_frames];

    let mut scratch = Vec::with_capacity(32);

    for f in 0..num_frames {
        for k in 0..num_bins {
            // Left harmonic: median along time (horizontal)
            let f_start = f.saturating_sub(r_time);
            let f_end = (f + r_time + 1).min(num_frames);
            scratch.clear();
            for row in mag_left.iter().take(f_end).skip(f_start) {
                scratch.push(row[k]);
            }
            harm_left[f][k] = quick_median(&mut scratch);

            // Left percussive: median along frequency (vertical)
            let k_start = k.saturating_sub(r_freq);
            let k_end = (k + r_freq + 1).min(num_bins);
            scratch.clear();
            scratch.extend_from_slice(&mag_left[f][k_start..k_end]);
            perc_left[f][k] = quick_median(&mut scratch);

            // Right harmonic
            scratch.clear();
            for row in mag_right.iter().take(f_end).skip(f_start) {
                scratch.push(row[k]);
            }
            harm_right[f][k] = quick_median(&mut scratch);

            // Right percussive
            scratch.clear();
            scratch.extend_from_slice(&mag_right[f][k_start..k_end]);
            perc_right[f][k] = quick_median(&mut scratch);
        }
    }

    if let Some(ref mut cb) = progress_cb {
        cb(
            0.65,
            "Source separation: stereo panorama and mask decomposition...",
        );
    }

    // 3. Split into 4 masks: Drums, Bass, Vocals, Other
    // Crossover frequencies
    let hz_per_bin = (sample_rate as f32) / (fft_size as f32);
    let bass_cutoff_bin = ((220.0 / hz_per_bin).round() as usize).min(num_bins - 1);
    let vocal_low_bin = ((160.0 / hz_per_bin).round() as usize).min(num_bins - 1);
    let vocal_high_bin = ((7500.0 / hz_per_bin).round() as usize).min(num_bins - 1);

    // Output buffers in the frequency domain
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

            // HPSS Wiener masks (squared for a crisper separation)
            let eps = 1e-6f32;
            let mask_perc_l = (p_l * p_l) / (p_l * p_l + h_l * h_l + eps);
            let mask_harm_l = 1.0 - mask_perc_l;

            let mask_perc_r = (p_r * p_r) / (p_r * p_r + h_r * h_r + eps);
            let mask_harm_r = 1.0 - mask_perc_r;

            // Pan-based Center vs Side extraction
            let diff = (m_l - m_r).abs();
            let sum = m_l + m_r + eps;
            let pan_side = (diff / sum).min(1.0); // 0.0 = dead centre, 1.0 = hard-panned
            let pan_center = (1.0 - 1.6 * pan_side).clamp(0.0, 1.0);

            // 1. DRUMS (every transient and percussive component across the full range)
            // Kick (<120Hz), snare (200-2000Hz), hi-hats (>4000Hz)
            out_drums_l[f][k] = m_l * mask_perc_l;
            out_drums_r[f][k] = m_r * mask_perc_r;

            // Remaining harmonic energy
            let rem_h_l = m_l * mask_harm_l;
            let rem_h_r = m_r * mask_harm_r;

            // 2. BASS (centred harmonics below 220 Hz)
            if k <= bass_cutoff_bin {
                let bass_weight = (1.0 - (k as f32 / bass_cutoff_bin as f32).powi(2)).max(0.0);
                let bass_mask = bass_weight * (0.3 + 0.7 * pan_center);
                out_bass_l[f][k] = rem_h_l * bass_mask;
                out_bass_r[f][k] = rem_h_r * bass_mask;
            }

            // 3. VOCALS (centred harmonics in the 160 Hz - 7.5 kHz vocal band)
            let voc_candidate_l = rem_h_l - out_bass_l[f][k];
            let voc_candidate_r = rem_h_r - out_bass_r[f][k];

            if k >= vocal_low_bin && k <= vocal_high_bin {
                // The lead vocal dominates the centre of the panorama
                let vocal_mask = pan_center.powf(1.2);
                out_vocals_l[f][k] = voc_candidate_l * vocal_mask;
                out_vocals_r[f][k] = voc_candidate_r * vocal_mask;
            }

            // 4. OTHER / RESIDUAL (guitars, keys, synths, reverb, panned backing vocals)
            out_other_l[f][k] =
                (m_l - (out_drums_l[f][k] + out_bass_l[f][k] + out_vocals_l[f][k])).max(0.0);
            out_other_r[f][k] =
                (m_r - (out_drums_r[f][k] + out_bass_r[f][k] + out_vocals_r[f][k])).max(0.0);
        }
    }

    if let Some(ref mut cb) = progress_cb {
        cb(
            0.80,
            "ISTFT: overlap-add reconstruction of the full stereo signal...",
        );
    }

    // 4. Reconstruct the time-domain signals (ISTFT + overlap-add)
    let mut rec_vocals_l = vec![0.0f32; n_samples];
    let mut rec_vocals_r = vec![0.0f32; n_samples];
    let mut rec_drums_l = vec![0.0f32; n_samples];
    let mut rec_drums_r = vec![0.0f32; n_samples];
    let mut rec_bass_l = vec![0.0f32; n_samples];
    let mut rec_bass_r = vec![0.0f32; n_samples];
    let mut rec_other_l = vec![0.0f32; n_samples];
    let mut rec_other_r = vec![0.0f32; n_samples];

    let norm_factor = 1.5f32; // Sum of squares of the Hann window at 75% overlap

    for frame in 0..num_frames {
        let offset = frame * hop_size;

        // Vocals L
        reference_synth_frame(
            &out_vocals_l[frame],
            &phase_left[frame],
            &window,
            norm_factor,
            &mut rec_vocals_l[offset..offset + fft_size],
        );
        // Vocals R
        reference_synth_frame(
            &out_vocals_r[frame],
            &phase_right[frame],
            &window,
            norm_factor,
            &mut rec_vocals_r[offset..offset + fft_size],
        );

        // Drums L
        reference_synth_frame(
            &out_drums_l[frame],
            &phase_left[frame],
            &window,
            norm_factor,
            &mut rec_drums_l[offset..offset + fft_size],
        );
        // Drums R
        reference_synth_frame(
            &out_drums_r[frame],
            &phase_right[frame],
            &window,
            norm_factor,
            &mut rec_drums_r[offset..offset + fft_size],
        );

        // Bass L
        reference_synth_frame(
            &out_bass_l[frame],
            &phase_left[frame],
            &window,
            norm_factor,
            &mut rec_bass_l[offset..offset + fft_size],
        );
        // Bass R
        reference_synth_frame(
            &out_bass_r[frame],
            &phase_right[frame],
            &window,
            norm_factor,
            &mut rec_bass_r[offset..offset + fft_size],
        );

        // Other L
        reference_synth_frame(
            &out_other_l[frame],
            &phase_left[frame],
            &window,
            norm_factor,
            &mut rec_other_l[offset..offset + fft_size],
        );
        // Other R
        reference_synth_frame(
            &out_other_r[frame],
            &phase_right[frame],
            &window,
            norm_factor,
            &mut rec_other_r[offset..offset + fft_size],
        );
    }

    // 5. Exact residual correction: the stems must sum to 100% of the original
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

/// Reconstructs one FFT frame into the time domain with a synthesis window.
#[inline]
fn reference_synth_frame(
    mag: &[f32],
    phase: &[f32],
    window: &[f32],
    norm_factor: f32,
    out: &mut [f32],
) {
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

/// Deterministic signal with tones, transients and varied panning.
fn mixed_test_signal(n: usize) -> (Vec<f32>, Vec<f32>) {
    let mut seed = 0x1234_5678u32;
    let mut noise = move || {
        seed ^= seed << 13;
        seed ^= seed >> 17;
        seed ^= seed << 5;
        (seed as f32 / u32::MAX as f32) * 2.0 - 1.0
    };
    let mut left = vec![0.0f32; n];
    let mut right = vec![0.0f32; n];
    for i in 0..n {
        let t = i as f32 / 44100.0;
        let click = if i % 11025 < 200 { noise() * 0.6 } else { 0.0 };
        let bass = (2.0 * PI * 70.0 * t).sin() * 0.3;
        let voice = (2.0 * PI * 440.0 * t).sin() * 0.2;
        let side = (2.0 * PI * 3000.0 * t).sin() * 0.1;
        left[i] = bass + voice + click + side;
        right[i] = bass + voice + click - side + noise() * 0.01;
    }
    (left, right)
}

/// Largest absolute sample difference between two signals of equal length.
fn max_abs_diff(a: &[f32], b: &[f32]) -> f32 {
    assert_eq!(a.len(), b.len());
    a.iter()
        .zip(b)
        .map(|(x, y)| (x - y).abs())
        .fold(0.0, f32::max)
}

/// The streaming version differs from the reference only in floating-point rounding:
/// - stems are resynthesised as `gain · X` instead of `|gain · X| · (cos φ, sin φ)` with
///   `φ = atan2(im, re)` (the same complex value, without the polar round trip);
/// - "other" is `input − (vocals + drums + bass)` directly, which is what the reference's
///   residual correction `other + (input − (vocals + drums + bass + other))` reduces to.
///
/// So every stem must match the full-matrix reference within 1e-6 (≈ 1/30 of a 16-bit LSB).
#[test]
fn test_streaming_hpss_matches_full_matrix_reference() {
    // 1.5 s: far more frames than the ring buffer (15), plus partial edges.
    let (left, right) = mixed_test_signal(66_150);
    let new = separate_stereo_hpss(
        left.clone(),
        right.clone(),
        44100,
        None::<&mut fn(f32, &str)>,
    );
    let old = reference_separate_stereo_hpss(&left, &right, 44100, None::<&mut fn(f32, &str)>);
    for (name, a, b) in [
        ("vocals", &new.vocals, &old.vocals),
        ("drums", &new.drums, &old.drums),
        ("bass", &new.bass, &old.bass),
        ("other", &new.other, &old.other),
    ] {
        let (diff_l, diff_r) = (max_abs_diff(&a.0, &b.0), max_abs_diff(&a.1, &b.1));
        assert!(
            diff_l < 1e-6,
            "{name} L differs from the reference by {diff_l}"
        );
        assert!(
            diff_r < 1e-6,
            "{name} R differs from the reference by {diff_r}"
        );
    }
}

#[test]
fn test_hpss_stems_sum_exactly_to_the_input() {
    // Halved so no sample reaches the ±1 clamp of the residual.
    let (mut left, mut right) = mixed_test_signal(44_100);
    left.iter_mut()
        .chain(right.iter_mut())
        .for_each(|s| *s *= 0.5);
    let stems = separate_stereo_hpss(
        left.clone(),
        right.clone(),
        44100,
        None::<&mut fn(f32, &str)>,
    );
    for (input, v, d, b, o) in [
        (
            &left,
            &stems.vocals.0,
            &stems.drums.0,
            &stems.bass.0,
            &stems.other.0,
        ),
        (
            &right,
            &stems.vocals.1,
            &stems.drums.1,
            &stems.bass.1,
            &stems.other.1,
        ),
    ] {
        for i in 0..input.len() {
            let sum = v[i] + d[i] + b[i] + o[i];
            assert!((sum - input[i]).abs() < 1e-6, "sum differs at sample {i}");
        }
    }
}

#[test]
fn test_hpss_reports_progress_in_order() {
    let (left, right) = mixed_test_signal(44_100);
    let mut steps = Vec::new();
    let mut cb = |p: f32, _msg: &str| steps.push(p);
    separate_stereo_hpss(left.clone(), right.clone(), 44100, Some(&mut cb));
    assert_eq!(steps, vec![0.35, 0.50, 0.65, 0.80]);
}

#[test]
fn test_hpss_short_input_falls_back_to_passthrough() {
    let left = vec![0.1f32; 1000];
    let right = vec![0.2f32; 1000];
    let stems = separate_stereo_hpss(
        left.clone(),
        right.clone(),
        44100,
        None::<&mut fn(f32, &str)>,
    );
    assert_eq!(stems.vocals.0, left);
    assert!(stems.drums.0.iter().all(|&s| s == 0.0));
}
