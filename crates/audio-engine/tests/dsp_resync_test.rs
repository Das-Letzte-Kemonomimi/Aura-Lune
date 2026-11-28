use audio_engine::dsp_resync::needs_flush_resync;
use dsp_api::{DspEngine, DspParams};

fn params(engine: DspEngine, pitch: f64, tempo: f64, rate: f64) -> DspParams {
    DspParams::new(engine, pitch, tempo, rate).expect("valid params")
}

#[test]
fn tempo_pitch_and_rate_changes_flush() {
    let base = params(DspEngine::RubberBand, 0.0, 1.0, 1.0);
    assert!(needs_flush_resync(
        &base,
        &params(DspEngine::RubberBand, 0.0, 1.25, 1.0)
    ));
    assert!(needs_flush_resync(
        &base,
        &params(DspEngine::RubberBand, 2.0, 1.0, 1.0)
    ));
    assert!(needs_flush_resync(
        &base,
        &params(DspEngine::RubberBand, 0.0, 1.0, 1.5)
    ));
}

#[test]
fn identical_params_do_not_flush() {
    let p = params(DspEngine::RubberBand, 1.0, 1.1, 1.0);
    assert!(!needs_flush_resync(&p, &p));
}

#[test]
fn bypass_to_bypass_does_not_flush() {
    let a = params(DspEngine::Bypass, 3.0, 1.0, 1.0);
    let b = params(DspEngine::Bypass, 5.0, 1.0, 1.0);
    assert!(!needs_flush_resync(&a, &b));
}

#[test]
fn leaving_or_entering_identity_flushes() {
    let identity = params(DspEngine::SoundTouch, 0.0, 1.0, 1.0);
    let shifted = params(DspEngine::SoundTouch, 0.0, 0.8, 1.0);
    assert!(needs_flush_resync(&identity, &shifted));
    assert!(needs_flush_resync(&shifted, &identity));
}
