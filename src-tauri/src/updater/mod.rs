//! App updates: build identity, installation kind, release checks on GitHub
//! ([`check`]) and safe AppImage installation ([`install`]).
//!
//! The channels never mix: the **stable** channel compares the semver version with `releases/latest`,
//! the **dev** channel compares the embedded commit with the commit of the moving `dev-build` release.
//! The pure logic (installation classification, throttling decision, asset choice) is in this
//! module and in [`check`], so it can be tested without the network and without Tauri.

pub mod check;
pub mod install;

use serde::{Deserialize, Serialize};
use std::path::Path;

/// Repository with the releases.
pub const RELEASES_REPO: &str = "Das-Letzte-Kemonomimi/Aura-Lune";
/// GitHub API base for the releases repository.
pub const GITHUB_API_BASE: &str = "https://api.github.com/repos/Das-Letzte-Kemonomimi/Aura-Lune";
/// Tag of the dev channel's moving release.
pub const DEV_RELEASE_TAG: &str = "dev-build";
/// Name of the asset with the SHA-256 checksums (`sha256sum *.AppImage`).
pub const CHECKSUMS_ASSET: &str = "SHA256SUMS";

/// Event: update available (`UpdateInfo`).
pub const UPDATE_AVAILABLE_EVENT: &str = "auralune://update-available";
/// Event: download progress (`{ downloaded, total }`).
pub const UPDATE_PROGRESS_EVENT: &str = "auralune://update-progress";

/// File name of the dev channel AppImage, as in `install.sh`.
pub const DEV_APPIMAGE_NAME: &str = "auralune-dev.AppImage";

/// Settings keys (the `app_settings` table).
pub const SETTING_ENABLED: &str = "update_check_enabled";
pub const SETTING_LAST_CHECKED: &str = "update_last_checked";
pub const SETTING_LAST_RESULT: &str = "update_last_result";

/// Minimum interval between non-forced checks, and the background loop period.
pub const CHECK_INTERVAL_SECS: u64 = 6 * 60 * 60;
/// Delay of the first check after start-up, so it does not slow the launch.
pub const STARTUP_DELAY_SECS: u64 = 30;

/// Version and commit of this build (`build.rs`).
pub const BUILD_VERSION: &str = env!("CARGO_PKG_VERSION");
pub const BUILD_COMMIT: &str = env!("AURALUNE_BUILD_COMMIT");
pub const BUILD_CHANNEL: &str = env!("AURALUNE_BUILD_CHANNEL");

/// Where the app was started from: decides whether it may update itself.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InstallKind {
    /// AppImage from `install.sh` (`~/.local/share/auralune{,-dev}/`), writable.
    AppImageManaged,
    /// AppImage started from another location or without write permission.
    AppImageOther,
    /// System package (AUR, deb): updated by the package manager.
    System,
    /// Dev server / debug build.
    DevServer,
}

/// Data about the running build, returned by `get_build_info`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BuildInfo {
    pub version: String,
    pub commit: String,
    pub commit_short: String,
    pub channel: String,
    pub install_kind: InstallKind,
}

/// Short commit (7 characters) for display.
pub fn short_commit(commit: &str) -> String {
    commit.chars().take(7).collect()
}

/// Classifies the installation. `appimage` is `$APPIMAGE`, `home` is `$HOME`, `writable` says whether
/// the AppImage file can be replaced, and `debug` whether this is a debug build (dev server).
pub fn classify_install(
    appimage: Option<&str>,
    home: Option<&Path>,
    writable: bool,
    debug: bool,
) -> InstallKind {
    let Some(appimage) = appimage.filter(|p| !p.is_empty()) else {
        return if debug {
            InstallKind::DevServer
        } else {
            InstallKind::System
        };
    };
    let managed_dir = home.and_then(|home| {
        let parent = Path::new(appimage).parent()?;
        ["auralune", "auralune-dev"]
            .iter()
            .any(|dir| parent == home.join(".local/share").join(dir))
            .then_some(())
    });
    if managed_dir.is_some() && writable {
        InstallKind::AppImageManaged
    } else {
        InstallKind::AppImageOther
    }
}

/// Whether the app can install an update itself: an AppImage from `install.sh`, and a developer
/// run of the dev channel (the update then goes to the dev installation from `install.sh`).
pub fn can_self_install(kind: InstallKind, channel: &str) -> bool {
    kind == InstallKind::AppImageManaged || (kind == InstallKind::DevServer && channel == "dev")
}

