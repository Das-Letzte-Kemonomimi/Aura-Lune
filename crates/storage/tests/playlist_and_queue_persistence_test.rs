use domain::queue::{LoopMode, PlaybackQueue, QueueItem};
use storage::{Database, TrackRecord};

fn make_dummy_track(path: &str, title: &str, artist: &str) -> TrackRecord {
    TrackRecord {
        id: 0,
        path: path.to_string(),
        title: title.to_string(),
        artist: artist.to_string(),
        album_artist: None,
        album_id: None,
        disc_no: Some(1),
        track_no: Some(1),
        duration_ms: 180_000,
        format: "FLAC".to_string(),
        sample_rate: 44100,
        channels: 2,
        bit_depth: Some(16),
        file_size: 10_000_000,
        modified_time: 1700000000,
        is_favorite: None,
        play_count: None,
        last_played_at: None,
        total_play_time_ms: None,
        bpm: None,
        initial_key: None,
        replaygain_track_gain: None,
        replaygain_track_peak: None,
        rating: None,
    }
}

#[tokio::test]
async fn test_queue_state_persistence_and_restoration() {
    let db = Database::new_in_memory()
        .await
        .expect("DB should initialize");

    let item1 = QueueItem {
        id: "item-1".to_string(),
        track_id: Some(101),
        uri: "file:///music/song1.flac".to_string(),
        title: "Song 1".to_string(),
        artist: "Artist 1".to_string(),
        album: Some("Album 1".to_string()),
        duration_ms: 210_000,
    };
    let item2 = QueueItem {
        id: "item-2".to_string(),
        track_id: Some(102),
        uri: "file:///music/song2.flac".to_string(),
        title: "Song 2".to_string(),
        artist: "Artist 2".to_string(),
        album: Some("Album 2".to_string()),
        duration_ms: 195_000,
    };

    let original_queue = PlaybackQueue {
        items: vec![item1, item2],
        current_index: Some(1),
        loop_mode: LoopMode::Queue,
        shuffle: true,
        shuffle_order: vec![1, 0],
        shuffle_cursor: 0,
        active_stream: None,
    };

    // Save state
    db.save_queue_state(&original_queue)
        .await
        .expect("save queue state");

    // Load state
    let loaded_queue = db
        .load_queue_state()
        .await
        .expect("load queue state")
        .expect("queue should exist");

    assert_eq!(loaded_queue.items.len(), 2);
    assert_eq!(loaded_queue.items[0].title, "Song 1");
    assert_eq!(loaded_queue.items[1].title, "Song 2");
    assert_eq!(loaded_queue.current_index, Some(1));
    assert_eq!(loaded_queue.loop_mode, LoopMode::Queue);
    assert!(loaded_queue.shuffle);
    assert_eq!(loaded_queue.shuffle_order, vec![1, 0]);
}

#[tokio::test]
async fn test_track_bookmarks_crud() {
    let db = Database::new_in_memory()
        .await
        .expect("DB should initialize");

    let t = make_dummy_track("/music/podcast.mp3", "Podcast Episode 1", "Host");
    let track_id = db.upsert_track(&t).await.expect("upsert track");

    // 1. Add bookmarks (name, position_ms)
    let b1 = db
        .add_track_bookmark(track_id, "Intro Topic", 35_000)
        .await
        .expect("add bookmark 1");
    let b2 = db
        .add_track_bookmark(track_id, "Guest Interview", 120_000)
        .await
        .expect("add bookmark 2");

    let bookmarks = db
        .get_track_bookmarks(track_id)
        .await
        .expect("get bookmarks");
    assert_eq!(bookmarks.len(), 2);
    assert_eq!(bookmarks[0].id, b1.id);
    assert_eq!(bookmarks[0].position_ms, 35_000);
    assert_eq!(bookmarks[0].name, "Intro Topic");

    // 2. Update bookmark name
    db.update_track_bookmark(b1.id, "Deep Dive Topic")
        .await
        .expect("update bookmark");
    let updated = db
        .get_track_bookmarks(track_id)
        .await
        .expect("get bookmarks after update");
    let b1_updated = updated.iter().find(|b| b.id == b1.id).unwrap();
    assert_eq!(b1_updated.position_ms, 35_000);
    assert_eq!(b1_updated.name, "Deep Dive Topic");

    // 3. Delete bookmark
    db.delete_track_bookmark(b2.id)
        .await
        .expect("delete bookmark 2");
    let remaining = db
        .get_track_bookmarks(track_id)
        .await
        .expect("get bookmarks after delete");
    assert_eq!(remaining.len(), 1);
    assert_eq!(remaining[0].id, b1.id);
}

#[tokio::test]
async fn test_app_settings_key_value_store() {
    let db = Database::new_in_memory()
        .await
        .expect("DB should initialize");

    // Nonexistent key
    let val_none = db
        .get_app_setting("volume_scale")
        .await
        .expect("get setting");
    assert!(val_none.is_none());

    // Set and get
    db.set_app_setting("volume_scale", "logarithmic")
        .await
        .expect("set setting");
    let val = db
        .get_app_setting("volume_scale")
        .await
        .expect("get setting")
        .expect("setting should exist");
    assert_eq!(val, "logarithmic");

    // Overwrite
    db.set_app_setting("volume_scale", "linear")
        .await
        .expect("overwrite setting");
    let val_updated = db
        .get_app_setting("volume_scale")
        .await
        .expect("get updated setting")
        .expect("setting should exist");
    assert_eq!(val_updated, "linear");
}

#[tokio::test]
async fn test_duplicate_tracks_detection() {
    let db = Database::new_in_memory()
        .await
        .expect("DB should initialize");

    // Two tracks with identical title and artist but different paths
    let t1 = make_dummy_track(
        "/music/folder_a/song.flac",
        "Identical Title",
        "Identical Artist",
    );
    let t2 = make_dummy_track(
        "/music/folder_b/song.mp3",
        "Identical Title",
        "Identical Artist",
    );
    // One unique track
    let t3 = make_dummy_track("/music/unique.flac", "Unique Title", "Unique Artist");

    db.upsert_track(&t1).await.expect("upsert t1");
    db.upsert_track(&t2).await.expect("upsert t2");
    db.upsert_track(&t3).await.expect("upsert t3");

    let duplicates = db.find_duplicate_tracks().await.expect("find duplicates");
    assert_eq!(duplicates.len(), 1, "Should identify one duplicate group");
    assert_eq!(duplicates[0].tracks.len(), 2);
    assert_eq!(duplicates[0].tracks[0].title, "Identical Title");
    assert_eq!(duplicates[0].tracks[1].title, "Identical Title");
}
