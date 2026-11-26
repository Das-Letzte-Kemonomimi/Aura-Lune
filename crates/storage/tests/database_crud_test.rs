mod common;

use common::{make_dummy_track, setup_test_db};
use storage::TrackRecord;

#[tokio::test]
async fn test_artist_album_and_track_crud() {
    let db = setup_test_db().await;

    // 1. Add an artist and an album
    let artist_id = db.upsert_artist("RADWIMPS").await.unwrap();
    assert!(artist_id > 0);

    let album_id = db
        .upsert_album("Your Name.", "RADWIMPS", Some(2016), None, None)
        .await
        .unwrap();
    assert!(album_id > 0);

    // 2. Add a track
    let mut track = make_dummy_track("/music/sparkle.flac", "Sparkle", "RADWIMPS");
    track.album_artist = Some("RADWIMPS".to_string());
    track.album_id = Some(album_id);
    track.disc_no = Some(1);
    track.track_no = Some(8);
    track.duration_ms = 538000;
    track.sample_rate = 48000;
    track.bit_depth = Some(24);
    track.file_size = 65432100;

    let track_id = db.upsert_track(&track).await.unwrap();
    assert!(track_id > 0);

    // 3. Verify the reads
    let fetched = db.get_track_by_path("/music/sparkle.flac").await.unwrap();
    assert!(fetched.is_some());
    let fetched_track = fetched.unwrap();
    assert_eq!(fetched_track.title, "Sparkle");
    assert_eq!(fetched_track.duration_ms, 538000);
    assert_eq!(fetched_track.sample_rate, 48000);
}

#[tokio::test]
async fn test_track_metadata_update() {
    let db = setup_test_db().await;
    let track = make_dummy_track("/music/test.flac", "Old Title", "Old Artist");
    let track_id = db.upsert_track(&track).await.unwrap();

    db.update_track_metadata(
        track_id,
        "Sparkle (Movie Ver.)",
        "RADWIMPS",
        Some("RADWIMPS"),
        Some(8),
        Some(1),
        Some("Your Name."),
        Some(2016),
    )
    .await
    .unwrap();

    let updated = db.get_track_by_id(track_id).await.unwrap().unwrap();
    assert_eq!(updated.title, "Sparkle (Movie Ver.)");
    assert_eq!(updated.artist, "RADWIMPS");
    assert_eq!(updated.track_no, Some(8));
    assert_eq!(updated.disc_no, Some(1));
}

#[tokio::test]
async fn test_duplicate_tracks_detection_and_path_update() {
    let db = setup_test_db().await;
    let album_id = db
        .upsert_album("Your Name.", "RADWIMPS", Some(2016), None, None)
        .await
        .unwrap();

    let track1 = TrackRecord {
        id: 0,
        path: "/music/original.mp3".to_string(),
        title: "Sparkle (Movie Ver.)".to_string(),
        artist: "RADWIMPS".to_string(),
        album_artist: Some("RADWIMPS".to_string()),
        album_id: Some(album_id),
        disc_no: Some(1),
        track_no: Some(8),
        duration_ms: 538000,
        format: "MP3".to_string(),
        sample_rate: 44100,
        channels: 2,
        bit_depth: Some(16),
        file_size: 12000000,
        modified_time: 1600000000,
        is_favorite: None,
        play_count: None,
        last_played_at: None,
        total_play_time_ms: None,
        bpm: None,
        initial_key: None,
        replaygain_track_gain: None,
        replaygain_track_peak: None,
        rating: None,
        added_at: None,
    };
    let mut track2 = track1.clone();
    track2.path = "/music/sparkle_copy.mp3".to_string();

    let _t1_id = db.upsert_track(&track1).await.unwrap();
    let dup_id = db.upsert_track(&track2).await.unwrap();

    let duplicates = db.find_duplicate_tracks().await.unwrap();
    assert_eq!(duplicates.len(), 1);
    assert_eq!(duplicates[0].count, 2);
    assert_eq!(duplicates[0].tracks.len(), 2);

    // Path update test (file renamer)
    db.update_track_path(dup_id, "/music/RADWIMPS - Sparkle.mp3")
        .await
        .unwrap();
    let moved_track = db.get_track_by_id(dup_id).await.unwrap().unwrap();
    assert_eq!(moved_track.path, "/music/RADWIMPS - Sparkle.mp3");

    // Duplicate removal test
    db.delete_track(dup_id).await.unwrap();
    let remaining_dups = db.find_duplicate_tracks().await.unwrap();
    assert!(remaining_dups.is_empty());
}

