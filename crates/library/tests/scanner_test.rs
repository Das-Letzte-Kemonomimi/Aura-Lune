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
