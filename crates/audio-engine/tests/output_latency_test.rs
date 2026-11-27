//! Graph order that keeps effect changes and the spectrum close to what is heard.
//!
//! The 600 ms output queue must sit right after `auralune_dsp` (it absorbs the
//! Rubber Band / SoundTouch bursts), with the steady effects and the analyser after it,
//! so they lead the listener only by the sink ring buffer.

use audio_engine::AudioEngine;
use std::path::PathBuf;
use std::thread::sleep;
use std::time::Duration;

fn index_of(chain: &[String], name: &str) -> usize {
    chain
        .iter()
        .position(|n| n == name)
        .unwrap_or_else(|| panic!("{name} missing from the chain {chain:?}"))
}

#[test]
fn test_output_queue_sits_between_dsp_and_effects() {
    let engine = AudioEngine::new().expect("AudioEngine initialisation should succeed");
    let chain = engine.element_chain();

    assert_eq!(chain.first().map(String::as_str), Some("queue_in"));
    assert_eq!(chain.last().map(String::as_str), Some("sink"), "{chain:?}");

    let dsp = index_of(&chain, "auralune_dsp");
    let queue = index_of(&chain, "queue_sink");
    assert_eq!(
        queue,
        dsp + 1,
        "the queue follows the DSP directly: {chain:?}"
    );

    for effect in [
        "equalizer_10bands",
        "peq_equalizer",
        "compressor_dynamics",
        "rgvolume",
        "rglimiter",
        "spectrum_analyzer",
        "volume",
    ] {
        assert!(
            index_of(&chain, effect) > queue,
            "{effect} must run after the output queue: {chain:?}"
        );
    }
    assert!(
        index_of(&chain, "rglimiter") < index_of(&chain, "spectrum_analyzer"),
        "the analyser sees the final processed signal"
    );
    assert_eq!(
        index_of(&chain, "volume") + 1,
        index_of(&chain, "sink"),
        "volume stays right before the sink"
    );
}

#[test]
fn test_reverb_is_inserted_after_the_output_queue_while_playing() {
    let fixture = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../tests/fixtures/test_sine_440hz.wav")
        .canonicalize()
        .expect("fixture exists");
    let engine = AudioEngine::new().expect("AudioEngine initialisation should succeed");
    engine.set_volume(0.0).expect("volume should be accepted");
    engine
        .load_uri(&audio_engine::uri::media_uri(fixture.to_str().unwrap()))
        .expect("load should succeed");
    engine.play().expect("play should succeed");
    sleep(Duration::from_millis(200));

    engine.set_reverb_params(true, 0.75, 0.35, 1.0, 0.40);
    if !engine.is_reverb_linked() {
        // freeverb (gst-plugins-bad) is not installed.
        engine.stop().ok();
        return;
    }
    let chain = engine.element_chain();
    let queue = index_of(&chain, "queue_sink");
    assert_eq!(chain[queue + 1], "freeverb", "{chain:?}");
    assert_eq!(chain[queue + 2], "equalizer_10bands", "{chain:?}");

    engine.set_reverb_params(false, 0.75, 0.35, 1.0, 0.0);
    assert!(!engine.is_reverb_linked());
    let chain = engine.element_chain();
    let queue = index_of(&chain, "queue_sink");
    assert_eq!(chain[queue + 1], "equalizer_10bands", "{chain:?}");
    engine.stop().ok();
}
