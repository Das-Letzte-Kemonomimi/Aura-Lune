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

#[tokio::test]
async fn test_listening_history_coalesces_consecutive_same_track_within_ten_minutes() {
    let db = Database::new_in_memory()
        .await
        .expect("DB should initialize in-memory");
    let id1 = db
        .upsert_track(&make_test_track(1, "Alpha", "Artist", 44100, 16, None))
        .await
        .unwrap();
    let id2 = db
        .upsert_track(&make_test_track(2, "Beta", "Artist", 44100, 16, None))
        .await
        .unwrap();

    // Two consecutive heartbeats on track 1 merge into one row.
    db.record_track_listening(id1, 5_000).await.unwrap();
    db.record_track_listening(id1, 5_000).await.unwrap();
    let rows: Vec<(i64, i64)> =
        sqlx::query_as("SELECT track_id, duration_ms FROM listening_history ORDER BY id ASC;")
            .fetch_all(db.pool())
            .await
            .unwrap();
    assert_eq!(rows, vec![(id1, 10_000)]);

    // Switching to track 2 and back to track 1 keeps separate history entries.
    db.record_track_listening(id2, 5_000).await.unwrap();
    db.record_track_listening(id1, 5_000).await.unwrap();
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM listening_history;")
        .fetch_one(db.pool())
        .await
        .unwrap();
    assert_eq!(count, 3);

    // An older last row (> 600 s ago) is NOT merged on the next heartbeat.
    sqlx::query(
        "UPDATE listening_history SET played_at = played_at - 700 WHERE id = (SELECT MAX(id) FROM listening_history);",
    )
    .execute(db.pool())
    .await
    .unwrap();
    db.record_track_listening(id1, 5_000).await.unwrap();
    let count_after_gap: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM listening_history;")
        .fetch_one(db.pool())
        .await
        .unwrap();
    assert_eq!(count_after_gap, 4);
}

async fn seed_history(db: &Database, track_id: i64, duration_ms: i64, played_at: i64) {
    sqlx::query(
        "INSERT INTO listening_history (track_id, duration_ms, played_at) VALUES (?1, ?2, ?3);",
    )
    .bind(track_id)
    .bind(duration_ms)
    .bind(played_at)
    .execute(db.pool())
    .await
    .expect("seed history");
}

fn now_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64
}

#[tokio::test]
async fn recap_all_time_matches_last_year_when_history_is_recent() {
    let db = Database::new_in_memory().await.unwrap();
    let a = db
        .upsert_track(&make_test_track(1, "A", "Artist X", 44100, 16, None))
        .await
        .unwrap();
    let b = db
        .upsert_track(&make_test_track(2, "B", "Artist Y", 44100, 16, None))
        .await
        .unwrap();
    let now = now_secs();
    seed_history(&db, a, 300_000, now - 40 * 86400).await;
    seed_history(&db, a, 200_000, now - 2 * 86400).await;
    seed_history(&db, b, 100_000, now - 10 * 86400).await;
    // Legacy lifetime counters on the track row must not inflate "all time".
    db.record_track_play(a).await.unwrap();
    sqlx::query("UPDATE tracks SET play_count = 9, total_play_time_ms = 9000000 WHERE id = ?1;")
        .bind(a)
        .execute(db.pool())
        .await
        .unwrap();

    let year = db
        .get_recap_summary("year", now - 365 * 86400)
        .await
        .unwrap();
    let all = db.get_recap_summary("all", 0).await.unwrap();

    assert_eq!(year.total_listened_ms, 600_000);
    assert_eq!(all.total_listened_ms, year.total_listened_ms);
    assert_eq!(all.tracks_played_count, year.tracks_played_count);
    assert_eq!(all.tracks_played_count, 2);
    let ids = |r: &storage::RecapSummaryDto| {
        r.top_tracks
            .iter()
            .map(|t| (t.id, t.total_time_ms))
            .collect::<Vec<_>>()
    };
    assert_eq!(ids(&all), ids(&year));
    let artists = |r: &storage::RecapSummaryDto| {
        r.top_artists
            .iter()
            .map(|t| (t.artist.clone(), t.total_time_ms))
            .collect::<Vec<_>>()
    };
    assert_eq!(artists(&all), artists(&year));
}

#[tokio::test]
async fn recap_period_boundary_is_inclusive_and_excludes_older_plays() {
    let db = Database::new_in_memory().await.unwrap();
    let a = db
        .upsert_track(&make_test_track(1, "A", "Artist X", 44100, 16, None))
        .await
        .unwrap();
    let since = now_secs() - 7 * 86400;
    seed_history(&db, a, 1_000, since - 1).await;
    seed_history(&db, a, 2_000, since).await;
    seed_history(&db, a, 4_000, since + 1).await;

    let week = db.get_recap_summary("week", since).await.unwrap();
    assert_eq!(week.total_listened_ms, 6_000);
    let all = db.get_recap_summary("all", 0).await.unwrap();
    assert_eq!(all.total_listened_ms, 7_000);
    // A window with no plays does not fall back to lifetime counters.
    let empty = db.get_recap_summary("week", now_secs() + 10).await.unwrap();
    assert_eq!(empty.total_listened_ms, 0);
    assert!(empty.top_tracks.is_empty() && empty.top_artists.is_empty());
}

#[tokio::test]
async fn recap_all_time_falls_back_to_counters_without_any_history() {
    let db = Database::new_in_memory().await.unwrap();
    let a = db
        .upsert_track(&make_test_track(1, "A", "Artist X", 44100, 16, None))
        .await
        .unwrap();
    sqlx::query("UPDATE tracks SET play_count = 3, total_play_time_ms = 500000 WHERE id = ?1;")
        .bind(a)
        .execute(db.pool())
        .await
        .unwrap();
    let all = db.get_recap_summary("all", 0).await.unwrap();
    assert_eq!(all.total_listened_ms, 500_000);
    assert_eq!(all.top_tracks.len(), 1);
}
