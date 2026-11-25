//! Aktualizacje aplikacji: informacje o budowie, sprawdzanie wydań, instalacja AppImage i restart.
//!
//! Zapytania do GitHuba idą wyłącznie z Rusta (CSP WebView blokuje je we frontendzie). Kanały są
//! rozdzielone: dev porównuje commit z wydaniem `dev-build`, stable — wersję z `releases/latest`.

use crate::commands::error::CommandError;
use crate::updater::check::{self, CheckContext};
use crate::updater::{
    self, install, BuildInfo, UpdateInfo, GITHUB_API_BASE, SETTING_LAST_CHECKED,
    SETTING_LAST_RESULT,
};
use crate::AppState;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use storage::Database;
use tauri::{AppHandle, State};

/// Limit czasu pojedynczego zapytania do API GitHuba.
const API_TIMEOUT: Duration = Duration::from_secs(20);
/// Limit czasu pobierania `SHA256SUMS`.
const CHECKSUMS_TIMEOUT: Duration = Duration::from_secs(30);

static INSTALLING: AtomicBool = AtomicBool::new(false);

/// Zwalnia flagę trwającej instalacji także przy błędzie lub panice.
struct InstallGuard;

impl InstallGuard {
    fn acquire() -> Result<Self, CommandError> {
        INSTALLING
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .map(|_| Self)
            .map_err(|_| CommandError::validation("Aktualizacja jest już w trakcie instalacji"))
    }
}

impl Drop for InstallGuard {
    fn drop(&mut self) {
        INSTALLING.store(false, Ordering::SeqCst);
    }
}

fn unix_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn prefer_bazzite() -> bool {
    std::fs::read_to_string("/etc/os-release")
        .map(|s| check::is_bazzite_like(&s))
        .unwrap_or(false)
}

fn current_install_target(build: &BuildInfo) -> Option<std::path::PathBuf> {
    let home = std::env::var_os("HOME").map(std::path::PathBuf::from);
    updater::install_target(
        build.install_kind,
        &build.channel,
        std::env::var("APPIMAGE").ok().as_deref(),
        home.as_deref(),
    )
}

/// Wersja, commit, kanał i rodzaj instalacji uruchomionej aplikacji.
#[tauri::command]
pub fn get_build_info() -> BuildInfo {
    updater::current_build_info()
}

async fn cached_info(db: &Database, build: &BuildInfo) -> Option<UpdateInfo> {
    let raw = db.get_app_setting(SETTING_LAST_RESULT).await.ok()??;
    let info: UpdateInfo = serde_json::from_str(&raw).ok()?;
    // Po aktualizacji albo zmianie rodzaju instalacji zapisany wynik nie dotyczy tej budowy.
    (info.matches_build(&build.version, &build.commit) && info.install_kind == build.install_kind)
        .then_some(info)
}

/// Sprawdza aktualizację. Bez `force` wynik z ostatnich 6 h pochodzi z cache (bez sieci).
pub async fn perform_check(db: &Database, force: bool) -> Result<UpdateInfo, CommandError> {
    let build = updater::current_build_info();
    let now = unix_now();
    let last_checked = db
        .get_app_setting(SETTING_LAST_CHECKED)
        .await?
        .and_then(|v| v.parse::<u64>().ok());
    if !updater::should_check(now, last_checked, force) {
        if let Some(info) = cached_info(db, &build).await {
            return Ok(info);
        }
    }

    let client = metadata::http::build_client(API_TIMEOUT);
    let ctx = CheckContext {
        api_base: GITHUB_API_BASE,
        channel: &build.channel,
        version: &build.version,
        commit: &build.commit,
        install_kind: build.install_kind,
        prefer_bazzite: prefer_bazzite(),
        now,
    };
    let info = check::check_release(&client, &ctx).await?;
    db.set_app_setting(SETTING_LAST_CHECKED, &now.to_string())
        .await?;
    db.set_app_setting(SETTING_LAST_RESULT, &serde_json::to_string(&info)?)
        .await?;
    Ok(info)
}

/// Ostatni zapisany wynik sprawdzenia (bez sieci) — do pokazania odznaki tuż po starcie.
#[tauri::command]
pub async fn get_cached_update_info(
    state: State<'_, AppState>,
) -> Result<Option<UpdateInfo>, CommandError> {
    Ok(cached_info(&state.db, &updater::current_build_info()).await)
}

#[tauri::command]
pub async fn check_for_update(
    force: bool,
    state: State<'_, AppState>,
) -> Result<UpdateInfo, CommandError> {
    perform_check(&state.db, force).await
}

/// Pobiera, weryfikuje (SHA-256) i podmienia AppImage. Dozwolone tylko dla instalacji z `install.sh`.
#[tauri::command]
pub async fn install_update(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    let build = updater::current_build_info();
    if !updater::can_self_install(build.install_kind, &build.channel) {
        return Err(CommandError::validation(
            "Automatyczna aktualizacja działa tylko dla AppImage zainstalowanego przez install.sh \
             oraz dla uruchomienia deweloperskiego kanału dev",
        ));
    }
    let target = current_install_target(&build).ok_or_else(|| {
        CommandError::validation("Nie ustalono pliku AppImage do podmiany (APPIMAGE / HOME)")
    })?;
    let _guard = InstallGuard::acquire()?;

    // Wymuszone sprawdzenie: ruchome wydanie dev mogło się zmienić od ostatniego razu.
    let info = perform_check(&state.db, true).await?;
    let asset = info
        .asset
        .as_ref()
        .filter(|_| info.available)
        .ok_or_else(|| CommandError::validation("Brak dostępnej aktualizacji do zainstalowania"))?;
    let client = metadata::http::build_client(CHECKSUMS_TIMEOUT);
    let sha256 = check::resolve_sha256(&client, asset).await?;
    install::download_and_replace(&app, asset, &sha256, &target).await
}

/// Zamyka aplikację zwykłą ścieżką (zapis kolejki i głośności w `RunEvent::Exit`) i uruchamia
/// nową wersję przez launcher.
#[tauri::command]
pub async fn restart_after_update(app: AppHandle) -> Result<(), CommandError> {
    let build = updater::current_build_info();
    let is_dev = build.channel == "dev";
    let home = std::env::var_os("HOME").map(std::path::PathBuf::from);
    let appimage = current_install_target(&build).map(|p| p.to_string_lossy().into_owned());
    let target = install::restart_target(home.as_deref(), is_dev, appimage.as_deref())
        .ok_or_else(|| CommandError::validation("Nie znaleziono launchera ani pliku AppImage"))?;
    install::spawn_detached_restart(&target, is_dev)?;
    app.exit(0);
    Ok(())
}
