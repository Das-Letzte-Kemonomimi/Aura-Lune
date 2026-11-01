use audio_engine::AudioEngine;
use domain::dynamics::{
    CompressorConfig, DynamicsPreset, DynamicsState, LimiterConfig, SaturatorConfig, SaturatorMode,
};

#[test]
fn test_audio_engine_dynamics_lifecycle() {
    let engine = AudioEngine::new().expect("Nie udało się utworzyć AudioEngine");

    // 1. Domyślny stan Studia Dynamiki
    let initial_state = engine.get_dynamics_state();
    assert!(!initial_state.compressor.enabled);
    assert!(!initial_state.saturator.enabled);
    assert!(initial_state.limiter.enabled); // Ochrona słuchu włączona domyślnie
    assert!(!engine.is_compressor_enabled());
    assert!(!engine.is_saturator_enabled());
    assert!(engine.is_limiter_enabled());

    // 2. Aplikowanie konfiguracji Studia Dynamiki (np. Vintage Tube)
    let test_state = DynamicsState {
        compressor: CompressorConfig {
            enabled: true,
            threshold_db: -18.0,
            ratio: 3.5,
            soft_knee: true,
            makeup_gain_db: 4.0,
        },
        saturator: SaturatorConfig {
            enabled: true,
            mode: SaturatorMode::TubeWarmth,
            drive: 2.0,
            warmth: 0.7,
            mix: 0.85,
        },
        limiter: LimiterConfig {
            enabled: true,
            ceiling_db: -0.3,
        },
    };

    engine
        .set_dynamics_state(&test_state)
        .expect("Błąd set_dynamics_state");

    let current = engine.get_dynamics_state();
    assert!(current.compressor.enabled);
    assert_eq!(current.compressor.threshold_db, -18.0);
    assert_eq!(current.compressor.ratio, 3.5);
    assert!(current.saturator.enabled);
    assert_eq!(current.saturator.mode, SaturatorMode::TubeWarmth);
    assert_eq!(current.saturator.drive, 2.0);
    assert!(current.limiter.enabled);

    // 3. Test niezależnych przełączników
    engine
        .set_compressor_enabled(false)
        .expect("Błąd set_compressor_enabled");
    assert!(!engine.is_compressor_enabled());
    assert!(engine.is_saturator_enabled());

    engine
        .set_saturator_enabled(false)
        .expect("Błąd set_saturator_enabled");
    assert!(!engine.is_saturator_enabled());

    engine.set_limiter_enabled(false);
    assert!(!engine.is_limiter_enabled());

    engine.set_limiter_enabled(true);
    assert!(engine.is_limiter_enabled());

    // 4. Test aplikacji wszystkich presetów fabrycznych
    for preset in DynamicsPreset::default_presets() {
        engine
            .set_dynamics_state(&preset.state)
            .unwrap_or_else(|_| panic!("Błąd aplikacji presetu: {}", preset.name));
        let applied = engine.get_dynamics_state();
        assert_eq!(applied.compressor.enabled, preset.state.compressor.enabled);
        assert_eq!(applied.saturator.enabled, preset.state.saturator.enabled);
        assert_eq!(applied.limiter.enabled, preset.state.limiter.enabled);
    }
}
