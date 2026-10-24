use audio_engine::AudioEngine;
use std::path::PathBuf;
use std::thread::sleep;
use std::time::Duration;

#[test]
fn test_flac_slow_playback_cleanliness() {
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

    // Odtwarzanie przez 1.2 sekundy
    for _ in 0..12 {
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

    engine.stop().expect("Zatrzymanie odtwarzania");
}
