//! Sprawdzanie wydań na GitHubie. Zapytania idą przez `metadata::http` (wspólny User-Agent,
//! ponawianie, ochrona przed przekierowaniem na adresy lokalne); wnioskowanie z odpowiedzi
//! jest w czystych funkcjach poniżej.

use super::{short_commit, InstallKind, UpdateAsset, UpdateInfo, CHECKSUMS_ASSET, DEV_RELEASE_TAG};
use crate::commands::error::{CommandError, ErrorCode};
use metadata::http::send_with_retry;
use serde::de::DeserializeOwned;
use serde::Deserialize;

/// Maksymalna długość notatek wydania przekazywanych do interfejsu.
const MAX_NOTES_CHARS: usize = 4000;
/// Maksymalny rozmiar pliku `SHA256SUMS`.
const MAX_CHECKSUMS_BYTES: u64 = 256 * 1024;

#[derive(Debug, Clone, Deserialize)]
pub struct GhAsset {
    pub name: String,
    pub browser_download_url: String,
    #[serde(default)]
    pub size: u64,
    /// `sha256:<hex>` — GitHub dodaje to pole do assetów wgranych po 2025 r.
    #[serde(default)]
    pub digest: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct GhRelease {
    pub tag_name: String,
    #[serde(default)]
    pub html_url: String,
    #[serde(default)]
    pub target_commitish: String,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub assets: Vec<GhAsset>,
}

#[derive(Debug, Deserialize)]
struct GhCommit {
    sha: String,
}

/// Parametry sprawdzenia (bieżąca budowa + środowisko).
#[derive(Debug, Clone)]
pub struct CheckContext<'a> {
    pub api_base: &'a str,
    pub channel: &'a str,
    pub version: &'a str,
    pub commit: &'a str,
    pub install_kind: InstallKind,
    pub prefer_bazzite: bool,
    pub now: u64,
}

fn network_error(message: impl Into<String>) -> CommandError {
    CommandError::new(ErrorCode::Network, message)
}

/// Czy zawartość `/etc/os-release` to Bazzite/Fedora (ta sama reguła co w `install.sh`).
pub fn is_bazzite_like(os_release: &str) -> bool {
    os_release.lines().any(|line| {
        let line = line.trim().to_ascii_lowercase();
        let id_match = matches!(line.as_str(), "id=bazzite" | "id=fedora");
        let like_match =
            line.starts_with("id_like=") && (line.contains("fedora") || line.contains("bazzite"));
        id_match || like_match
    })
}

/// Wybiera AppImage: na Bazzite/Fedorze wariant `bazzite`, w pozostałych przypadkach (i gdy
/// wariantu brak) pierwszy asset `.AppImage` bez „bazzite” w nazwie.
pub fn select_asset(assets: &[GhAsset], prefer_bazzite: bool) -> Option<&GhAsset> {
    let appimages = || {
        assets
            .iter()
            .filter(|a| a.name.to_ascii_lowercase().ends_with(".appimage"))
    };
    let is_bazzite = |a: &&GhAsset| a.name.to_ascii_lowercase().contains("bazzite");
    if prefer_bazzite {
        if let Some(asset) = appimages().find(is_bazzite) {
            return Some(asset);
        }
    }
    appimages().find(|a| !is_bazzite(a))
}

/// Wyciąga SHA-256 z pola `digest` API (`sha256:<64 znaki hex>`).
pub fn digest_sha256(digest: &str) -> Option<String> {
    let hex = digest.trim().strip_prefix("sha256:")?;
    is_sha256_hex(hex).then(|| hex.to_ascii_lowercase())
}

fn is_sha256_hex(s: &str) -> bool {
    s.len() == 64 && s.bytes().all(|b| b.is_ascii_hexdigit())
}

