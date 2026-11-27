//! The user preamp is always applied on the shared preamp element; the EQ-coupled preamps
//! only add to it while their equalizer is enabled.

use audio_engine::AudioEngine;

fn assert_db(actual: f64, expected: f64) {
    assert!(
        (actual - expected).abs() < 1e-6,
        "preamp {actual} dB, expected {expected} dB"
    );
}

#[test]
fn test_user_preamp_applies_with_equalizers_off() {
    let engine = AudioEngine::new().expect("Failed to create AudioEngine");
    engine.set_equalizer_enabled(false);
    engine.set_equalizer_preamp(-6.0);
    assert_db(engine.effective_preamp_db(), 0.0);

    engine.set_user_preamp(3.5);
    assert_eq!(engine.get_user_preamp(), 3.5);
    assert_db(engine.effective_preamp_db(), 3.5);

    // Enabling the graphic EQ adds its preamp on top of the user preamp.
    engine.set_equalizer_enabled(true);
    assert_db(engine.effective_preamp_db(), -2.5);

    engine.set_equalizer_enabled(false);
    assert_db(engine.effective_preamp_db(), 3.5);
}

#[test]
fn test_user_preamp_is_clamped() {
    let engine = AudioEngine::new().expect("Failed to create AudioEngine");
    engine.set_user_preamp(40.0);
    assert_eq!(engine.get_user_preamp(), 15.0);
    assert_db(engine.effective_preamp_db(), 15.0);
    engine.set_user_preamp(-40.0);
    assert_eq!(engine.get_user_preamp(), -15.0);
    assert_db(engine.effective_preamp_db(), -15.0);
}
