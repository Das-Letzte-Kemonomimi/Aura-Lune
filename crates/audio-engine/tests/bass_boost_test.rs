//! Bass Boost is a dedicated engine stage: it must never read or write the graphic EQ state.

use audio_engine::AudioEngine;
use domain::equalizer::{clamp_bass_boost_db, BASS_BOOST_MAX_DB};

#[test]
fn test_clamp_bass_boost_db_range() {
    assert_eq!(clamp_bass_boost_db(-3.0), 0.0);
    assert_eq!(clamp_bass_boost_db(6.0), 6.0);
    assert_eq!(clamp_bass_boost_db(99.0), BASS_BOOST_MAX_DB);
    assert_eq!(clamp_bass_boost_db(f64::NAN), 0.0);
    assert_eq!(clamp_bass_boost_db(f64::INFINITY), 0.0);
}

#[test]
fn test_bass_boost_leaves_equalizer_untouched() {
    let Ok(engine) = AudioEngine::new() else {
        eprintln!("GStreamer unavailable, skipping");
        return;
    };
    let bands = [2.0, -3.0, 1.5, 0.0, 4.0, 0.0, 0.0, -1.0, 0.0, 6.0];
    engine.set_equalizer_bands(&bands).unwrap();
    engine.set_equalizer_enabled(true);

    engine.set_bass_boost(9.0);
    assert_eq!(engine.get_bass_boost(), 9.0);
    assert_eq!(engine.get_equalizer_bands(), bands);
    assert!(engine.is_equalizer_enabled());

    engine.set_bass_boost(0.0);
    assert_eq!(engine.get_bass_boost(), 0.0);
    assert_eq!(engine.get_equalizer_bands(), bands);
    assert!(engine.is_equalizer_enabled());
}

#[test]
fn test_bass_boost_clamps_and_does_not_enable_equalizer() {
    let Ok(engine) = AudioEngine::new() else {
        return;
    };
    engine.set_bass_boost(50.0);
    assert_eq!(engine.get_bass_boost(), BASS_BOOST_MAX_DB);
    assert!(!engine.is_equalizer_enabled());
    assert_eq!(engine.get_equalizer_bands(), [0.0; 10]);
}
