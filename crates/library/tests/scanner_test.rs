use library::LibraryScanner;
use std::path::PathBuf;
use storage::Database;

#[tokio::test]
async fn test_library_scanner_incremental_and_db_persistence() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let root = manifest_dir.parent().unwrap().parent().unwrap();

    let fixtures_dir = root.join("tests/fixtures");
    assert!(fixtures_dir.exists(), "The fixtures directory must exist");

    let cache_dir = root.join("tests/fixtures/cache_test");
    let scanner = LibraryScanner::new(&cache_dir);

    // 1. Create an in-memory database
    let db = Database::new_in_memory().await.unwrap();

    // 2. First scan (should index the WAV and Opus files)
    let summary1 = scanner.scan_directory(&fixtures_dir, &db).await.unwrap();
    assert!(
        summary1.total_files_found >= 2,
        "Should find at least test.wav and test.opus"
    );
    assert!(
        summary1.new_or_updated_tracks >= 2,
        "Should index at least 2 new files"
    );
    assert_eq!(
        summary1.skipped_unchanged, 0,
        "No file should be skipped on the first scan"
    );

    // Verify the database
    let tracks = db.list_tracks().await.unwrap();
    assert!(tracks.len() >= 2);
    let albums = db.list_albums().await.unwrap();
    assert!(!albums.is_empty());
    let artists = db.list_artists().await.unwrap();
    assert!(!artists.is_empty());

    // 3. Second scan (INCREMENTAL TEST: the files are unchanged)
    let summary2 = scanner.scan_directory(&fixtures_dir, &db).await.unwrap();
    assert_eq!(
        summary2.new_or_updated_tracks, 0,
        "A rescan should find no new tracks"
    );
    assert!(
        summary2.skipped_unchanged >= 2,
        "Every unchanged file should be skipped within microseconds"
    );

    // Clean up the test's cache directory
    let _ = std::fs::remove_dir_all(&cache_dir);
}

#[tokio::test]
async fn test_library_scanner_scan_paths_individual_files_and_folders() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let root = manifest_dir.parent().unwrap().parent().unwrap();
    let fixtures_dir = root.join("tests/fixtures");
    let cache_dir = root.join("tests/fixtures/cache_paths_test");
    let scanner = LibraryScanner::new(&cache_dir);
    let db = Database::new_in_memory().await.unwrap();

    let wav_file = fixtures_dir.join("test_sine_440hz.wav");
    let opus_file = fixtures_dir.join("test_sine_440hz.opus");
    let paths = vec![wav_file, opus_file];

    let summary = scanner.scan_paths(&paths, &db).await.unwrap();
    assert_eq!(summary.total_files_found, 2);
    assert_eq!(summary.new_or_updated_tracks, 2);

    let tracks = db.list_tracks().await.unwrap();
    assert_eq!(tracks.len(), 2);

    let _ = std::fs::remove_dir_all(&cache_dir);
}

/// Creates a unique temp directory for the test.
fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "auralune_scanner_{}_{}_{}",
        name,
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

fn fixture(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("tests/fixtures")
        .join(name)
}

/// Copies the Opus fixture and tags it (artist, album, optionally the album artist).
fn tagged_copy(dest: &std::path::Path, artist: &str, album: &str, album_artist: Option<&str>) {
    use lofty::config::WriteOptions;
    use lofty::file::{AudioFile, TaggedFileExt};
    use lofty::probe::Probe;
    use lofty::tag::{Accessor, ItemKey, ItemValue, TagItem};

    std::fs::copy(fixture("test_sine_440hz.opus"), dest).unwrap();
    let mut tagged = Probe::open(dest).unwrap().read().unwrap();
    let tag = tagged.primary_tag_mut().expect("Opus zawsze ma OpusTags");
    tag.set_artist(artist.to_string());
    tag.set_album(album.to_string());
    tag.set_title(format!("{artist} track"));
    if let Some(aa) = album_artist {
        tag.insert(TagItem::new(
            ItemKey::AlbumArtist,
            ItemValue::Text(aa.into()),
        ));
    }
    tagged.save_to_path(dest, WriteOptions::default()).unwrap();
}

