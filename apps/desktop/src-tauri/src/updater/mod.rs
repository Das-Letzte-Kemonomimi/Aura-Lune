//! Aktualizacje aplikacji: tożsamość budowy, rodzaj instalacji, sprawdzanie wydań na GitHubie
//! ([`check`]) i bezpieczna instalacja AppImage ([`install`]).
//!
//! Kanały nigdy się nie mieszają: kanał **stable** porównuje wersję semver z `releases/latest`,
//! kanał **dev** porównuje wbudowany commit z commitem ruchomego wydania `dev-build`.
//! Czysta logika (klasyfikacja instalacji, decyzja o throttlingu, wybór assetu) jest w tym
//! module i w [`check`], żeby można ją było testować bez sieci i bez Tauri.

pub mod check;
pub mod install;

use serde::{Deserialize, Serialize};
use std::path::Path;

/// Repozytorium z wydaniami.
pub const RELEASES_REPO: &str = "Das-Letzte-Kemonomimi/Aura-Lune";
/// Podstawa API GitHuba dla repozytorium z wydaniami.
pub const GITHUB_API_BASE: &str = "https://api.github.com/repos/Das-Letzte-Kemonomimi/Aura-Lune";
/// Tag ruchomego wydania kanału dev.
pub const DEV_RELEASE_TAG: &str = "dev-build";
/// Nazwa assetu z sumami SHA-256 (`sha256sum *.AppImage`).
pub const CHECKSUMS_ASSET: &str = "SHA256SUMS";

/// Zdarzenie: dostępna aktualizacja (`UpdateInfo`).
pub const UPDATE_AVAILABLE_EVENT: &str = "auralune://update-available";
/// Zdarzenie: postęp pobierania (`{ downloaded, total }`).
pub const UPDATE_PROGRESS_EVENT: &str = "auralune://update-progress";

/// Klucze ustawień (tabela `app_settings`).
pub const SETTING_ENABLED: &str = "update_check_enabled";
pub const SETTING_LAST_CHECKED: &str = "update_last_checked";
pub const SETTING_LAST_RESULT: &str = "update_last_result";

/// Minimalny odstęp między sprawdzeniami bez wymuszenia i okres pętli w tle.
pub const CHECK_INTERVAL_SECS: u64 = 6 * 60 * 60;
/// Opóźnienie pierwszego sprawdzenia po starcie, aby nie spowalniać uruchamiania.
pub const STARTUP_DELAY_SECS: u64 = 30;

/// Wersja i commit tej budowy (`build.rs`).
pub const BUILD_VERSION: &str = env!("CARGO_PKG_VERSION");
pub const BUILD_COMMIT: &str = env!("AURALUNE_BUILD_COMMIT");
pub const BUILD_CHANNEL: &str = env!("AURALUNE_BUILD_CHANNEL");

/// Skąd uruchomiono aplikację — decyduje, czy wolno ją aktualizować samodzielnie.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InstallKind {
    /// AppImage z `install.sh` (`~/.local/share/auralune{,-dev}/`), zapisywalny.
    AppImageManaged,
    /// AppImage uruchomiony z innego miejsca albo bez prawa zapisu.
    AppImageOther,
    /// Pakiet systemowy (AUR, deb) — aktualizuje go menedżer pakietów.
    System,
    /// Serwer deweloperski / build debug.
    DevServer,
}

/// Dane o uruchomionej budowie zwracane przez `get_build_info`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BuildInfo {
    pub version: String,
    pub commit: String,
    pub commit_short: String,
    pub channel: String,
    pub install_kind: InstallKind,
}

/// Skrócony commit (7 znaków) do wyświetlania.
pub fn short_commit(commit: &str) -> String {
    commit.chars().take(7).collect()
}

/// Klasyfikuje instalację. `appimage` to `$APPIMAGE`, `home` to `$HOME`, `writable` mówi, czy
/// plik AppImage można podmienić, a `debug` czy to build debug (serwer deweloperski).
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

/// Czy do pliku AppImage można zapisać (potrzebne prawo zapisu do katalogu i do samego pliku).
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

/// Efektywny kanał: dev, jeśli wskazuje na to instalacja (launcher/ścieżka) albo sama budowa.
pub fn effective_channel(is_dev_install: bool, build_channel: &str) -> &'static str {
    if is_dev_install || build_channel == "dev" {
        "dev"
    } else {
        "stable"
    }
}

/// Informacje o bieżącej budowie na podstawie środowiska procesu.
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

/// Czy sprawdzenie ma się odbyć: wymuszone albo minęło co najmniej [`CHECK_INTERVAL_SECS`].
/// Zegar cofnięty przed ostatnie sprawdzenie (`now < last`) traktujemy jak przeterminowane.
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

/// Czy ID wydania (wersja albo commit) pasuje do pominiętego przez użytkownika.
pub fn is_skipped(skipped: Option<&str>, latest_version: Option<&str>) -> bool {
    matches!((skipped, latest_version), (Some(s), Some(l)) if !s.is_empty() && s == l)
}

/// Asset do pobrania wraz z sumą kontrolną (jeśli znana już ze sprawdzenia).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UpdateAsset {
    pub name: String,
    pub url: String,
    pub size: u64,
    /// SHA-256 z pola `digest` API GitHuba (`sha256:…`), gdy jest dostępne.
    pub sha256: Option<String>,
    /// URL assetu `SHA256SUMS` — zapasowe źródło sumy, gdy `digest` brakuje.
    pub checksums_url: Option<String>,
}

/// Wynik sprawdzenia aktualizacji (zdarzenie `auralune://update-available` i cache w ustawieniach).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub available: bool,
    pub channel: String,
    pub current_version: String,
    pub current_commit: String,
    /// Wersja (stable) albo `dev-<krótki commit>` (dev); służy też jako klucz „pomiń”.
    pub latest_version: Option<String>,
    pub latest_commit: Option<String>,
    pub release_url: Option<String>,
    pub release_notes: Option<String>,
    pub asset: Option<UpdateAsset>,
    pub install_kind: InstallKind,
    /// Czy aplikacja może zainstalować aktualizację sama (`AppImageManaged` + jest asset).
    pub can_install: bool,
    /// Unix (s) czasu sprawdzenia.
    pub checked_at: u64,
}

impl UpdateInfo {
    /// Czy zapisany wynik dotyczy właśnie tej budowy (po aktualizacji cache jest nieaktualny).
    pub fn matches_build(&self, version: &str, commit: &str) -> bool {
        self.current_version == version && self.current_commit == commit
    }
}
