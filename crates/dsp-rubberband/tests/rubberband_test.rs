use dsp_api::{AudioFormat, AudioProcessor, DspEngine, DspParams, ProcessStatus};
use dsp_rubberband::RubberBandProcessor;

fn generate_sine_wave(
    sample_rate: u32,
    freq: f32,
    duration_secs: f32,
    channels: usize,
) -> Vec<f32> {
    let total_frames = (sample_rate as f32 * duration_secs) as usize;
    let mut buffer = Vec::with_capacity(total_frames * channels);
    let step = 2.0 * std::f32::consts::PI * freq / sample_rate as f32;

    for i in 0..total_frames {
        let val = (i as f32 * step).sin() * 0.5;
        for _ in 0..channels {
            buffer.push(val);
        }
    }
    buffer
}

#[test]
fn test_rubberband_pitch_shift_and_tempo_stretch() {
    let mut processor = RubberBandProcessor::new();
    let format = AudioFormat::new(48000, 2).unwrap();
    let block_size = 1024;
    processor
        .prepare(format, block_size)
        .expect("prepare failed");

    assert_eq!(processor.name(), "RubberBand");

    // 1. Sprawdzenie opóźnienia
    let latency = processor.latency_frames();
    println!("Rubber Band latency: {} frames", latency);

    // 2. Test zmiany pitch (+12 półtonów - 1 oktawa w górę)
    let params = DspParams::new(DspEngine::RubberBand, 12.0, 1.0, 1.0).unwrap();
    processor.set_params(params).unwrap();

    let input = generate_sine_wave(48000, 440.0, 0.5, 2);
    let mut output = Vec::new();

    for chunk in input.chunks(block_size * 2) {
        let _ = processor.process(chunk, &mut output).unwrap();
    }

    let eos_status = processor.drain(&mut output).unwrap();
    assert_eq!(eos_status, ProcessStatus::Ok);

    assert!(
        !output.is_empty(),
        "RubberBand musi wyprodukować próbki wyjściowe"
    );

    // 3. Sprawdzenie reset()
    processor.reset().expect("reset failed");

    // 4. Test zmiany tempa (1.5x szybciej - tempo_ratio = 1.5)
    let params_tempo = DspParams::new(DspEngine::RubberBand, 0.0, 1.5, 1.0).unwrap();
    processor.set_params(params_tempo).unwrap();

    let mut output_tempo = Vec::new();
    for chunk in input.chunks(block_size * 2) {
        let _ = processor.process(chunk, &mut output_tempo).unwrap();
    }
    let _ = processor.drain(&mut output_tempo).unwrap();

    assert!(!output_tempo.is_empty());
}
