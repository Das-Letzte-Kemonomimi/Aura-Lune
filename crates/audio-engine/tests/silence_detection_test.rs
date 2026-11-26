use audio_engine::{detect_silence_bounds, write_wav_file};

/// WAV file: 2 s of silence, 3 s of a 440 Hz tone, 2 s of silence (44.1 kHz mono).
fn silence_padded_wav(name: &str) -> std::path::PathBuf {
    let sr = 44_100u32;
    let n = |ms: u32| (ms * sr / 1000) as usize;
    let mut samples = vec![0.0f32; n(2_000)];
    samples.extend(
        (0..n(3_000)).map(|i| 0.5 * (i as f32 * 440.0 * std::f32::consts::TAU / sr as f32).sin()),
    );
    samples.extend(vec![0.0f32; n(2_000)]);
    let path = std::env::temp_dir().join(format!("auralune_{}_{}.wav", name, std::process::id()));
    write_wav_file(&path, &samples, sr, 1).expect("writing the WAV");
    path
}

#[test]
fn test_detects_silence_around_tone_in_real_file() {
    let path = silence_padded_wav("silence_bounds");
    let bounds = detect_silence_bounds(path.to_str().unwrap(), -50.0, Some(7_000), None)
        .expect("analysis")
        .expect("the file contains sound");

    assert!((1_900..=2_050).contains(&bounds.start_ms), "{bounds:?}");
    let end = bounds.end_ms.expect("whole track decoded");
    assert!((4_950..=5_100).contains(&end), "{bounds:?}");
    let _ = std::fs::remove_file(path);
}

#[test]
fn test_trailing_bound_is_dropped_when_track_is_longer_than_decoded_audio() {
    // The library claims the track is 60 s long, but decoding covered only 7 s,
    // so the end must not be trimmed.
    let path = silence_padded_wav("silence_partial");
    let bounds = detect_silence_bounds(path.to_str().unwrap(), -50.0, Some(60_000), None)
        .unwrap()
        .unwrap();
    assert_eq!(bounds.end_ms, None);
    assert!(bounds.start_ms >= 1_900);
    let _ = std::fs::remove_file(path);
}
