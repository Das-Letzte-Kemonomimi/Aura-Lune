//! Instalacja pobranej aktualizacji: pobranie z weryfikacją SHA-256 (logika `crates/downloads`),
//! atomowa podmiana pliku AppImage i ponowne uruchomienie przez launcher.

use super::{UpdateAsset, UPDATE_PROGRESS_EVENT};
use crate::commands::error::CommandError;
use downloads::{DownloadProvider, HttpDownloadProvider};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

/// Najrzadziej emitujemy postęp (ms), żeby nie zalewać WebView zdarzeniami.
const PROGRESS_EMIT_INTERVAL_MS: u64 = 200;

/// Dozwolone są tylko adresy https należące do GitHuba (strona wydań i CDN z assetami).
pub fn validate_asset_url(url: &str) -> Result<(), CommandError> {
    let parsed = url::Url::parse(url)
        .map_err(|_| CommandError::validation("Nieprawidłowy adres pliku aktualizacji"))?;
    let host = parsed.host_str().unwrap_or("");
    let allowed = ["github.com", "githubusercontent.com"]
        .iter()
        .any(|d| host == *d || host.ends_with(&format!(".{d}")));
    if parsed.scheme() != "https" || !allowed {
        return Err(CommandError::validation(
            "Adres pliku aktualizacji musi wskazywać na GitHub przez https",
        ));
    }
    Ok(())
}

/// Ścieżka pliku roboczego obok docelowego AppImage (ten sam system plików → atomowy `rename`).
pub fn staging_path(target: &Path) -> PathBuf {
    let name = target
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("auralune.AppImage");
    target.with_file_name(format!("{name}.update"))
}

/// Czy plik zaczyna się od sygnatury ELF (AppImage typu 2 jest plikiem ELF).
pub fn looks_like_appimage(path: &Path) -> bool {
    use std::io::Read;
    let mut magic = [0u8; 4];
    std::fs::File::open(path)
        .and_then(|mut f| f.read_exact(&mut magic))
        .is_ok()
        && magic == *b"\x7fELF"
}

/// Pobiera `asset` z weryfikacją sumy i podmienia `target`. Plik roboczy jest usuwany przy
/// każdym błędzie; działający proces nadal używa starego pliku (podmiana to `rename`).
pub async fn download_and_replace(
    app: &AppHandle,
    asset: &UpdateAsset,
    expected_sha256: &str,
    target: &Path,
) -> Result<(), CommandError> {
    validate_asset_url(&asset.url)?;
    let staging = staging_path(target);
    let _ = tokio::fs::remove_file(&staging).await;

    let started = std::time::Instant::now();
    let last_emit = Arc::new(AtomicU64::new(0));
    let progress_app = app.clone();
    let progress = Box::new(move |downloaded: u64, total: Option<u64>| {
        let elapsed = started.elapsed().as_millis() as u64;
        let finished = total.is_some_and(|t| downloaded >= t);
        let previous = last_emit.load(Ordering::Relaxed);
        if !finished && elapsed.saturating_sub(previous) < PROGRESS_EMIT_INTERVAL_MS {
            return;
        }
        last_emit.store(elapsed, Ordering::Relaxed);
        let _ = progress_app.emit(
            UPDATE_PROGRESS_EVENT,
            serde_json::json!({ "downloaded": downloaded, "total": total }),
        );
    });

    HttpDownloadProvider::new()
        .download(
            &asset.url,
            &staging,
            Some(expected_sha256),
            Arc::new(AtomicBool::new(false)),
            Some(progress),
        )
        .await?;

    let result = finalize(&staging, target).await;
    if result.is_err() {
        let _ = tokio::fs::remove_file(&staging).await;
    }
    result
}

async fn finalize(staging: &Path, target: &Path) -> Result<(), CommandError> {
    let check_path = staging.to_path_buf();
    let valid = tokio::task::spawn_blocking(move || looks_like_appimage(&check_path)).await?;
    if !valid {
        return Err(CommandError::validation(
            "Pobrany plik nie jest prawidłowym AppImage",
        ));
    }
    use std::os::unix::fs::PermissionsExt;
    tokio::fs::set_permissions(staging, std::fs::Permissions::from_mode(0o755)).await?;
    tokio::fs::rename(staging, target)
        .await
        .map_err(|e| CommandError::from(e).context("Nie udało się podmienić pliku AppImage"))
}

/// Czym uruchomić nową wersję: launcher `~/.local/bin/auralune{,-dev}` (ustawia kanał i
/// obsługuje brak FUSE), a w ostateczności sam AppImage.
pub fn restart_target(
    home: Option<&Path>,
    is_dev: bool,
    appimage: Option<&str>,
) -> Option<PathBuf> {
    let launcher = home
        .map(|h| {
            h.join(".local/bin")
                .join(if is_dev { "auralune-dev" } else { "auralune" })
        })
        .filter(|p| p.is_file());
    launcher.or_else(|| appimage.filter(|p| !p.is_empty()).map(PathBuf::from))
}

/// Uruchamia w tle (osobna grupa procesów) nową instancję po krótkim opóźnieniu — dopiero po
/// zamknięciu bieżącej zwalnia się blokada `single-instance`, inaczej nowy proces trafiłby do
/// jeszcze działającego starego i od razu się zakończył.
pub fn spawn_detached_restart(target: &Path, is_dev: bool) -> Result<(), CommandError> {
    use std::os::unix::process::CommandExt;
    let mut cmd = std::process::Command::new("sh");
    cmd.arg("-c")
        .arg("sleep 2; exec \"$0\"")
        .arg(target)
        .env("AURALUNE_CHANNEL", if is_dev { "dev" } else { "stable" })
        // Zmienne środowiska bieżącego AppImage nie mogą trafić do nowego.
        .env_remove("APPDIR")
        .env_remove("APPIMAGE")
        .env_remove("ARGV0")
        .env_remove("OWD")
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .process_group(0);
    cmd.spawn()
        .map(|_| ())
        .map_err(|e| CommandError::from(e).context("Nie udało się uruchomić nowej wersji"))
}
