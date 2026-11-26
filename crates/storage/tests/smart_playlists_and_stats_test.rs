use storage::{Database, TrackRecord};

fn make_test_track(
    id_suffix: i64,
    title: &str,
    artist: &str,
    sample_rate: i64,
    bit_depth: i64,
    bpm: Option<f64>,
) -> TrackRecord {
    TrackRecord {
        id: 0,
        path: format!("/music/track_{}.flac", id_suffix),
        title: title.to_string(),
        artist: artist.to_string(),
        album_artist: None,
        album_id: None,
        disc_no: Some(1),
        track_no: Some(id_suffix),
        duration_ms: 240_000,
        format: "FLAC".to_string(),
        sample_rate,
        channels: 2,
        bit_depth: Some(bit_depth),
        file_size: 25_000_000,
        modified_time: 1700000000 + id_suffix,
        is_favorite: Some(false),
        play_count: Some(0),
        last_played_at: None,
        total_play_time_ms: Some(0),
        bpm,
        initial_key: Some("C Major".to_string()),
        replaygain_track_gain: Some(-4.2),
        replaygain_track_peak: Some(0.98),
        rating: Some(0),
        added_at: None,
    }
}

#[tokio::test]
async fn test_smart_queries_favorites_ratings_and_hires() {
    let db = Database::new_in_memory()
        .await
        .expect("DB should initialize in-memory");

    // Standard track (16-bit 44.1kHz, 110 BPM)
    let t1 = make_test_track(
        1,
        "Chill Melody",
        "Ambient Producer",
        44100,
        16,
        Some(110.0),
    );
    // Hi-Res track (24-bit 96kHz, 128 BPM)
    let t2 = make_test_track(
        2,
        "Hi-Res Master",
        "Audiophile Studio",
        96000,
        24,
        Some(128.0),
    );
    // Fast track (16-bit 48kHz, 140 BPM)
    let t3 = make_test_track(3, "Speed Drum & Bass", "Fast Beat", 48000, 16, Some(140.0));

    let id1 = db.upsert_track(&t1).await.expect("upsert t1");
    let id2 = db.upsert_track(&t2).await.expect("upsert t2");
    let id3 = db.upsert_track(&t3).await.expect("upsert t3");

    // 1. Test Favorites Toggle
    let is_fav = db.toggle_favorite(id1).await.expect("toggle favorite t1");
    assert!(is_fav, "Track 1 should now be favorited");
    let favs = db.list_favorite_tracks().await.expect("list favorites");
    assert_eq!(favs.len(), 1);
    assert_eq!(favs[0].id, id1);

    // Toggle off
    let is_fav_off = db
        .toggle_favorite(id1)
        .await
        .expect("toggle off favorite t1");
    assert!(!is_fav_off, "Track 1 should no longer be favorited");
    let favs_empty = db.list_favorite_tracks().await.expect("list favorites");
    assert_eq!(favs_empty.len(), 0);

    // 2. Test Ratings & Top Rated Threshold (rating >= 4)
    db.set_track_rating(id2, 5).await.expect("rate t2");
    db.set_track_rating(id3, 3).await.expect("rate t3");

    // Only id2 (rating 5) should appear since rating 3 is below threshold (4)
    let top_rated = db.list_top_rated_tracks().await.expect("list top rated");
    assert_eq!(top_rated.len(), 1);
    assert_eq!(top_rated[0].id, id2);

    // Bump id3 to rating 4 -> both should now appear
    db.set_track_rating(id3, 4)
        .await
        .expect("bump rate t3 to 4");
    let top_rated_updated = db.list_top_rated_tracks().await.expect("list top rated");
    assert_eq!(top_rated_updated.len(), 2);
    assert_eq!(top_rated_updated[0].id, id2);
    assert_eq!(top_rated_updated[0].rating, Some(5));
    assert_eq!(top_rated_updated[1].id, id3);
    assert_eq!(top_rated_updated[1].rating, Some(4));

    // 3. Test Hi-Res Filtering (>= 24-bit or >= 88.2 kHz)
    let hires = db.list_hires_tracks().await.expect("list hires");
    assert_eq!(hires.len(), 1);
    assert_eq!(hires[0].id, id2);
    assert_eq!(hires[0].sample_rate, 96000);
    assert_eq!(hires[0].bit_depth, Some(24));

    // 4. Test High BPM Filtering (>= 120.0 BPM)
    let high_bpm = db.list_high_bpm_tracks(120.0).await.expect("list high bpm");
    assert_eq!(high_bpm.len(), 2);
    let high_bpm_ids: Vec<i64> = high_bpm.iter().map(|t| t.id).collect();
    assert!(high_bpm_ids.contains(&id2));
    assert!(high_bpm_ids.contains(&id3));
}

#[tokio::test]
async fn test_playback_statistics_and_recap() {
    let db = Database::new_in_memory()
        .await
        .expect("DB should initialize in-memory");

    let t1 = make_test_track(1, "Track A", "Star Artist", 44100, 16, None);
    let t2 = make_test_track(2, "Track B", "Star Artist", 44100, 16, None);
    let t3 = make_test_track(3, "Track C", "Other Artist", 44100, 16, None);

    let id1 = db.upsert_track(&t1).await.expect("upsert t1");
    let id2 = db.upsert_track(&t2).await.expect("upsert t2");
    let id3 = db.upsert_track(&t3).await.expect("upsert t3");

    // Record plays
    db.record_track_play(id1).await.expect("record play t1");
    db.record_track_play(id1)
        .await
        .expect("record play t1 second time");
    db.record_track_play(id2).await.expect("record play t2");
    db.record_track_play(id3).await.expect("record play t3");

    // Record listening duration (ms)
    db.record_track_listening(id1, 480_000)
        .await
        .expect("record listening t1");
    db.record_track_listening(id2, 240_000)
        .await
        .expect("record listening t2");
    db.record_track_listening(id3, 120_000)
        .await
        .expect("record listening t3");

    // Top played tracks check
    let top_played = db.list_top_played_tracks(5).await.expect("list top played");
    assert_eq!(top_played.len(), 3);
    assert_eq!(top_played[0].id, id1);
    assert_eq!(top_played[0].play_count, Some(2));

    // Reset track plays
    db.reset_track_plays(id1).await.expect("reset plays t1");
    let t1_after = db.get_track_by_id(id1).await.expect("get t1").unwrap();
    assert_eq!(t1_after.play_count, Some(0));
    assert_eq!(t1_after.total_play_time_ms, Some(0));

    // Recap summary from epoch 0
    let recap = db
        .get_recap_summary("all_time", 0)
        .await
        .expect("get recap");
    assert!(recap.tracks_played_count >= 2);
    assert!(recap.total_listened_ms >= 360_000);
}
