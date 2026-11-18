use dsp_api::{
    cents_to_semitones, pitch_ratio_to_semitones, semitones_to_cents, semitones_to_pitch_ratio,
    AudioFormat, DspEngine, DspParams,
};

#[test]
fn test_semitones_to_ratio() {
    let eps = 1e-6;
    assert!((semitones_to_pitch_ratio(0.0) - 1.0).abs() < eps);
    assert!((semitones_to_pitch_ratio(12.0) - 2.0).abs() < eps);
    assert!((semitones_to_pitch_ratio(-12.0) - 0.5).abs() < eps);
    assert!((semitones_to_pitch_ratio(24.0) - 4.0).abs() < eps);
}

#[test]
fn test_pitch_ratio_roundtrip() {
    let eps = 1e-6;
    for semitones in [-12.0, -7.0, -1.0, 0.0, 2.5, 7.0, 12.0] {
        let ratio = semitones_to_pitch_ratio(semitones);
        let back = pitch_ratio_to_semitones(ratio);
        assert!((back - semitones).abs() < eps);
    }
}

#[test]
fn test_cents_conversion() {
    assert_eq!(cents_to_semitones(50.0), 0.5);
    assert_eq!(semitones_to_cents(0.5), 50.0);
}

#[test]
fn test_params_validation() {
    assert!(DspParams::new(DspEngine::SoundTouch, 0.0, 1.0, 1.0).is_ok());
    assert!(DspParams::new(DspEngine::SoundTouch, 25.0, 1.0, 1.0).is_err());
    assert!(DspParams::new(DspEngine::SoundTouch, 0.0, 0.1, 1.0).is_err());
    assert!(DspParams::new(DspEngine::SoundTouch, 0.0, 1.0, 5.0).is_err());
}

#[test]
fn test_audio_format_validation() {
    assert!(AudioFormat::new(44100, 2).is_ok());
    assert!(AudioFormat::new(0, 2).is_err());
    assert!(AudioFormat::new(48000, 0).is_err());
    assert!(AudioFormat::new(48000, 17).is_err());
}