#[tokio::test]
async fn test_scanner_groups_compilation_by_album_artist() {
    let dir = temp_dir("compilation");
    let cache = temp_dir("compilation_cache");
    tagged_copy(
        &dir.join("a.opus"),
        "Artist A",
        "Anime Hits",
        Some("Various Artists"),
    );
    tagged_copy(
        &dir.join("b.opus"),
        "Artist B",
        "Anime Hits",
        Some("Various Artists"),
    );
    tagged_copy(&dir.join("c.opus"), "Solo Artist", "Solo Album", None);

    let db = Database::new_in_memory().await.unwrap();
    LibraryScanner::new(&cache)
        .scan_directory(&dir, &db)
        .await
        .unwrap();

    let albums = db.list_albums().await.unwrap();
    assert_eq!(
        albums.len(),
        2,
        "A compilation is one album, not one per artist"
    );
    let compilation = albums.iter().find(|a| a.title == "Anime Hits").unwrap();
    assert_eq!(compilation.album_artist, "Various Artists");
    let solo = albums.iter().find(|a| a.title == "Solo Album").unwrap();
    assert_eq!(
        solo.album_artist, "Solo Artist",
        "Without an ALBUMARTIST tag the artist is used"
    );

    for t in db.list_tracks().await.unwrap() {
        let expected = if t.artist == "Solo Artist" {
            "Solo Artist"
        } else {
            "Various Artists"
        };
        assert_eq!(t.album_artist.as_deref(), Some(expected));
        assert_ne!(t.album_artist.as_deref(), Some("Anime Hits"));
    }

    let _ = std::fs::remove_dir_all(&dir);
    let _ = std::fs::remove_dir_all(&cache);
}

#[tokio::test]
async fn test_rescan_removes_deleted_files_only_under_scanned_root() {
    let lib_a = temp_dir("stale_a");
    let lib_b = temp_dir("stale_b");
    let cache = temp_dir("stale_cache");
    std::fs::copy(fixture("test_sine_440hz.wav"), lib_a.join("keep.wav")).unwrap();
    std::fs::copy(fixture("test_sine_440hz.opus"), lib_a.join("gone.opus")).unwrap();
    std::fs::copy(fixture("test_sine_440hz.wav"), lib_b.join("other.wav")).unwrap();

    let db = Database::new_in_memory().await.unwrap();
    let scanner = LibraryScanner::new(&cache);
    scanner.scan_directory(&lib_a, &db).await.unwrap();
    scanner.scan_directory(&lib_b, &db).await.unwrap();
    assert_eq!(db.list_tracks().await.unwrap().len(), 3);

    std::fs::remove_file(lib_a.join("gone.opus")).unwrap();
    let summary = scanner.scan_directory(&lib_a, &db).await.unwrap();
    assert_eq!(summary.removed_stale, 1);

    let paths: Vec<String> = db
        .list_tracks()
        .await
        .unwrap()
        .into_iter()
        .map(|t| t.path)
        .collect();
    assert_eq!(paths.len(), 2);
    assert!(paths.iter().any(|p| p.ends_with("keep.wav")));
    assert!(
        paths.iter().any(|p| p.ends_with("other.wav")),
        "The other library folder is untouched"
    );

    // A missing directory (e.g. an unmounted drive) must not wipe the library.
    std::fs::remove_dir_all(&lib_a).unwrap();
    let summary = scanner.scan_directory(&lib_a, &db).await.unwrap();
    assert_eq!(summary.removed_stale, 0);
    assert_eq!(db.list_tracks().await.unwrap().len(), 2);

    let _ = std::fs::remove_dir_all(&lib_b);
    let _ = std::fs::remove_dir_all(&cache);
}

