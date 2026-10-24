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
