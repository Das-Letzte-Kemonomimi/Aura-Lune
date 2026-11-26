use audio_engine::{AudioEngine, PlayerEvent};
use std::env;
use std::thread::sleep;
use std::time::Duration;
use tracing::{error, info, warn};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .init();

    info!("=== Kitsune Player (Auralune) — Spike CLI (stage 0) ===");

    let file_path = env::args()
        .nth(1)
        .unwrap_or_else(|| "tests/fixtures/test_sine_440hz.wav".to_string());

    info!("Checking the target file: {}", file_path);

    let engine = AudioEngine::new()?;
    engine.load_uri(&file_path)?;

    info!("Starting playback (default pitch = 0 st, tempo = 1.0x)...");
    engine.play()?;

    // Simulates playback with real-time pitch and tempo changes
    let steps = [
        (
            Duration::from_millis(600),
            0.0,
            1.0,
            "Original pitch (A4 = 440 Hz)",
        ),
        (
            Duration::from_millis(600),
            4.0,
            1.0,
            "Pitch shift: +4 semitones (+4 st, major third C#5)",
        ),
        (
            Duration::from_millis(600),
            7.0,
            1.0,
            "Pitch shift: +7 semitones (+7 st, perfect fifth E5)",
        ),
        (
            Duration::from_millis(600),
            12.0,
            1.25,
            "Pitch shift: +12 semitones (+1 oct), tempo: 1.25x",
        ),
        (
            Duration::from_millis(600),
            0.0,
            1.0,
            "Reset: pitch = 0 st, tempo = 1.0x",
        ),
    ];

    for (duration, semitones, tempo, label) in steps {
        info!(
            ">>> DSP: {} | pitch: {:.1} st, tempo: {:.2}x",
            label, semitones, tempo
        );
        engine.set_pitch_semitones(semitones)?;
        engine.set_tempo_ratio(tempo)?;

        let start = std::time::Instant::now();
        while start.elapsed() < duration {
            for event in engine.poll_events() {
                match event {
                    PlayerEvent::Eos => {
                        info!("Received EOS during a step!");
                        info!("Received EOS during a step!");
                    }
                    PlayerEvent::Error(err) => {
                        error!("Playback error: {}", err);
                        return Err(err.into());
                    }
                    PlayerEvent::Warning(w) => warn!("Warning: {}", w),
                    PlayerEvent::StateChanged { old, new } => {
                        info!("Pipeline state: {:?} -> {:?}", old, new);
                    }
                    _ => {}
                }
            }

            if let Some(pos) = engine.position() {
                let dur_str = engine
                    .duration()
                    .map(|d| format!("{:.2}s", d.as_secs_f64()))
                    .unwrap_or_else(|| "unknown".into());
                info!(
                    "Position: {:.2}s / {} | State: {:?}",
                    pos.as_secs_f64(),
                    dur_str,
                    engine.state()
                );
            }
            sleep(Duration::from_millis(200));
        }
    }

    info!("Test playback finished successfully. Stopping the engine...");
    engine.stop()?;
    info!("Done.");

    Ok(())
}
