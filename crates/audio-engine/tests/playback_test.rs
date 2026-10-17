use audio_engine::AudioEngine;
use std::path::PathBuf;
use std::thread::sleep;
use std::time::Duration;

#[test]
fn test_audio_engine_playback_and_dsp_modulation() {
    let fixture_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("tests/fixtures/test_sine_440hz.wav");

    assert!(
        fixture_path.exists(),
        "Plik testowy powinien istnieć: {:?}",
        fixture_path
    );

    let engine = AudioEngine::new().expect("Inicjalizacja AudioEngine powinna się powieść");
    let uri = format!("file://{}", fixture_path.canonicalize().unwrap().display());

    engine
        .load_uri(&uri)
        .expect("Ładowanie pliku powinno się powieść");

    // Start odtwarzania
    engine.play().expect("Play powinno się powieść");
    sleep(Duration::from_millis(150));

    // Dynamiczna modulacja parametrów DSP
    engine
        .set_pitch_semitones(4.0)
        .expect("Zmiana pitchu na +4 półtony powinna się powieść");
    assert_eq!(engine.dsp_params().pitch_semitones, 4.0);

    engine
        .set_tempo_ratio(1.25)
        .expect("Zmiana tempa na 1.25x powinna się powieść");
    assert_eq!(engine.dsp_params().tempo_ratio, 1.25);

    sleep(Duration::from_millis(150));

    // Weryfikacja seek
    let seek_result = engine.seek(Duration::from_millis(200));
    assert!(seek_result.is_ok(), "Seek powinien się powieść");

    // Weryfikacja odpytywania magistrali
    let _events = engine.poll_events();

    // Wstrzymanie i zatrzymanie
    engine.pause().expect("Pauza powinna się powieść");
    engine.stop().expect("Stop powinien się powieść");
}