#[tokio::test]
async fn test_scanner_reads_musicbrainz_release_id_without_overwriting_existing() {
    use lofty::config::WriteOptions;
    use lofty::file::{AudioFile, TaggedFileExt};
    use lofty::probe::Probe;
    use lofty::tag::{Accessor, ItemKey, ItemValue, TagItem};

    let dir = temp_dir("mbid");
    let cache = temp_dir("mbid_cache");
    let track1 = dir.join("01.opus");
    let track2 = dir.join("02.opus");

    std::fs::copy(fixture("test_sine_440hz.opus"), &track1).unwrap();
    let mut tagged1 = Probe::open(&track1).unwrap().read().unwrap();
    let tag1 = tagged1.primary_tag_mut().unwrap();
    tag1.set_artist("TENMON".to_string());
    tag1.set_album("ef - a tale of memories.".to_string());
    tag1.set_title("euphoric field".to_string());
    tag1.insert(TagItem::new(
        ItemKey::MusicBrainzReleaseId,
        ItemValue::Text("aaaa1111-2222-3333-4444-555566667777".into()),
    ));
    tagged1
        .save_to_path(&track1, WriteOptions::default())
        .unwrap();

    std::fs::copy(fixture("test_sine_440hz.opus"), &track2).unwrap();
    let mut tagged2 = Probe::open(&track2).unwrap().read().unwrap();
    let tag2 = tagged2.primary_tag_mut().unwrap();
    tag2.set_artist("TENMON".to_string());
    tag2.set_album("ef - a tale of memories.".to_string());
    tag2.set_title("second track".to_string());
    tag2.insert(TagItem::new(
        ItemKey::MusicBrainzReleaseId,
        ItemValue::Text("bbbb1111-2222-3333-4444-555566667777".into()),
    ));
    tagged2
        .save_to_path(&track2, WriteOptions::default())
        .unwrap();

    let db = Database::new_in_memory().await.unwrap();
    LibraryScanner::new(&cache)
        .scan_directory(&dir, &db)
        .await
        .unwrap();

    let albums = db.list_albums().await.unwrap();
    assert_eq!(albums.len(), 1);
    let mbid = albums[0]
        .release_mbid
        .as_deref()
        .expect("scanner should save MusicBrainzReleaseId onto the album");
    assert!(
        mbid == "aaaa1111-2222-3333-4444-555566667777"
            || mbid == "bbbb1111-2222-3333-4444-555566667777"
    );

    // Manually set MBID (e.g. via MusicBrainz release match) must not be overwritten on rescan.
    db.update_album_cover(albums[0].id, "/covers/manual.jpg", Some("manual-mbid-9999"))
        .await
        .unwrap();
    let track3 = dir.join("03.opus");
    std::fs::copy(&track1, &track3).unwrap();
    LibraryScanner::new(&cache)
        .scan_directory(&dir, &db)
        .await
        .unwrap();
    let refreshed = db.get_album_by_id(albums[0].id).await.unwrap().unwrap();
    assert_eq!(refreshed.release_mbid.as_deref(), Some("manual-mbid-9999"));

    let _ = std::fs::remove_dir_all(&dir);
    let _ = std::fs::remove_dir_all(&cache);
}

#[tokio::test]
async fn test_scan_paths_reindexes_individual_file_even_when_size_and_mtime_unchanged() {
    use lofty::config::WriteOptions;
    use lofty::file::{AudioFile, TaggedFileExt};
    use lofty::probe::Probe;
    use lofty::tag::Accessor;

    let dir = temp_dir("rescan_file");
    let cache = temp_dir("rescan_file_cache");
    let file_path = dir.join("song.opus");
    tagged_copy(&file_path, "Old Artist", "Old Album", None);

    let db = Database::new_in_memory().await.unwrap();
    let scanner = LibraryScanner::new(&cache);
    scanner.scan_paths(&[&file_path], &db).await.unwrap();

    // Update the file's tags and restore its original mtime to simulate a same-second edit.
    let before_meta = std::fs::metadata(&file_path).unwrap();
    let mut tagged = Probe::open(&file_path).unwrap().read().unwrap();
    let tag = tagged.primary_tag_mut().unwrap();
    tag.set_artist("TENMON & Eiichiro Yanagi".to_string());
    tag.set_album("ef - a tale of memories.".to_string());
    tag.set_title("Sorrowful feather C2Rmix".to_string());
    tagged
        .save_to_path(&file_path, WriteOptions::default())
        .unwrap();
    let updated_meta = std::fs::metadata(&file_path).unwrap();
    let canonical = file_path.canonicalize().unwrap().display().to_string();
    // Force stored stamp to match post-edit size and mtime so only unconditional file rescan updates it.
    let mut existing = db.get_track_by_path(&canonical).await.unwrap().unwrap();
    existing.file_size = updated_meta.len() as i64;
    existing.modified_time = before_meta
        .modified()
        .unwrap()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    let _ = db.upsert_track(&existing).await.unwrap();

    let summary = scanner.scan_paths(&[&file_path], &db).await.unwrap();
    assert_eq!(summary.new_or_updated_tracks, 1);

    let updated = db.get_track_by_path(&canonical).await.unwrap().unwrap();
    assert_eq!(updated.title, "Sorrowful feather C2Rmix");
    assert_eq!(updated.artist, "TENMON & Eiichiro Yanagi");

    let _ = std::fs::remove_dir_all(&dir);
    let _ = std::fs::remove_dir_all(&cache);
}

