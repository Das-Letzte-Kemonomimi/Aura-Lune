use audio_engine::{read_track_metadata, write_track_metadata, TrackMetadataFullDto};
use std::fs;
use std::path::PathBuf;

#[test]
fn test_metadata_editor_roundtrip_and_edge_cases() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let root = manifest_dir.parent().unwrap().parent().unwrap();
    let src_opus = root.join("tests/fixtures/test_sine_440hz.opus");

    assert!(src_opus.exists(), "Source opus fixture must exist");

    // Copy to temporary location so we never modify the fixture
    let temp_dir = std::env::temp_dir().join("auralune_metadata_test");
    let _ = fs::create_dir_all(&temp_dir);
    let temp_opus = temp_dir.join("test_metadata_roundtrip.opus");
    fs::copy(&src_opus, &temp_opus).expect("copy fixture to temp");

    let temp_path_str = temp_opus.to_str().unwrap();

    // 1. Initial read
    let _initial_meta = read_track_metadata(temp_path_str).expect("read initial metadata");

    // 2. Write full metadata with Polish accents and all optional fields
    let new_meta = TrackMetadataFullDto {
        title: "Księżycowy Nokturn".to_string(),
        artist: "Stanisław Moniuszko".to_string(),
        album: Some("Pieśni i Tańce".to_string()),
        album_artist: Some("Stanisław Moniuszko".to_string()),
        year: Some(2026),
        genre: Some("Classical".to_string()),
        track_no: Some(7),
        track_total: Some(12),
        disc_no: Some(1),
        disc_total: Some(2),
        comment: Some("Mastered with Auralune Engine".to_string()),
    };

    write_track_metadata(temp_path_str, &new_meta).expect("write metadata to opus");

    // 3. Read back and verify exact round-trip match
    let read_back = read_track_metadata(temp_path_str).expect("read back written metadata");
    assert_eq!(read_back.title, "Księżycowy Nokturn");
    assert_eq!(read_back.artist, "Stanisław Moniuszko");
    assert_eq!(read_back.album.as_deref(), Some("Pieśni i Tańce"));
    assert_eq!(read_back.year, Some(2026));
    assert_eq!(read_back.genre.as_deref(), Some("Classical"));
    assert_eq!(read_back.track_no, Some(7));
    assert_eq!(
        read_back.comment.as_deref(),
        Some("Mastered with Auralune Engine")
    );

    // 4. Test error handling for non-existent file
    let err_nonexistent = read_track_metadata("/invalid/path/does_not_exist.flac");
    assert!(
        err_nonexistent.is_err(),
        "Should return error for missing file"
    );

    // 5. Test error handling for 0-byte corrupt file
    let corrupt_file = temp_dir.join("corrupt_zero_bytes.mp3");
    fs::write(&corrupt_file, b"").expect("write zero byte file");
    let err_corrupt = read_track_metadata(corrupt_file.to_str().unwrap());
    assert!(err_corrupt.is_err(), "Should return error for 0-byte file");

    // Clean up
    let _ = fs::remove_dir_all(&temp_dir);
}
