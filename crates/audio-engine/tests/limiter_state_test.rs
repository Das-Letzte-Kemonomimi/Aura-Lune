//! The true-peak limiter (rglimiter) has a single owner: its state is derived from the user's
//! limiter switch and the ReplayGain clipping guard, whatever order those were changed in.

use audio_engine::AudioEngine;
use domain::dynamics::DynamicsState;
use domain::replaygain::{effective_limiter_enabled, ReplayGainConfig, ReplayGainMode};

const MODES: [ReplayGainMode; 4] = [
    ReplayGainMode::Off,
    ReplayGainMode::Track,
    ReplayGainMode::Album,
    ReplayGainMode::Auto,
];

fn rg(mode: ReplayGainMode, prevent_clipping: bool) -> ReplayGainConfig {
    ReplayGainConfig {
        mode,
        prevent_clipping,
        ..ReplayGainConfig::default()
    }
}

#[test]
fn test_effective_limiter_truth_table() {
    for user in [false, true] {
        for mode in MODES {
            for prevent in [false, true] {
                let expected = user || (mode != ReplayGainMode::Off && prevent);
                assert_eq!(
                    effective_limiter_enabled(user, mode, prevent),
                    expected,
                    "user={user}, mode={mode:?}, prevent_clipping={prevent}"
                );
            }
        }
    }
}

#[test]
fn test_engine_limiter_matches_rule_in_either_write_order() {
    let engine = AudioEngine::new().expect("Failed to create AudioEngine");
    for user in [false, true] {
        for mode in MODES {
            for prevent in [false, true] {
                let expected = effective_limiter_enabled(user, mode, prevent);

                // User switch first, then ReplayGain.
                engine.set_limiter_enabled(user);
                engine.set_replaygain(rg(mode, prevent)).unwrap();
                assert_eq!(engine.effective_limiter_enabled(), expected);

                // ReplayGain first, then the user switch.
                engine.set_replaygain(rg(mode, prevent)).unwrap();
                engine.set_limiter_enabled(user);
                assert_eq!(engine.effective_limiter_enabled(), expected);

                // ReplayGain first, then a full Dynamics Studio state.
                let mut dynamics = DynamicsState::default();
                dynamics.limiter.enabled = user;
                engine.set_replaygain(rg(mode, prevent)).unwrap();
                engine.set_dynamics_state(&dynamics).unwrap();
                assert_eq!(engine.effective_limiter_enabled(), expected);
                assert_eq!(engine.is_limiter_enabled(), user);
                assert_eq!(engine.replaygain_status().2, expected);
            }
        }
    }
}

#[test]
fn test_replaygain_off_keeps_a_user_enabled_limiter() {
    let engine = AudioEngine::new().expect("Failed to create AudioEngine");
    engine.set_limiter_enabled(true);
    engine
        .set_replaygain(rg(ReplayGainMode::Track, true))
        .unwrap();
    engine
        .set_replaygain(rg(ReplayGainMode::Off, true))
        .unwrap();
    assert!(engine.effective_limiter_enabled());
    assert!(engine.is_limiter_enabled());
}

#[test]
fn test_replaygain_guard_alone_turns_off_with_replaygain() {
    let engine = AudioEngine::new().expect("Failed to create AudioEngine");
    engine.set_limiter_enabled(false);
    engine
        .set_replaygain(rg(ReplayGainMode::Track, true))
        .unwrap();
    assert!(engine.effective_limiter_enabled());
    assert!(!engine.is_limiter_enabled());

    engine
        .set_replaygain(rg(ReplayGainMode::Off, true))
        .unwrap();
    assert!(!engine.effective_limiter_enabled());
}

#[test]
fn test_new_engine_limiter_follows_defaults() {
    let engine = AudioEngine::new().expect("Failed to create AudioEngine");
    let defaults = ReplayGainConfig::default();
    let expected = effective_limiter_enabled(
        DynamicsState::default().limiter.enabled,
        defaults.mode,
        defaults.prevent_clipping,
    );
    assert_eq!(engine.effective_limiter_enabled(), expected);
}

#[test]
fn test_clip_indicator_resets() {
    let engine = AudioEngine::new().expect("Failed to create AudioEngine");
    assert!(!engine.clip_detected());
    engine.reset_clip_indicator();
    assert!(!engine.clip_detected());
}

/// Polls `cond` for up to `timeout`, so the test does not depend on exact buffer timing.
fn wait_for(timeout: std::time::Duration, cond: impl Fn() -> bool) -> bool {
    let deadline = std::time::Instant::now() + timeout;
    while std::time::Instant::now() < deadline {
        if cond() {
            return true;
        }
        std::thread::sleep(std::time::Duration::from_millis(20));
    }
    cond()
}

#[test]
fn test_clip_probe_latches_on_boosted_playback() {
    let fixture = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../tests/fixtures/test_sine_440hz.wav");
    let uri = audio_engine::uri::media_uri(&fixture.canonicalize().unwrap().to_string_lossy());
    let engine = AudioEngine::new().expect("Failed to create AudioEngine");
    engine.set_user_preamp(-15.0);
    engine.load_uri(&uri).expect("Loading the fixture");
    engine.play().expect("Play");

    // A -15 dB cut keeps the sine under full scale: the latch stays clear.
    std::thread::sleep(std::time::Duration::from_millis(300));
    engine.reset_clip_indicator();
    std::thread::sleep(std::time::Duration::from_millis(300));
    assert!(!engine.clip_detected(), "no clip expected at -15 dB");

    // +15 dB pushes it past 0 dBFS before the limiter.
    engine.set_user_preamp(15.0);
    let latched = wait_for(std::time::Duration::from_secs(2), || engine.clip_detected());
    assert!(latched, "the clip latch should set at +15 dB");

    // Reset clears it; back at -15 dB it stays clear.
    engine.set_user_preamp(-15.0);
    std::thread::sleep(std::time::Duration::from_millis(300));
    engine.reset_clip_indicator();
    std::thread::sleep(std::time::Duration::from_millis(300));
    assert!(!engine.clip_detected());
    let _ = engine.stop();
}
