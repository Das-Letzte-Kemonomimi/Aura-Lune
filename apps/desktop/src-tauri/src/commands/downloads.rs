use crate::AppState;
use downloads::DownloadJob;
use tauri::State;
use tracing::info;

#[tauri::command]
pub async fn add_download_job(
    remote_url: String,
    destination_path: String,
    expected_sha256: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    info!(
        "Tauri command: add_download_job(url: '{}', dest: '{}')",
        remote_url, destination_path
    );
    state
        .downloads
        .add_download_job(remote_url, destination_path, expected_sha256)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn cancel_download_job(job_id: String, state: State<'_, AppState>) -> Result<bool, String> {
    info!("Tauri command: cancel_download_job('{}')", job_id);
    Ok(state.downloads.cancel_download(&job_id))
}

#[tauri::command]
pub fn list_download_jobs(state: State<'_, AppState>) -> Result<Vec<DownloadJob>, String> {
    Ok(state.downloads.list_jobs())
}
