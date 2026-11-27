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
        .expect("Deleting a track with a bookmark must not break the foreign key");
    assert_eq!(db.get_bookmark(track_id).await.unwrap(), None);
}

#[tokio::test]
async fn test_fresh_database_reaches_latest_schema_version() {
    let db = setup_test_db().await;
    let version: i32 = sqlx::query_scalar("PRAGMA user_version;")
        .fetch_one(db.pool())
        .await
        .unwrap();
    assert_eq!(version, 8);
}

/// A version 1 database (bookmarks without CASCADE, `album_artist` holding the album title)
/// is migrated correctly to version 2 on reopening, keeping its data.
#[tokio::test]
async fn test_upgrade_from_v1_fixes_bookmarks_fk_and_album_artist() {
    let path = temp_db_path("v1_upgrade");
    let (track_id, other_id) = {
        let db = Database::open(&path).await.unwrap();
        let pool = db.pool();
        // Recreate the v1 bookmark schema.
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
            .upsert_album("Kimi no Na wa", "RADWIMPS", Some(2016), None, None)
            .await
            .unwrap();
        let mut legacy = make_dummy_track("/music/legacy.flac", "Zenzenzense", "RADWIMPS");
        legacy.album_id = Some(album_id);
        legacy.album_artist = Some("Kimi no Na wa".into()); // the old scanner's bug
        let track_id = db.upsert_track(&legacy).await.unwrap();

        let mut other = make_dummy_track("/music/other.flac", "Other", "Someone");
        other.album_id = Some(album_id);
        other.album_artist = Some("Custom AA".into()); // a correct value: leave it alone
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
    assert_eq!(version, 8);

    assert_eq!(
        db.get_bookmark(track_id).await.unwrap(),
        Some(1234),
        "Bookmark kept"
    );
    let tracks = db.list_tracks().await.unwrap();
    let legacy = tracks.iter().find(|t| t.id == track_id).unwrap();
    assert_eq!(legacy.album_artist.as_deref(), Some("RADWIMPS"));
    let other = tracks.iter().find(|t| t.id == other_id).unwrap();
    assert_eq!(other.album_artist.as_deref(), Some("Custom AA"));

    db.delete_track(track_id)
        .await
        .expect("CASCADE after the migration");
    assert_eq!(db.get_bookmark(track_id).await.unwrap(), None);

    // Reopening is idempotent.
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
        "another threshold"
    );
    assert_eq!(
        db.get_silence_bounds(id, -50.0, 1_700_000_999)
            .await
            .unwrap(),
        None,
        "file changed"
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

/// A database from before v1 (no statistics columns in `tracks`, no `release_mbid` in `albums`) opens
/// and migrates to the newest version: the indexes on the new columns are created only in step v1.
#[tokio::test]
async fn test_upgrade_from_pre_v1_database_adds_columns_and_indexes() {
    let path = temp_db_path("v0_upgrade");
    {
        let opts = sqlx::sqlite::SqliteConnectOptions::new()
            .filename(&path)
            .create_if_missing(true);
        let pool = sqlx::SqlitePool::connect_with(opts).await.unwrap();
        sqlx::query(
            "CREATE TABLE albums (
                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                 title TEXT NOT NULL,
                 album_artist TEXT NOT NULL,
                 year INTEGER,
                 cover_path TEXT,
                 UNIQUE(title, album_artist)
             );
             CREATE TABLE tracks (
                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                 path TEXT NOT NULL UNIQUE,
                 title TEXT NOT NULL,
                 artist TEXT NOT NULL,
                 album_artist TEXT,
                 album_id INTEGER REFERENCES albums(id),
                 disc_no INTEGER,
                 track_no INTEGER,
                 duration_ms INTEGER NOT NULL,
                 format TEXT NOT NULL,
                 sample_rate INTEGER NOT NULL,
                 channels INTEGER NOT NULL,
                 bit_depth INTEGER,
                 file_size INTEGER NOT NULL,
                 modified_time INTEGER NOT NULL
             );
             INSERT INTO tracks (path, title, artist, duration_ms, format, sample_rate, channels,
                                 file_size, modified_time)
             VALUES ('/music/old.flac', 'Old', 'Artist', 1000, 'flac', 44100, 2, 1, 1);",
        )
        .execute(&pool)
        .await
        .unwrap();
        pool.close().await;
    }

    let db = Database::open(&path)
        .await
        .expect("a pre-v1 database must migrate");
    let version: i32 = sqlx::query_scalar("PRAGMA user_version;")
        .fetch_one(db.pool())
        .await
        .unwrap();
    assert_eq!(version, 8);

    let indexes: Vec<String> =
        sqlx::query_scalar("SELECT name FROM sqlite_master WHERE type = 'index';")
            .fetch_all(db.pool())
            .await
            .unwrap();
    for idx in [
        "idx_tracks_favorite",
        "idx_tracks_last_played",
        "idx_tracks_rating",
    ] {
        assert!(indexes.iter().any(|i| i == idx), "missing index {idx}");
    }
    let tracks = db.list_tracks().await.unwrap();
    assert_eq!(tracks.len(), 1, "pre-migration data kept");
    db.pool().close().await;
    remove_db(&path);
}

/// Performance pragmas apply on every pool connection, not only the first one.
#[tokio::test]
async fn test_performance_pragmas_apply_to_every_pooled_connection() {
    let path = temp_db_path("pragmas");
    let db = Database::open(&path).await.unwrap();
    let mut conns = Vec::new();
    for _ in 0..3 {
        conns.push(db.pool().acquire().await.unwrap());
    }
    for conn in conns.iter_mut() {
        let cache: i64 = sqlx::query_scalar("PRAGMA cache_size;")
            .fetch_one(&mut **conn)
            .await
            .unwrap();
        assert_eq!(cache, -16000);
    }
    drop(conns);
    db.pool().close().await;
    remove_db(&path);
}

/// A v3 database (no `added_at`) is upgraded on reopening: existing tracks get their file
/// modification time as the added date.
#[tokio::test]
async fn test_upgrade_from_v3_backfills_added_at_from_modified_time() {
    let path = temp_db_path("v3_added_at");
    {
        let db = Database::open(&path).await.unwrap();
        db.upsert_track(&make_dummy_track("/music/old.flac", "Old", "Artist"))
            .await
            .unwrap();
        sqlx::query(
            "DROP INDEX idx_tracks_added_at;
             ALTER TABLE tracks DROP COLUMN added_at;
             PRAGMA user_version = 3;",
        )
        .execute(db.pool())
        .await
        .unwrap();
    }

    let db = Database::open(&path).await.unwrap();
    let added_at: i64 = sqlx::query_scalar("SELECT added_at FROM tracks WHERE path = ?1;")
        .bind("/music/old.flac")
        .fetch_one(db.pool())
        .await
        .unwrap();
    assert_eq!(added_at, 1_700_000_000);
    drop(db);
    remove_db(&path);
}

/// `added_at` is set when a track first enters the library and survives rescans.
#[tokio::test]
async fn test_upsert_sets_added_at_once_and_keeps_it_on_rescan() {
    let db = setup_test_db().await;
    let mut track = make_dummy_track("/music/new.flac", "New", "Artist");
    let id = db.upsert_track(&track).await.unwrap();
    let first = db.get_track_by_id(id).await.unwrap().unwrap().added_at;
    assert!(first.is_some_and(|t| t > 1_700_000_000));

    sqlx::query("UPDATE tracks SET added_at = 12345 WHERE id = ?1;")
        .bind(id)
        .execute(db.pool())
        .await
        .unwrap();
    track.title = "New (remaster)".to_string();
    db.upsert_track(&track).await.unwrap();
    let after = db.get_track_by_id(id).await.unwrap().unwrap();
    assert_eq!(after.added_at, Some(12345));
    assert_eq!(after.title, "New (remaster)");
}

/// Databases stamped at `user_version = 4` before `tracks.added_at` existed are repaired
/// in migration v5, and orphaned albums without tracks are pruned.
#[tokio::test]
async fn test_upgrade_from_broken_v4_repairs_added_at_and_prunes_empty_albums() {
    let path = temp_db_path("broken_v4");
    {
        let db = Database::open(&path).await.unwrap();
        let populated_album = db
            .upsert_album("With Track", "Artist A", Some(2020), None, None)
            .await
            .unwrap();
        let mut t = make_dummy_track("/music/keep.flac", "Keep", "Artist A");
        t.album_id = Some(populated_album);
        db.upsert_track(&t).await.unwrap();
        db.upsert_album("Orphaned Album", "Artist B", Some(2008), None, None)
            .await
            .unwrap();

        sqlx::query(
            "DROP INDEX IF EXISTS idx_tracks_added_at;
             ALTER TABLE tracks DROP COLUMN added_at;
             PRAGMA user_version = 4;",
        )
        .execute(db.pool())
        .await
        .unwrap();
    }

    let db = Database::open(&path).await.unwrap();
    let version: i32 = sqlx::query_scalar("PRAGMA user_version;")
        .fetch_one(db.pool())
        .await
        .unwrap();
    assert_eq!(version, 8);

    let added_at: i64 = sqlx::query_scalar("SELECT added_at FROM tracks WHERE path = ?1;")
        .bind("/music/keep.flac")
        .fetch_one(db.pool())
        .await
        .unwrap();
    assert_eq!(added_at, 1_700_000_000);

    let albums = db.list_albums().await.unwrap();
    assert_eq!(albums.len(), 1);
    assert_eq!(albums[0].title, "With Track");

    drop(db);
    remove_db(&path);
}

#[tokio::test]
async fn test_upgrade_from_v6_migrates_track_waveforms_to_v7() {
    let path = temp_db_path("v6_waveform_upgrade");
    let track_id = {
        let db = Database::open(&path).await.unwrap();
        let tid = db
            .upsert_track(&make_dummy_track("/music/v6_wave.flac", "Wave", "Artist"))
            .await
            .unwrap();
        sqlx::query(
            "DROP TABLE track_waveforms;
             CREATE TABLE track_waveforms (
                 track_id INTEGER PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
                 sample_count INTEGER NOT NULL,
                 peaks_json TEXT NOT NULL,
                 created_at INTEGER NOT NULL
             );
             INSERT INTO track_waveforms (track_id, sample_count, peaks_json, created_at)
             VALUES (?1, 3, '[0.2,0.5,0.9]', 1700000000);
             PRAGMA user_version = 6;",
        )
        .bind(tid)
        .execute(db.pool())
        .await
        .unwrap();
        tid
    };

    let db = Database::open(&path).await.unwrap();
    let version: i32 = sqlx::query_scalar("PRAGMA user_version;")
        .fetch_one(db.pool())
        .await
        .unwrap();
    assert_eq!(version, 8);

    // Legacy row has empty analyzer_version so versioned FFT lookup treats it as a miss.
    assert!(db
        .get_track_waveform_profile(track_id, 3, "fft-v1", 1_700_000_000)
        .await
        .unwrap()
        .is_none());
    // Legacy getter still reads the old row.
    assert_eq!(
        db.get_track_waveform(track_id).await.unwrap().as_deref(),
        Some("[0.2,0.5,0.9]")
    );

    drop(db);
    remove_db(&path);
}

#[tokio::test]
async fn test_upgrade_from_v7_to_v8_updates_indexes_and_queue_cursor() {
    let path = temp_db_path("v7_to_v8_upgrade");
    {
        let db = Database::open(&path).await.unwrap();
        let tid = db
            .upsert_track(&make_dummy_track(
                "/music/v7_song.flac",
                "V7 Song",
                "Artist",
            ))
            .await
            .unwrap();
        let pid = db.create_playlist("V7 List").await.unwrap();
        db.add_track_to_playlist(pid, tid).await.unwrap();

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id);
             CREATE INDEX IF NOT EXISTS idx_track_waveforms_track ON track_waveforms(track_id);
             DROP INDEX IF EXISTS idx_playlist_tracks_pos;
             CREATE TABLE queue_state_v7 (
                 id INTEGER PRIMARY KEY CHECK (id = 1),
                 queue_json TEXT NOT NULL,
                 updated_at INTEGER NOT NULL
             );
             DROP TABLE queue_state;
             ALTER TABLE queue_state_v7 RENAME TO queue_state;
             INSERT INTO queue_state (id, queue_json, updated_at)
             VALUES (1, '{\"items\":[{\"id\":\"q1\",\"track_id\":1,\"uri\":\"/music/v7_song.flac\",\"title\":\"V7 Song\",\"artist\":\"Artist\",\"album\":null,\"duration_ms\":180000}],\"current_index\":0,\"loop_mode\":\"None\",\"shuffle\":false,\"shuffle_order\":[0],\"shuffle_cursor\":0}', 1700000000);
             PRAGMA user_version = 7;",
        )
        .execute(db.pool())
        .await
        .unwrap();
    }

    let db = Database::open(&path).await.unwrap();
    let version: i32 = sqlx::query_scalar("PRAGMA user_version;")
        .fetch_one(db.pool())
        .await
        .unwrap();
    assert_eq!(version, 8);

    let indexes: Vec<String> =
        sqlx::query_scalar("SELECT name FROM sqlite_master WHERE type = 'index';")
            .fetch_all(db.pool())
            .await
            .unwrap();
    assert!(!indexes.contains(&"idx_playlist_tracks_playlist".to_string()));
    assert!(!indexes.contains(&"idx_track_waveforms_track".to_string()));
    assert!(indexes.contains(&"idx_playlist_tracks_pos".to_string()));

    let restored = db
        .load_queue_state()
        .await
        .unwrap()
        .expect("queue restored");
    assert_eq!(restored.items.len(), 1);
    assert_eq!(restored.current_index, Some(0));

    drop(db);
    remove_db(&path);
}

