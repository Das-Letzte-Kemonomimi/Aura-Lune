use super::*;

/// The old two-pass helpers (allocate per stage, scale with a separate `map`), kept as the
/// reference for the in-place filter chain.
fn reference_biquad(samples: &[f32], (b0, b1, b2, a1, a2): Coeffs) -> Vec<f32> {
    let mut out = Vec::with_capacity(samples.len());
    let (mut x1, mut x2, mut y1, mut y2) = (0.0, 0.0, 0.0, 0.0);
    for &s in samples {
        let x0 = s as f64;
        let y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        out.push(y0.clamp(-1.0, 1.0) as f32);
        x2 = x1;
        x1 = x0;
        y2 = y1;
        y1 = y0;
    }
    out
}

fn test_signal(n: usize) -> Vec<f32> {
    let mut seed = 0x9e37_79b9u32;
    (0..n)
        .map(|i| {
            seed ^= seed << 13;
            seed ^= seed >> 17;
            seed ^= seed << 5;
            let noise = (seed as f32 / u32::MAX as f32) * 2.0 - 1.0;
            let t = i as f32 / 44_100.0;
            // Loud enough to hit the [-1, 1] clamp now and then.
            (2.0 * std::f32::consts::PI * 180.0 * t).sin() * 0.9 + noise * 0.3
        })
        .collect()
}

#[test]
fn filter_chain_matches_separate_passes_and_scaling_bit_for_bit() {
    let filters = Filters {
        sample_rate: 44_100.0,
    };
    let input = test_signal(20_000);
    for (stages, gain) in [
        (vec![Lpf(110.0)], 1.0f32),
        (vec![Hpf(2500.0)], 0.4),
        (vec![Hpf(700.0), Lpf(2500.0)], 0.5),
        (vec![Hpf(1800.0), Lpf(4000.0)], 0.25),
    ] {
        let mut expected = input.clone();
        for stage in &stages {
            expected = reference_biquad(&expected, filters.coeffs(*stage));
        }
        let expected: Vec<f32> = expected.iter().map(|&s| s * gain).collect();
        assert_eq!(filters.chain(&input, &stages, gain), expected);
    }
}

#[test]
fn in_place_sums_follow_the_original_expressions() {
    let a = (
        test_signal(64),
        test_signal(64).iter().map(|s| -s).collect::<Vec<_>>(),
    );
    let b = (vec![0.25f32; 64], vec![-0.5f32; 64]);

    let mut acc = a.clone();
    add_in_place(&mut acc, &b);
    assert_eq!(acc.0, a.0.iter().map(|s| s + 0.25).collect::<Vec<_>>());

    let mut diff = a.clone();
    subtract_in_place(&mut diff, &b);
    assert_eq!(diff.1, a.1.iter().map(|s| s + 0.5).collect::<Vec<_>>());

    let mut rev = b.clone();
    reverse_subtract_in_place(&mut rev, &a);
    assert_eq!(rev.0, a.0.iter().map(|s| s - 0.25).collect::<Vec<_>>());
}
