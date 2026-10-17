use audio_engine::AudioEngine;
use domain::queue::{LoopMode, QueueItem};
use std::path::PathBuf;
use std::time::Duration;

#[test]
fn test_audio_engine_queue_integration() {
    let wav_fixture = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("tests/fixtures/test_sine_440hz.wav");

    let opus_fixture = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("tests/fixtures/test_sine_440hz.opus");

    assert!(wav_fixture.exists());
    assert!(opus_fixture.exists());

    let engine = AudioEngine::new().expect("AudioEngine init");

    let item1 = QueueItem {
        id: "q-1".to_string(),
        track_id: Some(1),
        uri: format!("file://{}", wav_fixture.canonicalize().unwrap().display()),
        title: "Sine WAV".to_string(),
        artist: "Auralune Synth".to_string(),
        album: Some("Sine Waveform Collection".to_string()),
        duration_ms: 1000,
    };

    let item2 = QueueItem {
        id: "q-2".to_string(),
        track_id: Some(2),
        uri: format!("file://{}", opus_fixture.canonicalize().unwrap().display()),
        title: "Sine Opus".to_string(),
        artist: "Auralune Synth".to_string(),
        album: Some("Sine Waveform Collection".to_string()),
        duration_ms: 1000,
    };

    // 1. Ustawienie kolejki
    let active = engine
        .set_queue(vec![item1.clone(), item2.clone()], Some(0))
        .expect("set_queue");
    assert!(active.is_some());
    assert_eq!(active.unwrap().title, "Sine WAV");
    assert_eq!(engine.state(), domain::PlaybackState::Playing);

    std::thread::sleep(Duration::from_millis(100));

    // 2. Przejście do następnego utworu (play_next)
    let next = engine.play_next().expect("play_next");
    assert!(next.is_some());
    assert_eq!(next.unwrap().title, "Sine Opus");

    // 3. Sprawdzenie pętli (LoopMode::Queue)
    engine.set_loop_mode(LoopMode::Queue);
    assert_eq!(engine.loop_mode(), LoopMode::Queue);

    let wrapped = engine.play_next().expect("play_next wrapped");
    assert!(wrapped.is_some());
    assert_eq!(wrapped.unwrap().title, "Sine WAV");

    // 4. Poprzedni utwór (play_previous)
    let prev = engine.play_previous().expect("play_previous");
    assert!(prev.is_some());
    assert_eq!(prev.unwrap().title, "Sine Opus");

    // 5. Tryb losowy (Shuffle)
    engine.set_shuffle(true);
    assert!(engine.shuffle());

    // 6. Dynamiczne dodawanie do kolejki
    let item3 = QueueItem {
        id: "q-3".to_string(),
        track_id: Some(3),
        uri: format!("file://{}", wav_fixture.canonicalize().unwrap().display()),
        title: "Sine Interlude".to_string(),
        artist: "Auralune Synth".to_string(),
        album: None,
        duration_ms: 500,
    };
    engine.add_next_to_queue(item3);
    assert_eq!(engine.queue().items.len(), 3);

    // 7. Usunięcie z kolejki
    let removed = engine.remove_from_queue("q-3");
    assert!(removed.is_some());
    assert_eq!(removed.unwrap().title, "Sine Interlude");
    assert_eq!(engine.queue().items.len(), 2);

    engine.stop().expect("stop");
}
