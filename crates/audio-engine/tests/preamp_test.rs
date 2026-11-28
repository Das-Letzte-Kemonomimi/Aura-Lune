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

#[test]
fn test_band_edits_never_enable_the_graphic_eq_or_its_preamp() {
    let engine = AudioEngine::new().expect("Failed to create AudioEngine");
    engine.set_user_preamp(2.0);
    engine.set_equalizer_preamp(-6.0);
    assert!(!engine.is_equalizer_enabled());

    engine.set_equalizer_band(3, 9.0).expect("set band");
    engine.set_equalizer_bands(&[4.0; 10]).expect("set bands");

    // Bypassed: still off, and only the standalone user preamp is applied.
    assert!(!engine.is_equalizer_enabled());
    assert_db(engine.effective_preamp_db(), 2.0);

    // Only the user's switch turns the EQ (and its coupled preamp) on.
    engine.set_equalizer_enabled(true);
    assert_eq!(engine.get_equalizer_bands(), [4.0; 10]);
    assert_db(engine.effective_preamp_db(), -4.0);
}
