mod common;

use common::{make_dummy_track, setup_test_db};
use storage::TrackRecord;

#[tokio::test]
async fn test_artist_album_and_track_crud() {
    let db = setup_test_db().await;

    // 1. Dodawanie artysty i albumu
    let artist_id = db.upsert_artist("RADWIMPS").await.unwrap();
    assert!(artist_id > 0);

    let album_id = db
        .upsert_album("Your Name.", "RADWIMPS", Some(2016), None)
        .await
        .unwrap();
    assert!(album_id > 0);

    // 2. Dodawanie utworu
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

    // 3. Weryfikacja pobierania
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
        .upsert_album("Your Name.", "RADWIMPS", Some(2016), None)
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
    };
    let mut track2 = track1.clone();
    track2.path = "/music/sparkle_copy.mp3".to_string();

    let _t1_id = db.upsert_track(&track1).await.unwrap();
    let dup_id = db.upsert_track(&track2).await.unwrap();

    let duplicates = db.find_duplicate_tracks().await.unwrap();
    assert_eq!(duplicates.len(), 1);
    assert_eq!(duplicates[0].count, 2);
    assert_eq!(duplicates[0].tracks.len(), 2);

    // Test aktualizacji ścieżki (File Renamer)
    db.update_track_path(dup_id, "/music/RADWIMPS - Sparkle.mp3")
        .await
        .unwrap();
    let moved_track = db.get_track_by_id(dup_id).await.unwrap().unwrap();
    assert_eq!(moved_track.path, "/music/RADWIMPS - Sparkle.mp3");

    // Test usunięcia duplikatu
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
        )
        .await
        .unwrap();

    // Symulacja ponownego skanowania pliku z tagiem embedded cover (np. /tmp/extracted_tag.jpg)
    let rescan_id = db
        .upsert_album(
            "Verehrt Und Angespien",
            "In Extremo",
            Some(1999),
            Some("/tmp/extracted_tag.jpg"),
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

    // Okładka użytkownika MUSI pozostać nienaruszona!
    assert_eq!(
        album_rec.cover_path.as_deref(),
        Some("/covers/custom_in_extremo.jpg")
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
