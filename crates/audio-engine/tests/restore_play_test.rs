use audio_engine::AudioEngine;
use domain::QueueItem;
use std::time::Duration;

#[test]
fn test_restore_queue_empty_or_none_and_play() {
    let engine = AudioEngine::new().expect("AudioEngine init");
    engine.restore_queue(vec![], None);

    // play_with_fade on empty queue should safely return Ok without starting empty pipeline
    let res = engine.play_with_fade(true);
    assert!(res.is_ok());
    assert_eq!(engine.state(), domain::PlaybackState::Stopped);
    assert_eq!(engine.current_uri(), None);

    // seek on uninitialized pipeline should safely remember position without glib::BoolError
    let seek_res = engine.seek(Duration::from_millis(1500));
    assert!(seek_res.is_ok());
    assert_eq!(engine.position(), Some(Duration::from_millis(1500)));
}

#[test]
fn test_restore_track_and_play_starts_cleanly() {
    let engine = AudioEngine::new().expect("AudioEngine init");

    let fixture_path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("tests/fixtures/test_sine_440hz.wav");

    let item = QueueItem {
        id: "restored-track".to_string(),
        track_id: Some(1),
        uri: fixture_path.to_str().unwrap().to_string(),
        title: "Test Sine 440Hz".to_string(),
        artist: "Test Artist".to_string(),
        album: None,
        duration_ms: 1000,
    };

    engine.set_active_item(item.clone());
    let load_res = engine.load_uri(&item.uri);
    assert!(load_res.is_ok());

    let resume_pos = Duration::from_millis(400);
    let seek_res = engine.seek(resume_pos);
    assert!(seek_res.is_ok());

    let play_res = engine.play_with_fade(true);
    assert!(play_res.is_ok());
    assert_eq!(engine.state(), domain::PlaybackState::Playing);

    // Position must stay at or past the restored seek target immediately on start and after preroll,
    // never resetting to 0:00/0:01.
    let immediate_pos = engine.position().expect("position after play_with_fade");
    assert!(
        immediate_pos >= resume_pos,
        "immediate position {immediate_pos:?} dropped below resume target {resume_pos:?}"
    );
    std::thread::sleep(Duration::from_millis(80));
    let settled_pos = engine.position().expect("position after playback settles");
    assert!(
        settled_pos >= resume_pos,
        "settled position {settled_pos:?} dropped below resume target {resume_pos:?}"
    );
    let _ = engine.stop();
}