/// Szuka sumy pliku `file_name` w treści `SHA256SUMS` (`<hex>  <nazwa>` lub `<hex> *<nazwa>`).
pub fn parse_sha256sums(text: &str, file_name: &str) -> Option<String> {
    text.lines().find_map(|line| {
        let (hash, rest) = line.trim().split_once(char::is_whitespace)?;
        let name = rest.trim_start().trim_start_matches('*');
        (name == file_name && is_sha256_hex(hash)).then(|| hash.to_ascii_lowercase())
    })
}

/// Czy dwa identyfikatory commitów oznaczają to samo (dopuszczamy skrót ≥ 7 znaków).
pub fn commits_match(a: &str, b: &str) -> bool {
    let (a, b) = (a.trim().to_ascii_lowercase(), b.trim().to_ascii_lowercase());
    if a.len() < 7 || b.len() < 7 {
        return false;
    }
    a.starts_with(&b) || b.starts_with(&a)
}

fn is_full_sha(s: &str) -> bool {
    s.len() == 40 && s.bytes().all(|b| b.is_ascii_hexdigit())
}

fn truncate_notes(body: Option<&str>) -> Option<String> {
    let body = body?.trim();
    (!body.is_empty()).then(|| body.chars().take(MAX_NOTES_CHARS).collect())
}

fn update_asset(release: &GhRelease, prefer_bazzite: bool) -> Option<UpdateAsset> {
    let asset = select_asset(&release.assets, prefer_bazzite)?;
    let checksums_url = release
        .assets
        .iter()
        .find(|a| a.name == CHECKSUMS_ASSET)
        .map(|a| a.browser_download_url.clone());
    Some(UpdateAsset {
        name: asset.name.clone(),
        url: asset.browser_download_url.clone(),
        size: asset.size,
        sha256: asset.digest.as_deref().and_then(digest_sha256),
        checksums_url,
    })
}

fn build_info(
    ctx: &CheckContext<'_>,
    available: bool,
    latest_version: Option<String>,
    latest_commit: Option<String>,
    release: &GhRelease,
) -> UpdateInfo {
    let asset = update_asset(release, ctx.prefer_bazzite);
    let can_install =
        available && ctx.install_kind == InstallKind::AppImageManaged && asset.is_some();
    UpdateInfo {
        available,
        channel: ctx.channel.to_string(),
        current_version: ctx.version.to_string(),
        current_commit: ctx.commit.to_string(),
        latest_version,
        latest_commit,
        release_url: (!release.html_url.is_empty()).then(|| release.html_url.clone()),
        release_notes: truncate_notes(release.body.as_deref()),
        asset,
        install_kind: ctx.install_kind,
        can_install,
        checked_at: ctx.now,
    }
}

/// Kanał stable: semver `tag_name` z `releases/latest` kontra wersja tej budowy.
pub fn evaluate_stable(
    release: &GhRelease,
    ctx: &CheckContext<'_>,
) -> Result<UpdateInfo, CommandError> {
    let latest = release.tag_name.trim().trim_start_matches('v').to_string();
    let available = domain::version::is_newer(&latest, ctx.version)?;
    Ok(build_info(ctx, available, Some(latest), None, release))
}

/// Kanał dev: commit wydania `dev-build` kontra wbudowany commit. Nieznany commit tej budowy
/// (`unknown`) nie daje podstaw do porównania, więc nie zgłaszamy aktualizacji.
pub fn evaluate_dev(
    release: &GhRelease,
    release_commit: &str,
    ctx: &CheckContext<'_>,
) -> UpdateInfo {
    let comparable = ctx.commit != "unknown" && !ctx.commit.is_empty();
    let available = comparable && !commits_match(ctx.commit, release_commit);
    let label = format!("dev-{}", short_commit(release_commit));
    build_info(
        ctx,
        available,
        Some(label),
        Some(release_commit.to_string()),
        release,
    )
}