/// The AppImage file the installer replaces: its own `$APPIMAGE` or, for a developer
/// run, `~/.local/share/auralune-dev/auralune-dev.AppImage`.
pub fn install_target(
    kind: InstallKind,
    channel: &str,
    appimage: Option<&str>,
    home: Option<&Path>,
) -> Option<std::path::PathBuf> {
    match kind {
        InstallKind::AppImageManaged => appimage.map(std::path::PathBuf::from),
        InstallKind::DevServer if channel == "dev" => {
            home.map(|h| h.join(".local/share/auralune-dev").join(DEV_APPIMAGE_NAME))
        }
        _ => None,
    }
}

/// Whether the AppImage file is writable (needs write permission on the directory and the file itself).
pub fn appimage_is_writable(appimage: &Path) -> bool {
    let file_ok = std::fs::metadata(appimage)
        .map(|m| !m.permissions().readonly())
        .unwrap_or(false);
    let dir_ok = appimage
        .parent()
        .and_then(|d| std::fs::metadata(d).ok())
        .map(|m| !m.permissions().readonly())
        .unwrap_or(false);
    file_ok && dir_ok
}

/// Effective channel: dev if the installation (launcher/path) or the build itself says so.
pub fn effective_channel(is_dev_install: bool, build_channel: &str) -> &'static str {
    if is_dev_install || build_channel == "dev" {
        "dev"
    } else {
        "stable"
    }
}

/// Information about the current build, from the process environment.
pub fn current_build_info() -> BuildInfo {
    let appimage = std::env::var("APPIMAGE").ok();
    let home = std::env::var_os("HOME").map(std::path::PathBuf::from);
    let writable = appimage
        .as_deref()
        .is_some_and(|p| appimage_is_writable(Path::new(p)));
    let identity = crate::commands::themes::install_identity(
        std::env::var("AURALUNE_CHANNEL").ok().as_deref(),
        appimage.as_deref(),
    );
    BuildInfo {
        version: BUILD_VERSION.to_string(),
        commit: BUILD_COMMIT.to_string(),
        commit_short: short_commit(BUILD_COMMIT),
        channel: effective_channel(identity.is_dev, BUILD_CHANNEL).to_string(),
        install_kind: classify_install(
            appimage.as_deref(),
            home.as_deref(),
            writable,
            cfg!(debug_assertions),
        ),
    }
}

/// Whether a check should run: forced, or at least [`CHECK_INTERVAL_SECS`] have passed.
/// A clock set back before the last check (`now < last`) is treated as expired.
pub fn should_check(now: u64, last_checked: Option<u64>, force: bool) -> bool {
    if force {
        return true;
    }
    match last_checked {
        None => true,
        Some(last) if now < last => true,
        Some(last) => now - last >= CHECK_INTERVAL_SECS,
    }
}

/// Whether a release ID (version or commit) matches the one the user skipped.
pub fn is_skipped(skipped: Option<&str>, latest_version: Option<&str>) -> bool {
    matches!((skipped, latest_version), (Some(s), Some(l)) if !s.is_empty() && s == l)
}

/// Asset to download, with its checksum (when already known from the check).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UpdateAsset {
    pub name: String,
    pub url: String,
    pub size: u64,
    /// SHA-256 from the GitHub API `digest` field (`sha256:…`), when available.
    pub sha256: Option<String>,
    /// URL of the `SHA256SUMS` asset: the fallback checksum source when `digest` is missing.
    pub checksums_url: Option<String>,
}

/// Update check result (the `auralune://update-available` event and the cache in the settings).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub available: bool,
    pub channel: String,
    pub current_version: String,
    pub current_commit: String,
    /// Version (stable) or `dev-<short commit>` (dev); also used as the "skip" key.
    pub latest_version: Option<String>,
    pub latest_commit: Option<String>,
    pub release_url: Option<String>,
    pub release_notes: Option<String>,
    pub asset: Option<UpdateAsset>,
    pub install_kind: InstallKind,
    /// Whether the app can install the update itself (`can_self_install` + an asset exists).
    pub can_install: bool,
    /// Unix time (s) of the check.
    pub checked_at: u64,
}

impl UpdateInfo {
    /// Whether the saved result is for this very build (after an update the cache is stale).
    pub fn matches_build(&self, version: &str, commit: &str) -> bool {
        self.current_version == version && self.current_commit == commit
    }
}
