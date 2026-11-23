use downloads::{
    validate_safe_destination_path, DownloadManager, DownloadProvider, HttpDownloadProvider,
};
use std::fs;
use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

#[test]
fn test_path_traversal_detection() {
    let unsafe_path = Path::new("/home/mimi/Music/../../etc/passwd");
    assert!(validate_safe_destination_path(unsafe_path).is_err());

    let system_path = Path::new("/etc/auralune/music.flac");
    assert!(validate_safe_destination_path(system_path).is_err());

    let safe_path = Path::new("/home/mimi/Music/Downloads/anime_track.flac");
    assert!(validate_safe_destination_path(safe_path).is_ok());
}

#[test]
fn test_download_job_creation() {
    let mgr = DownloadManager::new();
    assert_eq!(mgr.list_jobs().len(), 0);
}

/// Minimalny serwer HTTP na 127.0.0.1 odpowiadający jednym ustalonym komunikatem.
fn serve_once(status: &'static str, body: &'static [u8]) -> String {
    use std::io::{Read, Write};
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    std::thread::spawn(move || {
        if let Ok((mut stream, _)) = listener.accept() {
            let mut buf = [0u8; 2048];
            let _ = stream.read(&mut buf);
            let head = format!(
                "HTTP/1.1 {status}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                body.len()
            );
            let _ = stream.write_all(head.as_bytes());
            let _ = stream.write_all(body);
        }
    });
    format!("http://{addr}/model.bin")
}

fn temp_dir(name: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("auralune_dl_{}_{}", name, std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

/// Pliki tymczasowe `.auralune_tmp_*` pozostawione w katalogu.
fn leftovers(dir: &Path) -> Vec<String> {
    fs::read_dir(dir)
        .unwrap()
        .filter_map(|e| e.ok())
        .map(|e| e.file_name().to_string_lossy().to_string())
        .filter(|n| n.starts_with(".auralune_tmp_"))
        .collect()
}

const BODY: &[u8] = b"auralune model bytes";
// sha256("auralune model bytes")
fn body_sha() -> String {
    use sha2::{Digest, Sha256};
    hex::encode(Sha256::digest(BODY))
}

#[tokio::test]
async fn test_download_with_matching_checksum_is_saved_atomically() {
    let dir = temp_dir("ok");
    let dest = dir.join("model.bin");
    let url = serve_once("200 OK", BODY);
    let res = HttpDownloadProvider::new()
        .download(
            &url,
            &dest,
            Some(&body_sha()),
            Arc::new(AtomicBool::new(false)),
            None,
        )
        .await;
    assert!(res.is_ok(), "{res:?}");
    assert_eq!(fs::read(&dest).unwrap(), BODY);
    assert!(leftovers(&dir).is_empty());
    let _ = fs::remove_dir_all(dir);
}

#[tokio::test]
async fn test_checksum_mismatch_removes_temp_file_and_keeps_no_destination() {
    let dir = temp_dir("sha");
    let dest = dir.join("model.bin");
    let url = serve_once("200 OK", BODY);
    let res = HttpDownloadProvider::new()
        .download(
            &url,
            &dest,
            Some(&"0".repeat(64)),
            Arc::new(AtomicBool::new(false)),
            None,
        )
        .await;
    assert!(
        matches!(res, Err(downloads::DownloadError::ChecksumMismatch { .. })),
        "{res:?}"
    );
    assert!(!dest.exists());
    assert!(
        leftovers(&dir).is_empty(),
        "plik tymczasowy musi zostać usunięty"
    );
    let _ = fs::remove_dir_all(dir);
}

#[tokio::test]
async fn test_http_error_and_cancellation_leave_no_files() {
    let dir = temp_dir("err");
    let dest = dir.join("model.bin");

    let url = serve_once("404 Not Found", b"missing");
    let res = HttpDownloadProvider::new()
        .download(&url, &dest, None, Arc::new(AtomicBool::new(false)), None)
        .await;
    assert!(res.is_err());

    let url = serve_once("200 OK", BODY);
    let res = HttpDownloadProvider::new()
        .download(&url, &dest, None, Arc::new(AtomicBool::new(true)), None)
        .await;
    assert!(
        matches!(res, Err(downloads::DownloadError::Cancelled)),
        "{res:?}"
    );

    assert!(!dest.exists());
    assert!(leftovers(&dir).is_empty());
    let _ = fs::remove_dir_all(dir);
}

#[test]
fn test_destination_policy_rejects_hidden_home_entries() {
    if let Some(home) = std::env::var_os("HOME") {
        let home = std::path::PathBuf::from(home);
        assert!(validate_safe_destination_path(&home.join(".bashrc")).is_err());
        assert!(validate_safe_destination_path(&home.join(".config/autostart/x.desktop")).is_err());
        assert!(validate_safe_destination_path(&home.join("Music/x.flac")).is_ok());
    }
}

#[test]
fn test_destination_policy_allows_ai_model_dirs_under_xdg_data() {
    // Regresja: modele AI trafiają do `~/.local/share/auralune/models`, co było
    // odrzucane jako „ukryty katalog” w $HOME.
    if let Some(home) = std::env::var_os("HOME") {
        let home = std::path::PathBuf::from(home);
        if std::env::var_os("XDG_DATA_HOME").is_none() {
            assert!(validate_safe_destination_path(
                &home.join(".local/share/auralune/models/htdemucs_v4.onnx")
            )
            .is_ok());
        }
        if std::env::var_os("XDG_CACHE_HOME").is_none() {
            assert!(
                validate_safe_destination_path(&home.join(".cache/auralune/stems/x.wav")).is_ok()
            );
        }
        assert!(
            validate_safe_destination_path(&home.join(".local/share/applications/x.desktop"))
                .is_err()
        );
    }
}