#[tokio::test]
async fn test_scanner_detects_case_insensitive_and_root_folder_covers() {
    let collection_root = temp_dir("ef_covers");
    let album_upper_ext = collection_root.join("Alato Disc 1");
    let album_root_fallback = collection_root.join("Adagio Single");
    let disc_nested = collection_root.join("MultiDisc").join("Disc 1");
    let cache = temp_dir("ef_covers_cache");
    std::fs::create_dir_all(&album_upper_ext).unwrap();
    std::fs::create_dir_all(&album_root_fallback).unwrap();
    std::fs::create_dir_all(&disc_nested).unwrap();

    // Root fallback cover + uppercase extension in album folder.
    let root_cover = collection_root.join("cover.png");
    let upper_cover = album_upper_ext.join("cover.JPG");
    std::fs::write(&root_cover, b"png-root-bytes").unwrap();
    std::fs::write(&upper_cover, b"jpg-upper-bytes").unwrap();

    tagged_copy(&album_upper_ext.join("01.opus"), "TENMON", "Alato", None);
    tagged_copy(
        &album_root_fallback.join("01.opus"),
        "Miyako",
        "Adagio",
        None,
    );
    tagged_copy(&disc_nested.join("01.opus"), "ELISA", "MultiDisc", None);

    let db = Database::new_in_memory().await.unwrap();
    let scanner = LibraryScanner::new(&cache);
    let summary = scanner.scan_directory(&collection_root, &db).await.unwrap();
    assert_eq!(summary.new_or_updated_tracks, 3);
    assert_eq!(summary.errors, 0);

    let albums = db.list_albums().await.unwrap();
    let alato = albums.iter().find(|a| a.title == "Alato").unwrap();
    assert_eq!(
        alato.cover_path.as_deref(),
        Some(upper_cover.to_string_lossy().as_ref())
    );
    let adagio = albums.iter().find(|a| a.title == "Adagio").unwrap();
    assert_eq!(
        adagio.cover_path.as_deref(),
        Some(root_cover.to_string_lossy().as_ref())
    );
    let multidisc = albums.iter().find(|a| a.title == "MultiDisc").unwrap();
    assert_eq!(
        multidisc.cover_path.as_deref(),
        Some(root_cover.to_string_lossy().as_ref())
    );

    // Removing empty-track state isn't triggered; every album has its track.
    assert_eq!(albums.len(), 3);

    // Direct lookup helper also resolves parent root for single-file lookups.
    assert_eq!(
        library::find_folder_cover(&album_root_fallback, None),
        Some(root_cover.clone())
    );

    let _ = std::fs::remove_dir_all(&collection_root);
    let _ = std::fs::remove_dir_all(&cache);
}

#[tokio::test]
async fn test_rescan_recovers_missing_album_cover_when_root_cover_added() {
    let root = temp_dir("recover_cover");
    let sub = root.join("AlbumA");
    let cache = temp_dir("recover_cover_cache");
    std::fs::create_dir_all(&sub).unwrap();
    tagged_copy(&sub.join("01.opus"), "Artist A", "Album A", None);

    let db = Database::new_in_memory().await.unwrap();
    let scanner = LibraryScanner::new(&cache);
    scanner.scan_directory(&root, &db).await.unwrap();
    assert_eq!(db.list_albums().await.unwrap()[0].cover_path, None);

    // Drop a cover.png into the root later without modifying the audio file.
    let root_cover = root.join("cover.png");
    std::fs::write(&root_cover, b"later-root-cover").unwrap();
    let summary = scanner.scan_directory(&root, &db).await.unwrap();
    assert_eq!(summary.skipped_unchanged, 1);

    let albums = db.list_albums().await.unwrap();
    assert_eq!(
        albums[0].cover_path.as_deref(),
        Some(root_cover.to_string_lossy().as_ref())
    );

    let _ = std::fs::remove_dir_all(&root);
    let _ = std::fs::remove_dir_all(&cache);
}

