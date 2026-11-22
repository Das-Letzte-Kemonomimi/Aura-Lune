use domain::silence::{
    find_silence_bounds, trim_action, SilenceBounds, TrimAction, LEADING_PREROLL_MS,
};

const SR: u32 = 8_000;

/// `lead_ms` ciszy, `tone_ms` sinusa o amplitudzie 0.5, `tail_ms` ciszy.
fn signal(lead_ms: u64, tone_ms: u64, tail_ms: u64) -> Vec<f32> {
    let n = |ms: u64| (ms * SR as u64 / 1000) as usize;
    let mut s = vec![0.0f32; n(lead_ms)];
    s.extend(
        (0..n(tone_ms)).map(|i| 0.5 * (i as f32 * 440.0 * std::f32::consts::TAU / SR as f32).sin()),
    );
    s.extend(vec![0.0f32; n(tail_ms)]);
    s
}

#[test]
fn test_detects_leading_and_trailing_silence() {
    let b = find_silence_bounds(&signal(2_000, 3_000, 2_000), SR, -50.0).unwrap();
    assert!((1_950..=2_000).contains(&b.start_ms), "{b:?}");
    let end = b.end_ms.unwrap();
    assert!((5_000..=5_050).contains(&end), "{b:?}");
}

#[test]
fn test_quiet_noise_below_threshold_counts_as_silence() {
    let mut s = signal(0, 1_000, 0);
    s.splice(0..0, vec![0.001f32; 8_000]); // -60 dBFS przez 1 s
    let b = find_silence_bounds(&s, SR, -50.0).unwrap();
    assert!(b.start_ms >= 950, "{b:?}");
}

#[test]
fn test_all_silence_and_empty_input_return_none() {
    assert_eq!(find_silence_bounds(&vec![0.0; 16_000], SR, -50.0), None);
    assert_eq!(find_silence_bounds(&[], SR, -50.0), None);
}

#[test]
fn test_trim_action_skips_leading_silence_once_at_start() {
    let b = SilenceBounds {
        start_ms: 2_000,
        end_ms: Some(5_000),
    };
    assert_eq!(
        trim_action(0, 7_000, &b, false),
        Some(TrimAction::SeekTo(2_000 - LEADING_PREROLL_MS))
    );
    assert_eq!(trim_action(0, 7_000, &b, true), None, "tylko raz na utwór");
    assert_eq!(
        trim_action(1_500, 7_000, &b, false),
        None,
        "ręczny seek w ciszę nie jest poprawiany"
    );
}

#[test]
fn test_trim_action_ignores_short_leading_silence() {
    let b = SilenceBounds {
        start_ms: 300,
        end_ms: None,
    };
    assert_eq!(trim_action(0, 7_000, &b, false), None);
}

#[test]
fn test_trim_action_finishes_track_at_trailing_silence() {
    let b = SilenceBounds {
        start_ms: 0,
        end_ms: Some(5_000),
    };
    assert_eq!(trim_action(4_900, 7_000, &b, true), None);
    assert_eq!(
        trim_action(5_000, 7_000, &b, true),
        Some(TrimAction::FinishTrack)
    );
}

#[test]
fn test_trim_action_keeps_short_or_unknown_trailing_silence() {
    let short = SilenceBounds {
        start_ms: 0,
        end_ms: Some(6_500),
    };
    assert_eq!(trim_action(6_600, 7_000, &short, true), None);
    let unknown = SilenceBounds {
        start_ms: 0,
        end_ms: None,
    };
    assert_eq!(trim_action(6_900, 7_000, &unknown, true), None);
}
