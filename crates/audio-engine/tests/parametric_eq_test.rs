use audio_engine::AudioEngine;
use domain::parametric_eq::{
    ParametricBand, ParametricEqPreset, ParametricEqState, ParametricFilterType,
};

#[test]
fn test_audio_engine_parametric_eq_lifecycle() {
    let engine = AudioEngine::new().expect("Nie udało się utworzyć AudioEngine");

    // 1. Domyślny stan
    let initial_state = engine.get_parametric_eq_state();
    assert!(!initial_state.enabled);
    assert_eq!(initial_state.preamp_db, 0.0);
    assert!(!engine.is_parametric_eq_enabled());

    // 2. Aplikowanie konfiguracji z 4 pasmami
    let test_state = ParametricEqState {
        enabled: true,
        preamp_db: -5.0,
        bands: vec![
            ParametricBand::new("b1", ParametricFilterType::LowShelf, 80.0, 4.0, 0.71),
            ParametricBand::new("b2", ParametricFilterType::Peak, 500.0, -2.5, 1.41),
            ParametricBand::new("b3", ParametricFilterType::Peak, 2500.0, 3.0, 2.0),
            ParametricBand::new("b4", ParametricFilterType::HighShelf, 9000.0, -1.5, 0.71),
        ],
    };

    engine
        .set_parametric_eq_state(&test_state)
        .expect("Błąd set_parametric_eq_state");

    let current = engine.get_parametric_eq_state();
    assert!(current.enabled);
    assert_eq!(current.preamp_db, -5.0);
    assert_eq!(current.bands.len(), 4);
    assert_eq!(current.bands[0].filter_type, ParametricFilterType::LowShelf);
    assert_eq!(current.bands[0].freq, 80.0);
    assert_eq!(current.bands[0].gain_db, 4.0);

    // 3. Test wyłączania (Bypass)
    engine
        .set_parametric_eq_enabled(false)
        .expect("Błąd set_parametric_eq_enabled");
    assert!(!engine.is_parametric_eq_enabled());

    // 4. Test ponownego włączenia
    engine
        .set_parametric_eq_enabled(true)
        .expect("Błąd włączenia PEQ");
    assert!(engine.is_parametric_eq_enabled());

    // 5. Test zmiany samego preamp
    engine
        .set_parametric_eq_preamp(-6.8)
        .expect("Błąd set_parametric_eq_preamp");
    assert_eq!(engine.get_parametric_eq_state().preamp_db, -6.8);

    // 6. Test fabrycznego presetu Harmana
    let harman = ParametricEqPreset::default_presets()
        .into_iter()
        .find(|p| p.name.contains("Harman"))
        .expect("Harman preset");

    engine
        .set_parametric_eq_state(&harman.state)
        .expect("Błąd aplikacji presetu Harmana");
    let current_harman = engine.get_parametric_eq_state();
    assert_eq!(current_harman.bands.len(), 5);
}
