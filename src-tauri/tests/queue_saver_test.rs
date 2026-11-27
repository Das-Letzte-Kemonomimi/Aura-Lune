use auralune_desktop::commands::queue::QueueSaver;
use domain::queue::QueueItem;
use std::sync::Arc;

fn item(i: usize) -> QueueItem {
    QueueItem {
        id: format!("q-{i}"),
        track_id: None,
        uri: format!("/music/{i}.flac"),
        title: format!("T{i}"),
        artist: "A".into(),
        album: None,
        duration_ms: 1000,
    }
}

#[test]
fn test_burst_of_save_requests_persists_the_latest_queue() {
    let rt = tokio::runtime::Runtime::new().unwrap();
    let engine = Arc::new(audio_engine::AudioEngine::new().expect("audio engine"));
    let db = Arc::new(rt.block_on(storage::Database::new_in_memory()).unwrap());
    let saver = QueueSaver::spawn(&rt, engine.clone(), db.clone());

    // A series of quick changes (e.g. dragging items): each one requests a write.
    for n in 1..=5 {
        engine.restore_queue((0..n).map(item).collect(), Some(0));
        saver.request_save();
    }
    std::thread::sleep(QueueSaver::DEBOUNCE * 3);

    let saved = rt
        .block_on(db.load_queue_state())
        .unwrap()
        .expect("queue saved");
    assert_eq!(
        saved.items.len(),
        5,
        "the state after the last change is saved"
    );
    assert_eq!(saved.items[4].id, "q-4");

    // A later change after a pause is written too.
    engine.restore_queue(vec![item(9)], Some(0));
    saver.request_save();
    std::thread::sleep(QueueSaver::DEBOUNCE * 3);
    let saved = rt.block_on(db.load_queue_state()).unwrap().unwrap();
    assert_eq!(saved.items.len(), 1);
}