#[tokio::test]
async fn test_save_scanned_tracks_batch_matches_sequential_writes() {
    let batch_db = setup_test_db().await;
    let seq_db = setup_test_db().await;

    let scanned = vec![
        storage::ScannedTrack {
            record: make_dummy_track("/lib/a/1.flac", "One", "Artist 1"),
            album_title: "Album X".to_string(),
            album_artist: "Various".to_string(),
            year: Some(2020),
            cover_path: Some("/covers/x.jpg".to_string()),
            release_mbid: None,
        },
        storage::ScannedTrack {
            record: make_dummy_track("/lib/a/2.flac", "Two", "Artist 2"),
            album_title: "Album X".to_string(),
            album_artist: "Various".to_string(),
            year: None,
            cover_path: None,
            release_mbid: Some("mbid-1".to_string()),
        },
        storage::ScannedTrack {
            record: make_dummy_track("/lib/a/3.flac", "Three", "Artist 1"),
            album_title: "Album Y".to_string(),
            album_artist: "Artist 1".to_string(),
            year: Some(2022),
            cover_path: None,
            release_mbid: None,
        },
    ];

    let ids = batch_db.save_scanned_tracks(&scanned).await.unwrap();
    assert_eq!(ids.len(), 3);
    for item in &scanned {
        seq_db
            .save_scanned_track(
                &item.record,
                &item.album_title,
                &item.album_artist,
                item.year,
                item.cover_path.as_deref(),
                item.release_mbid.as_deref(),
            )
            .await
            .unwrap();
    }

    assert_eq!(
        batch_db.list_albums().await.unwrap().len(),
        seq_db.list_albums().await.unwrap().len()
    );
    assert_eq!(
        batch_db.list_artists().await.unwrap().len(),
        seq_db.list_artists().await.unwrap().len()
    );
    let batch_tracks = batch_db.list_tracks().await.unwrap();
    let seq_tracks = seq_db.list_tracks().await.unwrap();
    assert_eq!(batch_tracks.len(), seq_tracks.len());
    for (bt, st) in batch_tracks.iter().zip(seq_tracks.iter()) {
        assert_eq!(bt.path, st.path);
        assert_eq!(bt.title, st.title);
        assert_eq!(bt.artist, st.artist);
    }
    let batch_x = batch_db
        .list_albums()
        .await
        .unwrap()
        .into_iter()
        .find(|a| a.title == "Album X")
        .unwrap();
    assert_eq!(batch_x.cover_path.as_deref(), Some("/covers/x.jpg"));
    assert_eq!(batch_x.release_mbid.as_deref(), Some("mbid-1"));
    assert_eq!(batch_x.year, Some(2020));
}
