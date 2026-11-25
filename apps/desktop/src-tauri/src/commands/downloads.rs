use super::error::CommandError;
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
) -> Result<String, CommandError> {
    let destination_path = super::paths::ensure_writable(std::path::Path::new(&destination_path))?
        .to_string_lossy()
        .into_owned();
    info!(
        "Tauri command: add_download_job(url: '{}', dest: '{}')",
        remote_url, destination_path
    );
    state
        .downloads
        .add_download_job(remote_url, destination_path, expected_sha256)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn cancel_download_job(
    job_id: String,
    state: State<'_, AppState>,
) -> Result<bool, CommandError> {
    info!("Tauri command: cancel_download_job('{}')", job_id);
    Ok(state.downloads.cancel_download(&job_id))
}

#[tauri::command]
pub fn list_download_jobs(state: State<'_, AppState>) -> Result<Vec<DownloadJob>, CommandError> {
    Ok(state.downloads.list_jobs())
}
