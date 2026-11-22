mod common;

use common::{make_dummy_track, setup_test_db};
use storage::Database;

fn temp_db_path(name: &str) -> std::path::PathBuf {
    std::env::temp_dir().join(format!(
        "auralune_migr_{}_{}_{}.db",
        name,
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ))
}

fn remove_db(path: &std::path::Path) {
    for suffix in ["", "-wal", "-shm"] {
        let _ = std::fs::remove_file(format!("{}{}", path.display(), suffix));
    }
}

#[tokio::test]
async fn test_delete_track_with_playback_bookmark_cascades() {
    let db = setup_test_db().await;
    let track_id = db
        .upsert_track(&make_dummy_track("/music/bm.flac", "BM", "Artist"))
        .await
        .unwrap();
    db.save_bookmark(track_id, 42_000).await.unwrap();

    db.delete_track(track_id)
        .await
        .expect("Usunięcie utworu z zakładką nie może łamać klucza obcego");
    assert_eq!(db.get_bookmark(track_id).await.unwrap(), None);
}

#[tokio::test]
async fn test_fresh_database_reaches_latest_schema_version() {
    let db = setup_test_db().await;
    let version: i32 = sqlx::query_scalar("PRAGMA user_version;")
        .fetch_one(db.pool())
        .await
        .unwrap();
    assert_eq!(version, 3);
}

/// Baza z wersji 1 (zakładki bez CASCADE, `album_artist` zawierający tytuł albumu)
/// po ponownym otwarciu zostaje poprawnie zmigrowana do wersji 2, z zachowaniem danych.
#[tokio::test]
async fn test_upgrade_from_v1_fixes_bookmarks_fk_and_album_artist() {
    let path = temp_db_path("v1_upgrade");
    let (track_id, other_id) = {
        let db = Database::open(&path).await.unwrap();
        let pool = db.pool();
        // Odtworzenie schematu v1 dla zakładek.
        sqlx::query(
            "DROP TABLE playback_bookmarks;
             CREATE TABLE playback_bookmarks (
                 track_id INTEGER PRIMARY KEY REFERENCES tracks(id),
                 position_ms INTEGER NOT NULL,
                 updated_at INTEGER NOT NULL
             );
             PRAGMA user_version = 1;",
        )
        .execute(pool)
        .await
        .unwrap();

        let album_id = db
            .upsert_album("Kimi no Na wa", "RADWIMPS", Some(2016), None)
            .await
            .unwrap();
        let mut legacy = make_dummy_track("/music/legacy.flac", "Zenzenzense", "RADWIMPS");
        legacy.album_id = Some(album_id);
        legacy.album_artist = Some("Kimi no Na wa".into()); // błąd starego skanera
        let track_id = db.upsert_track(&legacy).await.unwrap();

        let mut other = make_dummy_track("/music/other.flac", "Other", "Someone");
        other.album_id = Some(album_id);
        other.album_artist = Some("Custom AA".into()); // poprawna wartość — nie ruszać
        let other_id = db.upsert_track(&other).await.unwrap();

        db.save_bookmark(track_id, 1234).await.unwrap();
        db.pool().close().await;
        (track_id, other_id)
    };

    let db = Database::open(&path).await.unwrap();
    let version: i32 = sqlx::query_scalar("PRAGMA user_version;")
        .fetch_one(db.pool())
        .await
        .unwrap();
    assert_eq!(version, 3);

    assert_eq!(
        db.get_bookmark(track_id).await.unwrap(),
        Some(1234),
        "Zakładka zachowana"
    );
    let tracks = db.list_tracks().await.unwrap();
    let legacy = tracks.iter().find(|t| t.id == track_id).unwrap();
    assert_eq!(legacy.album_artist.as_deref(), Some("RADWIMPS"));
    let other = tracks.iter().find(|t| t.id == other_id).unwrap();
    assert_eq!(other.album_artist.as_deref(), Some("Custom AA"));

    db.delete_track(track_id)
        .await
        .expect("CASCADE po migracji");
    assert_eq!(db.get_bookmark(track_id).await.unwrap(), None);

    // Ponowne otwarcie jest idempotentne.
    db.pool().close().await;
    let db = Database::open(&path).await.unwrap();
    assert_eq!(db.list_tracks().await.unwrap().len(), 1);
    db.pool().close().await;
    remove_db(&path);
}

#[tokio::test]
async fn test_delete_stale_tracks_is_scoped_to_root() {
    let db = setup_test_db().await;
    for p in [
        "/lib/a/keep.flac",
        "/lib/a/gone.flac",
        "/lib/ab/sibling.flac",
        "/other/x.flac",
    ] {
        db.upsert_track(&make_dummy_track(p, p, "A")).await.unwrap();
    }
    let removed = db
        .delete_stale_tracks("/lib/a", &["/lib/a/keep.flac".to_string()])
        .await
        .unwrap();
    assert_eq!(removed, 1);
    let mut paths: Vec<String> = db
        .list_tracks()
        .await
        .unwrap()
        .into_iter()
        .map(|t| t.path)
        .collect();
    paths.sort();
    assert_eq!(
        paths,
        vec!["/lib/a/keep.flac", "/lib/ab/sibling.flac", "/other/x.flac"]
    );
}

#[tokio::test]
async fn test_silence_bounds_cache_matches_threshold_and_file_version() {
    let db = setup_test_db().await;
    let id = db
        .upsert_track(&make_dummy_track("/music/s.flac", "S", "A"))
        .await
        .unwrap();
    let bounds = domain::SilenceBounds {
        start_ms: 1_200,
        end_ms: Some(180_000),
    };
    db.save_silence_bounds(id, -50.0, 1_700_000_000, &bounds)
        .await
        .unwrap();

    assert_eq!(
        db.get_silence_bounds(id, -50.0, 1_700_000_000)
            .await
            .unwrap(),
        Some(bounds)
    );
    assert_eq!(
        db.get_silence_bounds(id, -40.0, 1_700_000_000)
            .await
            .unwrap(),
        None,
        "inny próg"
    );
    assert_eq!(
        db.get_silence_bounds(id, -50.0, 1_700_000_999)
            .await
            .unwrap(),
        None,
        "plik zmieniony"
    );

    let updated = domain::SilenceBounds {
        start_ms: 0,
        end_ms: None,
    };
    db.save_silence_bounds(id, -50.0, 1_700_000_999, &updated)
        .await
        .unwrap();
    assert_eq!(
        db.get_silence_bounds(id, -50.0, 1_700_000_999)
            .await
            .unwrap(),
        Some(updated)
    );

    db.delete_track(id).await.unwrap();
    assert_eq!(
        db.get_silence_bounds(id, -50.0, 1_700_000_999)
            .await
            .unwrap(),
        None,
        "CASCADE"
    );
}
