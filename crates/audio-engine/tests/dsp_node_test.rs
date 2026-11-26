//! Tests for the `auralune_dsp` element in a real GStreamer pipeline.

use audio_engine::dsp_node::{register_dsp_element, AuraluneDsp};
use dsp_api::{DspEngine, DspParams};
use gstreamer as gst;
use gstreamer::prelude::*;
use gstreamer_app as gst_app;

const SOURCE: &str = "audiotestsrc wave=sine freq=440 num-buffers=60 samplesperbuffer=1024 ! \
     audio/x-raw,format=F32LE,rate=44100,channels=2,layout=interleaved";

struct Output {
    bytes: Vec<u8>,
    pts_ns: Vec<u64>,
}

impl Output {
    fn frames(&self) -> usize {
        self.bytes.len() / (2 * std::mem::size_of::<f32>())
    }
}

/// Runs a `SOURCE [! auralune_dsp] ! appsink` pipeline and collects every output buffer.
fn run(with_dsp: Option<DspParams>, switch_engine_after: Option<(usize, DspEngine)>) -> Output {
    gst::init().unwrap();
    let _ = register_dsp_element();
    let desc = match with_dsp {
        Some(_) => format!("{SOURCE} ! auralune_dsp name=dsp ! appsink name=sink sync=false"),
        None => format!("{SOURCE} ! appsink name=sink sync=false"),
    };
    let pipeline = gst::parse::launch(&desc)
        .unwrap()
        .downcast::<gst::Pipeline>()
        .unwrap();
    let dsp = pipeline
        .by_name("dsp")
        .map(|e| e.downcast::<AuraluneDsp>().unwrap());
    if let (Some(dsp), Some(params)) = (&dsp, with_dsp) {
        dsp.set_params(params).unwrap();
    }
    let sink = pipeline
        .by_name("sink")
        .unwrap()
        .downcast::<gst_app::AppSink>()
        .unwrap();

    pipeline.set_state(gst::State::Playing).unwrap();
    let mut out = Output {
        bytes: Vec::new(),
        pts_ns: Vec::new(),
    };
    let mut buffers = 0usize;
    while let Some(sample) = sink.try_pull_sample(gst::ClockTime::from_seconds(10)) {
        let buffer = sample.buffer().unwrap();
        out.pts_ns
            .push(buffer.pts().map(|p| p.nseconds()).unwrap_or(0));
        out.bytes
            .extend_from_slice(buffer.map_readable().unwrap().as_slice());
        buffers += 1;
        if let (Some(dsp), Some((after, engine))) = (&dsp, switch_engine_after) {
            if buffers == after {
                dsp.set_engine(engine);
            }
        }
    }
    assert!(sink.is_eos(), "the pipeline must reach EOS (no deadlock)");
    pipeline.set_state(gst::State::Null).unwrap();
    out
}

#[test]
fn test_bypass_is_bit_perfect() {
    let reference = run(None, None);
    let bypassed = run(Some(DspParams::default()), None);
    assert!(!reference.bytes.is_empty());
    assert_eq!(
        bypassed.bytes, reference.bytes,
        "Bypass must pass samples through unchanged"
    );
}

#[test]
fn test_rubberband_double_tempo_halves_duration_with_monotonic_timestamps() {
    let input_frames = run(None, None).frames();
    let params = DspParams {
        engine: DspEngine::RubberBand,
        tempo_ratio: 2.0,
        ..DspParams::default()
    };
    let out = run(Some(params), None);

    let ratio = out.frames() as f64 / input_frames as f64;
    assert!(
        (0.40..=0.60).contains(&ratio),
        "expected ~0.5× the length, got {ratio:.3}"
    );
    assert!(
        out.pts_ns.windows(2).all(|w| w[1] > w[0]),
        "timestamps must increase monotonically"
    );
}

#[test]
fn test_soundtouch_slower_tempo_lengthens_output() {
    let input_frames = run(None, None).frames();
    let params = DspParams {
        engine: DspEngine::SoundTouch,
        tempo_ratio: 0.5,
        ..DspParams::default()
    };
    let out = run(Some(params), None);
    let ratio = out.frames() as f64 / input_frames as f64;
    assert!(
        (1.6..=2.4).contains(&ratio),
        "expected ~2× the length, got {ratio:.3}"
    );
}

#[test]
fn test_switching_engines_mid_stream_keeps_the_stream_flowing() {
    let params = DspParams {
        engine: DspEngine::RubberBand,
        pitch_semitones: 3.0,
        ..DspParams::default()
    };
    let out = run(Some(params), Some((10, DspEngine::Bypass)));
    assert!(out.frames() > 0);

    let out = run(
        Some(DspParams::default()),
        Some((10, DspEngine::SoundTouch)),
    );
    assert!(out.frames() > 0);
}

#[test]
fn test_block_size_change_while_idle_is_applied() {
    gst::init().unwrap();
    let _ = register_dsp_element();
    let dsp = AuraluneDsp::new(Some("dsp_block"));
    dsp.set_block_size(100_000);
    assert_eq!(dsp.block_size(), 16384, "the block size is clamped");
    dsp.set_block_size(1024);
    assert_eq!(dsp.block_size(), 1024);
}

#[test]
fn test_very_slow_tempo_keeps_all_audio_and_monotonic_timestamps() {
    // Tempo 0.25 yields ~4× more frames than go in, more than 16 blocks per `chain`
    // call; all output must arrive in order, without lost samples.
    let input_frames = run(None, None).frames();
    let params = DspParams {
        engine: DspEngine::SoundTouch,
        tempo_ratio: 0.25,
        ..DspParams::default()
    };
    let out = run(Some(params), None);
    let ratio = out.frames() as f64 / input_frames as f64;
    assert!(
        (3.2..=4.8).contains(&ratio),
        "expected ~4× the length, got {ratio:.3}"
    );
    assert!(out.pts_ns.windows(2).all(|w| w[1] > w[0]));
}
