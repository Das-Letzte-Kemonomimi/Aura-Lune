use audio_engine::AudioEngine;
use std::path::PathBuf;
use std::sync::Arc;

#[test]
fn test_desktop_backend_smoke() {
    let fixture_wav = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join("tests/fixtures/test_sine_440hz.wav");

    assert!(
        fixture_wav.exists(),
        "The WAV file should exist: {:?}",
        fixture_wav
    );

    let engine = Arc::new(AudioEngine::new().expect("The audio engine should start"));
    let uri = format!("file://{}", fixture_wav.canonicalize().unwrap().display());

    engine
        .load_uri(&uri)
        .expect("Loading the file in the smoke test");
    engine.play().expect("Play in the smoke test");

    // Check the DSP changes
    engine.set_pitch_semitones(2.0).expect("Pitch shift +2 st");
    assert_eq!(engine.dsp_params().pitch_semitones, 2.0);

    // Check the EQ
    engine.set_equalizer_band(0, 4.0).expect("EQ band 0 gain");
    assert_eq!(engine.get_equalizer_bands()[0], 4.0);

    engine.stop().expect("Stop in the smoke test");
}
