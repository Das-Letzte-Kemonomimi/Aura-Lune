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

    let stems = separate_stereo_hpss(&left, &right, 44100, None::<&mut fn(f32, &str)>);

    // Weryfikacja dokładności sumy: Suma wszystkich stemów musi idealnie pokrywać wejście
    for i in 2048..6144 {
        let sum_l = stems.vocals.0[i] + stems.drums.0[i] + stems.bass.0[i] + stems.other.0[i];
        let sum_r = stems.vocals.1[i] + stems.drums.1[i] + stems.bass.1[i] + stems.other.1[i];
        assert!(
            (sum_l - left[i]).abs() < 1e-3,
            "Błąd rekonstrukcji L na próbce {}",
            i
        );
        assert!(
            (sum_r - right[i]).abs() < 1e-3,
            "Błąd rekonstrukcji R na próbce {}",
            i
        );
    }
}
