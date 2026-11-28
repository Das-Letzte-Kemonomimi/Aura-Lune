use audio_engine::AudioEngine;
use domain::EqualizerPreset;

#[test]
fn test_audio_engine_equalizer_and_spectrum() {
    let engine = AudioEngine::new().expect("Failed to create AudioEngine");

    // Default equalizer state
    let default_bands = engine.get_equalizer_bands();
    assert_eq!(default_bands, [0.0; 10]);
    assert!(!engine.is_equalizer_enabled());

    // Set a single band: the gain is stored, but only the user switch enables the equalizer
    engine
        .set_equalizer_band(0, 6.0)
        .expect("set band 0 failed");
    engine
        .set_equalizer_band(5, -4.5)
        .expect("set band 5 failed");
    let current_bands = engine.get_equalizer_bands();
    assert_eq!(current_bands[0], 6.0);
    assert_eq!(current_bands[5], -4.5);
    assert!(!engine.is_equalizer_enabled());

    // Preamp
    engine.set_equalizer_preamp(-3.5);
    assert_eq!(engine.get_equalizer_preamp(), -3.5);

    // Apply a preset
    let presets = EqualizerPreset::default_presets();
    let bass_preset = presets.iter().find(|p| p.id == "bass-boost").unwrap();
    engine
        .set_equalizer_bands(&bass_preset.bands)
        .expect("set preset failed");
    assert_eq!(engine.get_equalizer_bands(), bass_preset.bands);
    assert!(!engine.is_equalizer_enabled());

    // The user switch enables and bypasses the EQ; the stored bands survive the bypass.
    engine.set_equalizer_enabled(true);
    assert!(engine.is_equalizer_enabled());
    engine.set_equalizer_enabled(false);
    assert!(!engine.is_equalizer_enabled());
    assert_eq!(engine.get_equalizer_bands(), bass_preset.bands);
}

#[test]
fn test_audio_engine_spectrum_emission() {
    use audio_engine::PlayerEvent;
    use std::path::PathBuf;
    use std::thread::sleep;
    use std::time::Duration;

    let fixture_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("tests/fixtures/test_sine_440hz.wav");

    let engine = AudioEngine::new().expect("Failed to create AudioEngine");
    let uri = format!("file://{}", fixture_path.canonicalize().unwrap().display());
    engine.load_uri(&uri).expect("load_uri failed");
    engine.play().expect("play failed");

    let mut spectrum_received = false;
    let mut magnitudes = Vec::new();
    for _ in 0..20 {
        sleep(Duration::from_millis(50));
        let events = engine.poll_events();
        for ev in events {
            if let PlayerEvent::Spectrum(mags) = ev {
                magnitudes = mags;
                spectrum_received = true;
            }
        }
        if spectrum_received {
            break;
        }
    }
    engine.stop().ok();
    assert!(
        spectrum_received,
        "At least one PlayerEvent::Spectrum message should be received"
    );
    assert!(
        magnitudes.len() == 16 || magnitudes.len() == 32,
        "The spectrum should have 16 (mono) or 32 (stereo 16L+16R) bands, got: {}",
        magnitudes.len()
    );
}

#[test]
fn test_fader_thread_supersedes_running_fade() {
    use std::path::PathBuf;
    use std::thread::sleep;
    use std::time::Duration;

    let fixture_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("tests/fixtures/test_sine_440hz.wav");

    let engine = AudioEngine::new().expect("AudioEngine init");
    let uri = format!("file://{}", fixture_path.canonicalize().unwrap().display());
    engine.load_uri(&uri).expect("load_uri");
    engine.set_volume(1.0).expect("set initial volume");
    engine.play().expect("play");

    // Start a slow fade down to 0.1, then immediately supersede with a ramp up to 0.75.
    engine
        .set_volume_smooth(0.1, Duration::from_millis(400))
        .expect("first smooth fade");
    sleep(Duration::from_millis(24));
    engine
        .set_volume_smooth(0.75, Duration::from_millis(120))
        .expect("superseding smooth fade");

    sleep(Duration::from_millis(220));
    let snap = engine.status_snapshot();
    assert!((snap.volume - 0.75).abs() < 1e-6);

    // Wait beyond the first fade's window to ensure it did NOT overwrite the second fade.
    sleep(Duration::from_millis(250));
    assert!((engine.volume() - 0.75).abs() < 1e-6);
    engine.stop().ok();
}
