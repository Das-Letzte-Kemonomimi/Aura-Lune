//! Pins down how GStreamer's `rgvolume` treats `pre-amp` and `fallback-gain`
//! on a stream that carries no ReplayGain tags (and so no peak). The standalone preamp work
//! relies on this answer, so a GStreamer upgrade that changes it fails here.

use gstreamer::prelude::*;

/// Runs an untagged test tone through `rgvolume` to EOS and returns its `result-gain` (dB).
fn untagged_result_gain(pre_amp_db: f64, fallback_gain_db: f64, headroom_db: f64) -> f64 {
    gstreamer::init().unwrap();
    let pipeline = gstreamer::Pipeline::new();
    let src = gstreamer::ElementFactory::make("audiotestsrc")
        .property("num-buffers", 10i32)
        .build()
        .unwrap();
    let conv = gstreamer::ElementFactory::make("audioconvert")
        .build()
        .unwrap();
    let rgvolume = gstreamer::ElementFactory::make("rgvolume")
        .property("album-mode", false)
        .property("pre-amp", pre_amp_db)
        .property("fallback-gain", fallback_gain_db)
        .property("headroom", headroom_db)
        .build()
        .unwrap();
    let sink = gstreamer::ElementFactory::make("fakesink")
        .property("sync", false)
        .build()
        .unwrap();
    pipeline.add_many([&src, &conv, &rgvolume, &sink]).unwrap();
    gstreamer::Element::link_many([&src, &conv, &rgvolume, &sink]).unwrap();

    pipeline.set_state(gstreamer::State::Playing).unwrap();
    let bus = pipeline.bus().unwrap();
    let msg = bus
        .timed_pop_filtered(
            gstreamer::ClockTime::from_seconds(5),
            &[gstreamer::MessageType::Eos, gstreamer::MessageType::Error],
        )
        .expect("pipeline reached neither EOS nor an error");
    assert!(
        matches!(msg.view(), gstreamer::MessageView::Eos(_)),
        "pipeline error: {msg:?}"
    );
    let gain = rgvolume.property::<f64>("result-gain");
    pipeline.set_state(gstreamer::State::Null).unwrap();
    gain
}

fn assert_db(actual: f64, expected: f64) {
    assert!(
        (actual - expected).abs() < 1e-9,
        "result-gain {actual} dB, expected {expected} dB"
    );
}

/// The pre-amp is applied to untagged streams too: result = fallback-gain + pre-amp.
#[test]
fn test_untagged_pre_amp_adds_to_fallback_gain() {
    assert_db(untagged_result_gain(-3.0, 0.0, 0.0), -3.0);
    assert_db(untagged_result_gain(-3.0, -2.0, 0.0), -5.0);
    assert_db(untagged_result_gain(0.0, -2.0, 0.0), -2.0);
    assert_db(untagged_result_gain(3.0, -2.0, 6.0), 1.0);
}

/// Without peak tags a positive total is capped at `headroom` (default 0 dB), so a boost
/// on an untagged stream is silently lost unless headroom is raised.
#[test]
fn test_untagged_positive_gain_is_capped_at_headroom() {
    assert_db(untagged_result_gain(3.0, 0.0, 0.0), 0.0);
    assert_db(untagged_result_gain(3.0, -2.0, 0.0), 0.0);
    assert_db(untagged_result_gain(3.0, 0.0, 6.0), 3.0);
    assert_db(untagged_result_gain(8.0, 0.0, 6.0), 6.0);
}

/// Result gain of an untagged stream with the engine's mapping of the two user preamps.
fn untagged_result_for(tagged_db: f64, untagged_db: f64) -> f64 {
    use domain::replaygain::{ReplayGainConfig, ReplayGainMode};
    let params = ReplayGainConfig {
        mode: ReplayGainMode::Track,
        pre_amp_db: tagged_db,
        fallback_gain_db: untagged_db,
        prevent_clipping: true,
    }
    .rgvolume_params();
    untagged_result_gain(
        params.pre_amp_db,
        params.fallback_gain_db,
        params.headroom_db,
    )
}

/// An untagged file gets exactly the "files without RG tags" preamp, boosts included.
#[test]
fn test_untagged_preamp_is_independent_of_tagged_preamp() {
    assert_db(untagged_result_for(0.0, 3.0), 3.0);
    assert_db(untagged_result_for(2.0, -4.0), -4.0);
    assert_db(untagged_result_for(-6.0, 6.0), 6.0);
}