#[tokio::test]
async fn test_album_cover_preservation_on_rescan() {
    let db = setup_test_db().await;

    let album_id = db
        .upsert_album(
            "Verehrt Und Angespien",
            "In Extremo",
            Some(1999),
            Some("/covers/custom_in_extremo.jpg"),
            Some("11111111-1111-1111-1111-111111111111"),
        )
        .await
        .unwrap();

    // Simulate rescanning a file with an embedded cover tag and a different MBID
    let rescan_id = db
        .upsert_album(
            "Verehrt Und Angespien",
            "In Extremo",
            Some(1999),
            Some("/tmp/extracted_tag.jpg"),
            Some("22222222-2222-2222-2222-222222222222"),
        )
        .await
        .unwrap();
    assert_eq!(album_id, rescan_id);

    let album_rec = db
        .list_albums()
        .await
        .unwrap()
        .into_iter()
        .find(|a| a.id == album_id)
        .expect("Album must exist");

    // The user's cover and existing MBID MUST stay untouched!
    assert_eq!(
        album_rec.cover_path.as_deref(),
        Some("/covers/custom_in_extremo.jpg")
    );
    assert_eq!(
        album_rec.release_mbid.as_deref(),
        Some("11111111-1111-1111-1111-111111111111")
    );

    // An album created without an MBID receives it on a later upsert when empty.
    let no_mbid_id = db
        .upsert_album("Kein Blick zurück", "In Extremo", Some(2006), None, None)
        .await
        .unwrap();
    db.upsert_album(
        "Kein Blick zurück",
        "In Extremo",
        Some(2006),
        None,
        Some("33333333-3333-3333-3333-333333333333"),
    )
    .await
    .unwrap();
    let updated = db.get_album_by_id(no_mbid_id).await.unwrap().unwrap();
    assert_eq!(
        updated.release_mbid.as_deref(),
        Some("33333333-3333-3333-3333-333333333333")
    );
}

#[tokio::test]
async fn test_playlist_lifecycle_and_track_ordering() {
    let db = setup_test_db().await;

    let track1 = make_dummy_track("/music/track1.flac", "Track One", "Artist A");
    let mut track2 = track1.clone();
    track2.path = "/music/track2.flac".to_string();
    track2.title = "Track Two".to_string();

    let t1_id = db.upsert_track(&track1).await.unwrap();
    let t2_id = db.upsert_track(&track2).await.unwrap();

    let pl_id = db.create_playlist("Chill Vibes").await.unwrap();
    assert!(pl_id > 0);

    let playlists = db.list_playlists().await.unwrap();
    assert_eq!(playlists.len(), 1);
    assert_eq!(playlists[0].name, "Chill Vibes");
    assert_eq!(playlists[0].track_count, 0);

    db.add_track_to_playlist(pl_id, t1_id).await.unwrap();
    db.add_track_to_playlist(pl_id, t2_id).await.unwrap();

    let pl_tracks = db.get_playlist_tracks(pl_id).await.unwrap();
    assert_eq!(pl_tracks.len(), 2);
    assert_eq!(pl_tracks[0].id, t1_id);
    assert_eq!(pl_tracks[1].id, t2_id);

    db.remove_track_from_playlist(pl_id, t1_id).await.unwrap();
    let remaining = db.get_playlist_tracks(pl_id).await.unwrap();
    assert_eq!(remaining.len(), 1);
    assert_eq!(remaining[0].id, t2_id);

    db.delete_playlist(pl_id).await.unwrap();
    let empty_pls = db.list_playlists().await.unwrap();
    assert_eq!(empty_pls.len(), 0);
}

#[tokio::test]
async fn test_first_track_matches_list_order_and_count() {
    let db = setup_test_db().await;
    assert_eq!(db.first_track().await.unwrap(), None);
    assert_eq!(db.count_tracks().await.unwrap(), 0);
    db.upsert_track(&make_dummy_track("/m/b.flac", "B", "Zeta"))
        .await
        .unwrap();
    db.upsert_track(&make_dummy_track("/m/a.flac", "A", "Alpha"))
        .await
        .unwrap();
    let first = db.first_track().await.unwrap().unwrap();
    assert_eq!(first.path, db.list_tracks().await.unwrap()[0].path);
    assert_eq!(first.artist, "Alpha");
    assert_eq!(db.count_tracks().await.unwrap(), 2);
}

