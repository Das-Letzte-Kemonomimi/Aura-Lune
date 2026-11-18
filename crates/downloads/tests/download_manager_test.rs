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

#[tokio::test]
async fn test_http_download_huggingface_model_and_sha256() {
    let temp_dir = std::env::temp_dir();
    let dest = temp_dir.join(format!("test_nmp_{}.onnx", std::process::id()));
    let cancel_flag = Arc::new(AtomicBool::new(false));
    let provider = HttpDownloadProvider::new();

    let res = provider
        .download(
            "https://huggingface.co/daserge/basic-pitch-onnx/resolve/main/nmp.onnx",
            &dest,
            Some("2c3c1d144bfa61ad236e92e169c13535c880469a12a047d4e73451f2c059a0ec"),
            cancel_flag,
            None,
        )
        .await;

    assert!(res.is_ok(), "Download failed: {:?}", res);
    let downloaded = res.unwrap();
    assert!(downloaded.exists());
    assert_eq!(std::fs::metadata(&downloaded).unwrap().len(), 230444);
    let _ = fs::remove_file(downloaded);
}
