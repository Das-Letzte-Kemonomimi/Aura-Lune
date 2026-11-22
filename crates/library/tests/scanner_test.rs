use library::LibraryScanner;
use std::path::PathBuf;
use storage::Database;

#[tokio::test]
async fn test_library_scanner_incremental_and_db_persistence() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let root = manifest_dir.parent().unwrap().parent().unwrap();

    let fixtures_dir = root.join("tests/fixtures");
    assert!(fixtures_dir.exists(), "Katalog fixtures musi istnieć");

    let cache_dir = root.join("tests/fixtures/cache_test");
    let scanner = LibraryScanner::new(&cache_dir);

    // 1. Tworzymy bazę danych w pamięci
    let db = Database::new_in_memory().await.unwrap();

    // 2. Pierwsze skanowanie (powinno zindeksować pliki WAV i Opus)
    let summary1 = scanner.scan_directory(&fixtures_dir, &db).await.unwrap();
    assert!(
        summary1.total_files_found >= 2,
        "Powinno znaleźć co najmniej test.wav i test.opus"
    );
    assert!(
        summary1.new_or_updated_tracks >= 2,
        "Powinno zindeksować co najmniej 2 nowe pliki"
    );
    assert_eq!(
        summary1.skipped_unchanged, 0,
        "Przy pierwszym skanowaniu żaden plik nie powinien być pominięty"
    );

    // Weryfikacja bazy
    let tracks = db.list_tracks().await.unwrap();
    assert!(tracks.len() >= 2);
    let albums = db.list_albums().await.unwrap();
    assert!(!albums.is_empty());
    let artists = db.list_artists().await.unwrap();
    assert!(!artists.is_empty());

    // 3. Drugie skanowanie (TEST PRZYROSTOWY - pliki nie uległy zmianie)
    let summary2 = scanner.scan_directory(&fixtures_dir, &db).await.unwrap();
    assert_eq!(
        summary2.new_or_updated_tracks, 0,
        "Przy ponownym skanowaniu nie powinno być nowych utworów"
    );
    assert!(
        summary2.skipped_unchanged >= 2,
        "Wszystkie niezmienione pliki powinny zostać pominięte w czasie mikrosekund"
    );

    // Sprzątanie katalogu cache testu
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

/// Tworzy unikalny katalog tymczasowy dla testu.
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

/// Kopiuje fixture Opus i nadaje mu tagi (artysta, album, opcjonalnie wykonawca albumu).
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
        "Kompilacja to jeden album, nie jeden na artystę"
    );
    let compilation = albums.iter().find(|a| a.title == "Anime Hits").unwrap();
    assert_eq!(compilation.album_artist, "Various Artists");
    let solo = albums.iter().find(|a| a.title == "Solo Album").unwrap();
    assert_eq!(
        solo.album_artist, "Solo Artist",
        "Bez tagu ALBUMARTIST używany jest artysta"
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
        "Inny folder biblioteki nietknięty"
    );

    // Brakujący katalog (np. odmontowany dysk) nie może wyczyścić biblioteki.
    std::fs::remove_dir_all(&lib_a).unwrap();
    let summary = scanner.scan_directory(&lib_a, &db).await.unwrap();
    assert_eq!(summary.removed_stale, 0);
    assert_eq!(db.list_tracks().await.unwrap().len(), 2);

    let _ = std::fs::remove_dir_all(&lib_b);
    let _ = std::fs::remove_dir_all(&cache);
}
