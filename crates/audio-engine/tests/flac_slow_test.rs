use audio_engine::AudioEngine;
use std::path::PathBuf;
use std::thread::sleep;
use std::time::Duration;

#[test]
fn test_flac_slow_playback_cleanliness() {
    let _ = tracing_subscriber::fmt()
        .with_max_level(tracing::Level::DEBUG)
        .try_init();

    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .to_path_buf();

    let flac_path = root.join("tests/fixtures/08. Omnia Sol Temperat.flac");
    if !flac_path.exists() {
        return;
    }

    let engine = AudioEngine::new().expect("Inicjalizacja AudioEngine");
    let flac_uri = format!("file://{}", flac_path.canonicalize().unwrap().display());
    engine.load_uri(&flac_uri).expect("Ładowanie utworu FLAC");

    // Test tempa poniżej 50% (0.35x - głęboki slowdown)
    engine
        .set_tempo_ratio(0.35)
        .expect("Ustawienie tempa 0.35x");
    engine.play().expect("Start odtwarzania");

    // Odtwarzanie przez 1.5 sekundy
    for _ in 0..15 {
        sleep(Duration::from_millis(100));
        let events = engine.poll_events();
        for ev in &events {
            if let audio_engine::PlayerEvent::Error(err) = ev {
                panic!("Wystąpił błąd w trakcie odtwarzania FLAC: {}", err);
            }
        }
    }

    assert!(engine.position().is_some(), "Pozycja powinna być dostępna");
    assert!(
        engine.duration().is_some(),
        "Czas utworu powinien być dostępny"
    );

    // Test dynamicznej zmiany parametrów tempa i silnika w locie na FLAC
    engine
        .set_dsp_engine(dsp_api::DspEngine::SoundTouch)
        .expect("Przełączenie na SoundTouch");
    sleep(Duration::from_millis(300));

    engine.set_tempo_ratio(1.2).expect("Przyspieszenie do 1.2x");
    sleep(Duration::from_millis(300));

    engine
        .set_dsp_engine(dsp_api::DspEngine::RubberBand)
        .expect("Przełączenie z powrotem na RubberBand");
    sleep(Duration::from_millis(300));

    engine.stop().expect("Zatrzymanie odtwarzania");
}

#[test]
fn test_dsp_flac_blocks_rubberband() {
    use dsp_api::{AudioFormat, AudioProcessor, DspEngine, DspParams};
    use dsp_rubberband::RubberBandProcessor;

    let mut proc = RubberBandProcessor::new();
    let fmt = AudioFormat::new(44100, 2).unwrap();
    proc.prepare(fmt, 4096).unwrap();

    let params = DspParams {
        engine: DspEngine::RubberBand,
        tempo_ratio: 0.35,
        ..Default::default()
    };
    proc.set_params(params).unwrap();

    let channels = 2;
    let flac_block_frames = 4096;
    let input_block = vec![0.1f32; flac_block_frames * channels];

    let mut out = Vec::new();
    let mut total_out = 0;
    for _ in 0..10 {
        let status = proc.process(&input_block, &mut out).unwrap();
        assert!(
            status == dsp_api::ProcessStatus::Ok || status == dsp_api::ProcessStatus::Buffering
        );
        total_out += out.len();
        out.clear();
    }
    assert!(
        total_out > 0,
        "RubberBand musi wyprodukować próbki dla bloków FLAC"
    );
}

#[test]
fn test_dsp_flac_soundtouch() {
    use dsp_api::{AudioFormat, AudioProcessor, DspEngine, DspParams};
    use dsp_soundtouch::SoundTouchProcessor;

    let mut proc = SoundTouchProcessor::new();
    let fmt = AudioFormat::new(44100, 2).unwrap();
    proc.prepare(fmt, 4096).unwrap();

    let params = DspParams {
        engine: DspEngine::SoundTouch,
        tempo_ratio: 0.35,
        ..Default::default()
    };
    proc.set_params(params).unwrap();

    let channels = 2;
    let flac_block_frames = 4096;
    let input_block = vec![0.1f32; flac_block_frames * channels];

    let mut out = Vec::new();
    let mut total_out = 0;
    for _ in 0..10 {
        let status = proc.process(&input_block, &mut out).unwrap();
        assert!(
            status == dsp_api::ProcessStatus::Ok || status == dsp_api::ProcessStatus::Buffering
        );
        total_out += out.len();
        out.clear();
    }
    assert!(
        total_out > 0,
        "SoundTouch musi wyprodukować próbki dla bloków FLAC"
    );
}