#[cfg(unix)]
#[tokio::test]
async fn test_scan_with_symlinked_dir_matches_canonical_paths_and_detects_stale() {
    use std::os::unix::fs::symlink;

    let workspace = temp_dir("symlink_scan");
    let lib_root = workspace.join("library");
    let external_dir = workspace.join("external_album");
    let external_single_dir = workspace.join("external_single");
    let sub_dir = lib_root.join("regular_sub");
    let cache = temp_dir("symlink_scan_cache");
    std::fs::create_dir_all(&sub_dir).unwrap();
    std::fs::create_dir_all(&external_dir).unwrap();
    std::fs::create_dir_all(&external_single_dir).unwrap();

    let regular_track = sub_dir.join("01.opus");
    let linked_target = external_dir.join("02.opus");
    let single_link_target = external_single_dir.join("03_target.opus");
    tagged_copy(&regular_track, "Regular", "Sub Album", None);
    tagged_copy(&linked_target, "LinkedDir", "Linked Album", None);
    tagged_copy(&single_link_target, "LinkedFile", "File Album", None);

    symlink(&external_dir, lib_root.join("linked_album")).unwrap();
    symlink(&single_link_target, lib_root.join("03_link.opus")).unwrap();

    let db = Database::new_in_memory().await.unwrap();
    let scanner = LibraryScanner::new(&cache);
    let summary = scanner.scan_directory(&lib_root, &db).await.unwrap();
    assert_eq!(summary.total_files_found, 3);
    assert_eq!(summary.new_or_updated_tracks, 3);
    assert_eq!(summary.errors, 0);

    let mut stored_paths: Vec<String> = db
        .list_tracks()
        .await
        .unwrap()
        .into_iter()
        .map(|t| t.path)
        .collect();
    stored_paths.sort();

    let mut expected_paths = vec![
        regular_track.canonicalize().unwrap().display().to_string(),
        linked_target.canonicalize().unwrap().display().to_string(),
        single_link_target
            .canonicalize()
            .unwrap()
            .display()
            .to_string(),
    ];
    expected_paths.sort();
    assert_eq!(stored_paths, expected_paths);

    // No-change rescan skips all 3 without stale deletion.
    let rescan = scanner.scan_directory(&lib_root, &db).await.unwrap();
    assert_eq!(rescan.skipped_unchanged, 3);
    assert_eq!(rescan.removed_stale, 0);

    // Removing the regular file deletes only that track on rescan.
    std::fs::remove_file(&regular_track).unwrap();
    let after_del = scanner.scan_directory(&lib_root, &db).await.unwrap();
    assert_eq!(after_del.removed_stale, 1);

    let _ = std::fs::remove_dir_all(&workspace);
    let _ = std::fs::remove_dir_all(&cache);
}

#[tokio::test]
async fn test_scan_mixed_album_folder_preserves_embedded_covers() {
    use lofty::config::WriteOptions;
    use lofty::file::{AudioFile, TaggedFileExt};
    use lofty::picture::{MimeType, Picture, PictureType};
    use lofty::probe::Probe;
    use lofty::tag::Accessor;

    let dir = temp_dir("mixed_covers");
    let cache = temp_dir("mixed_covers_cache");

    let write_with_pic = |name: &str, artist: &str, album: &str, pic_bytes: &[u8]| {
        let p = dir.join(name);
        std::fs::copy(fixture("test_sine_440hz.opus"), &p).unwrap();
        let mut tf = Probe::open(&p).unwrap().read().unwrap();
        let tag = tf.primary_tag_mut().unwrap();
        tag.set_artist(artist.to_string());
        tag.set_album(album.to_string());
        tag.set_title(name.to_string());
        tag.push_picture(
            Picture::unchecked(pic_bytes.to_vec())
                .pic_type(PictureType::CoverFront)
                .mime_type(MimeType::Jpeg)
                .build(),
        );
        tf.save_to_path(&p, WriteOptions::default()).unwrap();
    };

    write_with_pic("01_alpha.opus", "Artist 1", "Alpha", b"fake-jpeg-alpha-111");
    write_with_pic("02_beta.opus", "Artist 2", "Beta", b"fake-jpeg-beta-222");

    let db = Database::new_in_memory().await.unwrap();
    let scanner = LibraryScanner::new(&cache);
    let summary = scanner.scan_directory(&dir, &db).await.unwrap();
    assert_eq!(summary.new_or_updated_tracks, 2);

    let albums = db.list_albums().await.unwrap();
    let alpha = albums.iter().find(|a| a.title == "Alpha").unwrap();
    let beta = albums.iter().find(|a| a.title == "Beta").unwrap();
    assert!(
        alpha.cover_path.is_some(),
        "Alpha must retain its embedded cover"
    );
    assert!(
        beta.cover_path.is_some(),
        "Beta must retain its embedded cover"
    );
    assert_ne!(alpha.cover_path, beta.cover_path);

    let _ = std::fs::remove_dir_all(&dir);
    let _ = std::fs::remove_dir_all(&cache);
}
