use audio_engine::AudioEngine;
use domain::EqualizerPreset;

#[test]
fn test_audio_engine_equalizer_and_spectrum() {
    let engine = AudioEngine::new().expect("Nie udało się utworzyć AudioEngine");

    // Test domyślnego stanu korektora
    let default_bands = engine.get_equalizer_bands();
    assert_eq!(default_bands, [0.0; 10]);
    assert!(!engine.is_equalizer_enabled());

    // Test ustawiania pojedynczego pasma
    engine.set_equalizer_band(0, 6.0).expect("Błąd set band 0");
    engine.set_equalizer_band(5, -4.5).expect("Błąd set band 5");
    let current_bands = engine.get_equalizer_bands();
    assert_eq!(current_bands[0], 6.0);
    assert_eq!(current_bands[5], -4.5);

    // Test aplikowania presetu
    let presets = EqualizerPreset::default_presets();
    let bass_preset = presets.iter().find(|p| p.name.contains("Bass")).unwrap();
    engine
        .set_equalizer_bands(&bass_preset.bands)
        .expect("Błąd set preset");
    assert_eq!(engine.get_equalizer_bands(), bass_preset.bands);

    // Test wyłączenia (bypassing EQ)
    engine.set_equalizer_enabled(false);
    assert!(!engine.is_equalizer_enabled());
    engine.set_equalizer_enabled(true);
    assert!(engine.is_equalizer_enabled());
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

    let engine = AudioEngine::new().expect("Nie udało się utworzyć AudioEngine");
    let uri = format!("file://{}", fixture_path.canonicalize().unwrap().display());
    engine.load_uri(&uri).expect("Błąd load_uri");
    engine.play().expect("Błąd play");

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
        "Powinien zostać odebrany co najmniej jeden komunikat PlayerEvent::Spectrum"
    );
    assert!(
        magnitudes.len() == 16 || magnitudes.len() == 32,
        "Spektrum powinno zawierać 16 (mono) lub 32 (stereo 16L+16R) pasma, otrzymano: {}",
        magnitudes.len()
    );
}
