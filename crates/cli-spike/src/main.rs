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

    info!("=== Kitsune Player (Auralune) — Spike CLI (Etap 0) ===");

    let file_path = env::args()
        .nth(1)
        .unwrap_or_else(|| "tests/fixtures/test_sine_440hz.wav".to_string());

    info!("Sprawdzanie pliku docelowego: {}", file_path);

    let engine = AudioEngine::new()?;
    engine.load_uri(&file_path)?;

    info!("Rozpoczęcie odtwarzania (domyślny pitch = 0 st, tempo = 1.0x)...");
    engine.play()?;

    // Symulacja odtwarzania ze zmianą pitchu i tempa w czasie rzeczywistym
    let steps = [
        (
            Duration::from_millis(600),
            0.0,
            1.0,
            "Oryginalna wysokość (A4 = 440 Hz)",
        ),
        (
            Duration::from_millis(600),
            4.0,
            1.0,
            "Pitch shift: +4 półtony (+4 st, tercja wielka C#5)",
        ),
        (
            Duration::from_millis(600),
            7.0,
            1.0,
            "Pitch shift: +7 półtonów (+7 st, kwinta czysta E5)",
        ),
        (
            Duration::from_millis(600),
            12.0,
            1.25,
            "Pitch shift: +12 półtonów (+1 okt), tempo: 1.25x",
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
                        info!("Otrzymano EOS w trakcie kroku!");
                        return Ok(());
                    }
                    PlayerEvent::Error(err) => {
                        error!("Błąd odtwarzania: {}", err);
                        return Err(err.into());
                    }
                    PlayerEvent::Warning(w) => warn!("Ostrzeżenie: {}", w),
                    PlayerEvent::StateChanged { old, new } => {
                        info!("Stan potoku: {:?} -> {:?}", old, new);
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
                    "Pozycja: {:.2}s / {} | Stan: {:?}",
                    pos.as_secs_f64(),
                    dur_str,
                    engine.state()
                );
            }
            sleep(Duration::from_millis(200));
        }
    }

    info!("Testowe odtwarzanie zakończone sukcesem. Zatrzymywanie silnika...");
    engine.stop()?;
    info!("Gotowe.");

    Ok(())
}
