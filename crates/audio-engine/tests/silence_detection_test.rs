use audio_engine::{
    analyze_waveform_and_silence, detect_silence_bounds, extract_track_waveform_spectrum,
    write_wav_file,
};
use std::sync::atomic::AtomicBool;

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

#[test]
fn test_combined_decode_matches_separate_waveform_and_silence() {
    let path = silence_padded_wav("silence_waveform_combined");
    let uri = path.to_str().unwrap();

    let combined = analyze_waveform_and_silence(uri, 160, Some(7), -50.0, Some(7_000), None)
        .expect("combined analysis");
    let waveform = extract_track_waveform_spectrum(uri, 160, Some(7)).expect("waveform");
    let silence = detect_silence_bounds(uri, -50.0, Some(7_000), None).expect("silence");

    let combined_waveform = combined
        .waveform
        .expect("waveform from the combined decode");
    assert_eq!(combined_waveform.peaks, waveform.peaks);
    assert_eq!(combined_waveform.bands, waveform.bands);
    assert_eq!(combined_waveform.track_id, Some(7));
    assert_eq!(combined.silence.expect("silence result"), silence);
    let _ = std::fs::remove_file(path);
}

#[test]
fn test_combined_decode_returns_nothing_when_cancelled() {
    let path = silence_padded_wav("silence_waveform_cancelled");
    let cancel = AtomicBool::new(true);
    let combined = analyze_waveform_and_silence(
        path.to_str().unwrap(),
        160,
        None,
        -50.0,
        Some(7_000),
        Some(&cancel),
    )
    .expect("a cancel is not an error");
    assert!(combined.waveform.is_none());
    assert_eq!(combined.silence.expect("silence result"), None);
    let _ = std::fs::remove_file(path);
}