#[tokio::test]
async fn test_list_app_settings_returns_all_pairs() {
    let db = setup_test_db().await;
    db.set_app_setting("seek_fade_enabled", "true")
        .await
        .unwrap();
    db.set_app_setting("crossfade_duration", "3000")
        .await
        .unwrap();
    let all = db.list_app_settings().await.unwrap();
    assert_eq!(
        all.get("seek_fade_enabled").map(String::as_str),
        Some("true")
    );
    assert_eq!(
        all.get("crossfade_duration").map(String::as_str),
        Some("3000")
    );
}

#[tokio::test]
async fn test_save_scanned_track_atomic_and_prunes_empty_albums() {
    let db = setup_test_db().await;
    let track1 = make_dummy_track("/music/ef/01.flac", "Track 1", "TENMON");
    let t1_id = db
        .save_scanned_track(&track1, "ef Soundtrack", "TENMON", Some(2008), None, None)
        .await
        .unwrap();
    assert!(t1_id > 0);
    assert_eq!(db.list_albums().await.unwrap().len(), 1);

    // Deleting the album's only track prunes the orphaned album.
    db.delete_track(t1_id).await.unwrap();
    assert!(db.list_albums().await.unwrap().is_empty());

    // Same for stale track cleanup during directory rescans.
    let track2 = make_dummy_track("/music/ef/02.flac", "Track 2", "TENMON");
    db.save_scanned_track(&track2, "ef Soundtrack", "TENMON", Some(2008), None, None)
        .await
        .unwrap();
    let removed = db.delete_stale_tracks("/music/ef", &[]).await.unwrap();
    assert_eq!(removed, 1);
    assert!(db.list_albums().await.unwrap().is_empty());
}

#[tokio::test]
async fn test_background_cover_context_and_cooldowns() {
    let db = setup_test_db().await;
    let t1 = make_dummy_track(
        "/music/ef/01.flac",
        "Two, Only Two.",
        "TENMON & Eiichiro Yanagi",
    );
    let t2 = make_dummy_track(
        "/music/ef/02.flac",
        "eternal feather",
        "TENMON & Eiichiro Yanagi",
    );
    db.save_scanned_track(
        &t1,
        "ef - espressivo",
        "TENMON & Eiichiro Yanagi",
        Some(2008),
        None,
        None,
    )
    .await
    .unwrap();
    db.save_scanned_track(
        &t2,
        "ef - espressivo",
        "TENMON & Eiichiro Yanagi",
        Some(2008),
        None,
        None,
    )
    .await
    .unwrap();

    assert_eq!(
        db.count_albums_needing_background_cover(1000, 1000)
            .await
            .unwrap(),
        1
    );
    let pending = db
        .list_albums_needing_background_cover(1000, 1000, 10)
        .await
        .unwrap();
    assert_eq!(pending.len(), 1);
    assert_eq!(pending[0].track_count, 2);
    assert_eq!(
        pending[0].sample_tracks,
        vec!["Two, Only Two.".to_string(), "eternal feather".to_string()]
    );
    let album_id = pending[0].album.id;

    // Recording a recent `not_found` keeps the album out of the automatic pending list until cooldown passes,
    // while `include_recent_attempts = true` still returns it for manual user syncs.
    db.record_cover_lookup_attempt(album_id, "not_found", 1200, None)
        .await
        .unwrap();
    assert_eq!(
        db.count_albums_needing_background_cover(1100, 1100)
            .await
            .unwrap(),
        0
    );
    assert_eq!(
        db.list_album_ids_needing_background_cover(true, 1100, 1100)
            .await
            .unwrap(),
        vec![album_id]
    );
    assert!(db
        .list_album_ids_needing_background_cover(false, 1100, 1100)
        .await
        .unwrap()
        .is_empty());
    assert!(db
        .list_albums_needing_background_cover(1100, 1100, 10)
        .await
        .unwrap()
        .is_empty());
    assert_eq!(
        db.list_albums_needing_background_cover(1200, 1100, 10)
            .await
            .unwrap()
            .len(),
        1
    );

    // Setting cover_path via `update_album_cover_if_missing` succeeds once, then refuses overwrite.
    assert!(db
        .update_album_cover_if_missing(album_id, "/cache/covers/a1.jpg", Some("mbid-1"))
        .await
        .unwrap());
    assert!(!db
        .update_album_cover_if_missing(album_id, "/cache/covers/a2.jpg", None)
        .await
        .unwrap());
    let updated = db.get_album_by_id(album_id).await.unwrap().unwrap();
    assert_eq!(updated.cover_path.as_deref(), Some("/cache/covers/a1.jpg"));
    assert_eq!(updated.release_mbid.as_deref(), Some("mbid-1"));
}