async fn get_json<T: DeserializeOwned>(
    client: &reqwest::Client,
    url: &str,
) -> Result<T, CommandError> {
    let request = client
        .get(url)
        .header(reqwest::header::ACCEPT, "application/vnd.github+json");
    let response = send_with_retry(request)
        .await
        .map_err(|e| network_error(format!("Nie udało się połączyć z GitHubem: {e}")))?;
    let status = response.status();
    if status == reqwest::StatusCode::NOT_FOUND {
        return Err(CommandError::not_found(
            "Nie znaleziono wydania w repozytorium",
        ));
    }
    if matches!(status.as_u16(), 403 | 429) {
        let header = |name: &str| {
            response
                .headers()
                .get(name)
                .and_then(|v| v.to_str().ok())
                .map(str::to_string)
        };
        let exhausted = header("x-ratelimit-remaining").as_deref() == Some("0");
        let reset = header("x-ratelimit-reset");
        return Err(network_error(match (exhausted, reset) {
            (true, Some(reset)) => format!(
                "Limit zapytań GitHuba wyczerpany (odnowienie: unix {reset}) — spróbuj później"
            ),
            _ => format!("GitHub odrzucił zapytanie (HTTP {status})"),
        }));
    }
    if !status.is_success() {
        return Err(network_error(format!("GitHub zwrócił błąd HTTP {status}")));
    }
    response
        .json::<T>()
        .await
        .map_err(|e| network_error(format!("Nieprawidłowa odpowiedź GitHuba: {e}")))
}

/// Pobiera dane wydania właściwego dla kanału i ocenia, czy jest aktualizacja.
pub async fn check_release(
    client: &reqwest::Client,
    ctx: &CheckContext<'_>,
) -> Result<UpdateInfo, CommandError> {
    if ctx.channel == "dev" {
        let release: GhRelease = get_json(
            client,
            &format!("{}/releases/tags/{DEV_RELEASE_TAG}", ctx.api_base),
        )
        .await?;
        let target = release.target_commitish.trim();
        let commit = if is_full_sha(target) {
            target.to_string()
        } else {
            let safe = !target.is_empty()
                && target
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'_' | b'-' | b'/'));
            if !safe {
                return Err(network_error("Wydanie dev nie wskazuje poprawnego commita"));
            }
            let resolved: GhCommit =
                get_json(client, &format!("{}/commits/{target}", ctx.api_base)).await?;
            resolved.sha
        };
        return Ok(evaluate_dev(&release, &commit, ctx));
    }
    let release: GhRelease = get_json(client, &format!("{}/releases/latest", ctx.api_base)).await?;
    evaluate_stable(&release, ctx)
}

/// Ustala oczekiwaną sumę SHA-256 assetu: `digest` z API, a gdy go brak — `SHA256SUMS`.
/// Bez żadnego źródła zwraca błąd walidacji: nieweryfikowanego pliku nie instalujemy.
pub async fn resolve_sha256(
    client: &reqwest::Client,
    asset: &UpdateAsset,
) -> Result<String, CommandError> {
    if let Some(sha) = asset.sha256.as_deref().filter(|s| is_sha256_hex(s)) {
        return Ok(sha.to_ascii_lowercase());
    }
    let missing = || {
        CommandError::validation(
            "Wydanie nie zawiera sumy kontrolnej SHA-256 — instalacja odrzucona ze względów bezpieczeństwa",
        )
    };
    let url = asset.checksums_url.as_deref().ok_or_else(missing)?;
    let response = send_with_retry(client.get(url))
        .await
        .map_err(|e| network_error(format!("Nie udało się pobrać {CHECKSUMS_ASSET}: {e}")))?;
    if !response.status().is_success() {
        return Err(network_error(format!(
            "Pobranie {CHECKSUMS_ASSET} nie powiodło się (HTTP {})",
            response.status()
        )));
    }
    if response
        .content_length()
        .is_some_and(|len| len > MAX_CHECKSUMS_BYTES)
    {
        return Err(network_error(format!("{CHECKSUMS_ASSET} jest zbyt duży")));
    }
    let text = response
        .text()
        .await
        .map_err(|e| network_error(format!("Nie udało się odczytać {CHECKSUMS_ASSET}: {e}")))?;
    parse_sha256sums(&text, &asset.name).ok_or_else(missing)
}
