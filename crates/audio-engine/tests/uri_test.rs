use audio_engine::uri::{local_path, media_uri, media_uri_checked};
use std::path::PathBuf;

fn temp_file(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("auralune_uri_{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join(name);
    std::fs::write(&path, b"x").unwrap();
    path
}

#[test]
fn test_media_uri_percent_encodes_spaces_and_unicode() {
    let path = temp_file("Skrzydła Białe 100%.wav");
    let uri = media_uri(path.to_str().unwrap());
    assert!(uri.starts_with("file:///"));
    assert!(!uri.contains(' '), "Spaces must be encoded: {uri}");
    assert!(uri.contains("%20"));
    assert!(
        uri.contains("%25"),
        "The % character must be encoded: {uri}"
    );
    assert!(
        uri.is_ascii(),
        "Non-ASCII characters must be encoded: {uri}"
    );
    assert_eq!(local_path(&uri), path.canonicalize().unwrap());
}

#[test]
fn test_media_uri_does_not_double_encode() {
    let path = temp_file("a b.wav");
    let once = media_uri(path.to_str().unwrap());
    let twice = media_uri(&once);
    assert_eq!(once, twice);
    assert!(!twice.contains("%2520"));
}

#[test]
fn test_media_uri_passes_network_streams_through() {
    let url = "https://radio.example/stream?x=1 2";
    assert_eq!(media_uri(url), url);
    assert_eq!(media_uri_checked(url).unwrap(), url);
}

#[test]
fn test_media_uri_checked_rejects_missing_plain_path() {
    assert!(media_uri_checked("/definitely/not/here.flac").is_err());
}

#[test]
fn test_local_path_decodes_file_uri() {
    assert_eq!(
        local_path("file:///music/%E3%81%82%20b.flac"),
        PathBuf::from("/music/あ b.flac")
    );
    assert_eq!(
        local_path("/plain/path.flac"),
        PathBuf::from("/plain/path.flac")
    );
}
