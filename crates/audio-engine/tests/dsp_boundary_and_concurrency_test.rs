use audio_engine::AudioEngine;
use std::path::PathBuf;
use std::thread::sleep;
use std::time::Duration;

#[test]
fn test_dsp_boundary_clamping_and_rapid_seeks() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let root = manifest_dir.parent().unwrap().parent().unwrap();
    let fixture_wav = root.join("tests/fixtures/test_sine_440hz.wav");

    assert!(fixture_wav.exists(), "Sine fixture must exist");

    let engine = AudioEngine::new().expect("AudioEngine should initialize");
    let uri = format!("file://{}", fixture_wav.canonicalize().unwrap().display());

    // 1. Volume clamping boundaries
    // Underflow -> clamp to 0.0
    engine.set_volume(-1.0).expect("set negative volume");
    assert!(engine.volume() >= 0.0, "Volume must not be negative");

    // Overflow -> clamp to 2.0 (preamp max)
    engine.set_volume(10.0).expect("set overflow volume");
    assert!(engine.volume() <= 2.0, "Volume must not exceed 2.0");

    // Normal volume
    engine.set_volume(0.75).expect("set normal volume");
    assert!((engine.volume() - 0.75).abs() < 1e-4);

    // 2. Load URI and start playback
    engine.load_uri(&uri).expect("load uri");
    engine.play().expect("play");
    sleep(Duration::from_millis(50));

    // 3. Rapid consecutive seeks (simulating user violently dragging slider)
    for i in 1..=15 {
        let target_ms = (i * 200) as u64;
        let _ = engine.seek(Duration::from_millis(target_ms));
    }
    sleep(Duration::from_millis(50));

    // 4. Seek beyond track duration (clamp to duration, no crash)
    let _ = engine.seek(Duration::from_secs(3600));
    sleep(Duration::from_millis(50));

    // 5. Clean stop
    engine.stop().expect("stop");
}

/// Regression: `play_index` (queue → inner) and `play()` (inner → queue) called from different threads
/// must not deadlock. The test fails if the threads don't finish within the timeout.
#[test]
fn test_concurrent_play_and_play_index_do_not_deadlock() {
    use domain::queue::QueueItem;
    use std::sync::mpsc;
    use std::sync::Arc;

    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let root = manifest_dir.parent().unwrap().parent().unwrap();
    let fixture_wav = root.join("tests/fixtures/test_sine_440hz.wav");
    let uri = format!("file://{}", fixture_wav.canonicalize().unwrap().display());

    let engine = Arc::new(AudioEngine::new().expect("AudioEngine should initialize"));
    engine.set_volume(0.0).expect("mute for test");
    let items: Vec<QueueItem> = (0..3)
        .map(|i| QueueItem {
            id: format!("dl-{i}"),
            track_id: None,
            uri: uri.clone(),
            title: format!("Sine {i}"),
            artist: "Test".into(),
            album: None,
            duration_ms: 1000,
        })
        .collect();
    engine.restore_queue(items, Some(0));

    let (tx, rx) = mpsc::channel();
    let mut handles = Vec::new();
    for worker in 0..2 {
        let engine = Arc::clone(&engine);
        let tx = tx.clone();
        handles.push(std::thread::spawn(move || {
            for i in 0..25 {
                if worker == 0 {
                    let _ = engine.play_index(i % 3);
                } else {
                    let _ = engine.play();
                    let _ = engine.current_queue_item();
                }
            }
            tx.send(()).unwrap();
        }));
    }
    drop(tx);

    for _ in 0..2 {
        rx.recv_timeout(Duration::from_secs(30))
            .expect("play()/play_index() deadlocked");
    }
    for h in handles {
        h.join().unwrap();
    }
    engine.stop().expect("stop");
}
