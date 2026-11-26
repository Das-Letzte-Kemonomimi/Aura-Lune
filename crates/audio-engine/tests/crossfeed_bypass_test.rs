//! bs2b resets its own passthrough flag on every caps negotiation; the engine must keep
//! crossfeed bypassed while the user has it off, and running while it is on.

use audio_engine::AudioEngine;
use domain::crossfeed::CrossfeedConfig;
use std::time::{Duration, Instant};

/// Polls `cond` for up to `timeout`, so the test does not depend on exact buffer timing.
fn wait_for(timeout: Duration, cond: impl Fn() -> bool) -> bool {
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if cond() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(20));
    }
    cond()
}

fn fixture_uri() -> String {
    let fixture = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../tests/fixtures/test_sine_440hz.wav");
    audio_engine::uri::media_uri(&fixture.canonicalize().unwrap().to_string_lossy())
}

fn bs2b_missing() -> bool {
    gstreamer::init().unwrap();
    let missing = gstreamer::ElementFactory::find("bs2b").is_none();
    if missing {
        eprintln!("bs2b not installed (gst-plugins-bad), skipping");
    }
    missing
}

fn crossfeed(enabled: bool) -> CrossfeedConfig {
    CrossfeedConfig {
        enabled,
        ..CrossfeedConfig::default()
    }
}

/// Starts playback and waits until the stream is negotiated (position moving).
fn start_playing(engine: &AudioEngine) {
    engine
        .load_uri(&fixture_uri())
        .expect("Loading the fixture");
    engine.play().expect("Play");
    let moving = wait_for(Duration::from_secs(3), || {
        engine
            .position()
            .is_some_and(|p| p > Duration::from_millis(100))
    });
    assert!(moving, "playback should start");
}

#[test]
fn test_crossfeed_stays_bypassed_after_playback_starts() {
    if bs2b_missing() {
        return;
    }
    let engine = AudioEngine::new().expect("Failed to create AudioEngine");
    assert!(!engine.is_crossfeed_processing(), "bypassed at build");
    start_playing(&engine);
    assert!(
        !engine.is_crossfeed_processing(),
        "caps negotiation must not switch crossfeed on"
    );
    let _ = engine.stop();
}

#[test]
fn test_crossfeed_setting_survives_reload() {
    if bs2b_missing() {
        return;
    }
    let engine = AudioEngine::new().expect("Failed to create AudioEngine");
    // Off before the stream exists, then a new track renegotiates caps.
    engine.set_crossfeed(crossfeed(false)).unwrap();
    start_playing(&engine);
    let _ = engine.stop();
    start_playing(&engine);
    assert!(!engine.is_crossfeed_processing());

    // Switched on while playing, it stays on across a reload too.
    engine.set_crossfeed(crossfeed(true)).unwrap();
    assert!(engine.is_crossfeed_processing());
    let _ = engine.stop();
    start_playing(&engine);
    assert!(engine.is_crossfeed_processing());
    let _ = engine.stop();
}
