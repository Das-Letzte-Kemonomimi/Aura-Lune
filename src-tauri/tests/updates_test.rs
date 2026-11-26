//! Logika aktualizacji: wybór assetu, sumy kontrolne, porównanie wydań i throttling, a także
//! sprawdzanie wydań na lokalnym serwerze HTTP (bez dostępu do GitHuba).

use auralune_desktop::updater::check::{
    check_release, commits_match, digest_sha256, evaluate_dev, evaluate_stable, is_bazzite_like,
    parse_sha256sums, resolve_sha256, select_asset, CheckContext, GhAsset, GhRelease,
};
use auralune_desktop::updater::install::{
    looks_like_appimage, restart_target, staging_path, validate_asset_url,
};
use auralune_desktop::updater::{
    is_skipped, should_check, InstallKind, UpdateAsset, CHECK_INTERVAL_SECS,
};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::path::Path;

const SHA_A: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SHA_B: &str = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const OLD_COMMIT: &str = "1111111111111111111111111111111111111111";
const NEW_COMMIT: &str = "2222222222222222222222222222222222222222";

fn asset(name: &str) -> GhAsset {
    GhAsset {
        name: name.to_string(),
        browser_download_url: format!("https://github.com/o/r/releases/download/t/{name}"),
        size: 10,
        digest: None,
    }
}

fn release(tag: &str, commitish: &str, assets: Vec<GhAsset>) -> GhRelease {
    GhRelease {
        tag_name: tag.to_string(),
        html_url: "https://github.com/o/r/releases/tag/t".to_string(),
        target_commitish: commitish.to_string(),
        body: Some("notes".to_string()),
        assets,
    }
}

fn ctx<'a>(
    channel: &'a str,
    version: &'a str,
    commit: &'a str,
    kind: InstallKind,
) -> CheckContext<'a> {
    CheckContext {
        api_base: "http://unused",
        channel,
        version,
        commit,
        install_kind: kind,
        prefer_bazzite: false,
        now: 42,
    }
}

#[test]
fn asset_selection_prefers_bazzite_only_when_asked() {
    let assets = vec![
        asset("Auralune_1.2.0_bazzite_amd64.AppImage"),
        asset("Auralune_1.2.0_amd64.AppImage"),
        asset("SHA256SUMS"),
    ];
    assert_eq!(
        select_asset(&assets, true).unwrap().name,
        "Auralune_1.2.0_bazzite_amd64.AppImage"
    );
    assert_eq!(
        select_asset(&assets, false).unwrap().name,
        "Auralune_1.2.0_amd64.AppImage"
    );
}

#[test]
fn asset_selection_falls_back_and_ignores_non_appimages() {
    let generic_only = vec![asset("Auralune_1.2.0_amd64.AppImage"), asset("notes.txt")];
    assert_eq!(
        select_asset(&generic_only, true).unwrap().name,
        "Auralune_1.2.0_amd64.AppImage"
    );
    let bazzite_only = vec![asset("Auralune_1.2.0_bazzite_amd64.AppImage")];
    assert!(select_asset(&bazzite_only, false).is_none());
    assert!(select_asset(&[asset("SHA256SUMS")], false).is_none());
}

#[test]
fn bazzite_detection_matches_install_sh_rules() {
    assert!(is_bazzite_like("NAME=Bazzite\nID=bazzite\n"));
    assert!(is_bazzite_like("ID=fedora\n"));
    assert!(is_bazzite_like(
        "ID=nobara\nID_LIKE=\"rhel centos fedora\"\n"
    ));
    assert!(!is_bazzite_like("ID=arch\nID_LIKE=archlinux\n"));
    assert!(!is_bazzite_like("ID=ubuntu\nID_LIKE=debian\n"));
}

#[test]
fn sha256sums_are_parsed_in_text_and_binary_mode() {
    let text = format!("{SHA_A}  Auralune_1.2.0_amd64.AppImage\n{SHA_B} *other.AppImage\n");
    assert_eq!(
        parse_sha256sums(&text, "Auralune_1.2.0_amd64.AppImage").as_deref(),
        Some(SHA_A)
    );
    assert_eq!(
        parse_sha256sums(&text, "other.AppImage").as_deref(),
        Some(SHA_B)
    );
    assert_eq!(parse_sha256sums(&text, "missing.AppImage"), None);
    // Podobna nazwa (sufiks/prefiks) nie może zostać dopasowana, a krótka suma jest odrzucana.
    assert_eq!(parse_sha256sums(&text, "amd64.AppImage"), None);
    assert_eq!(
        parse_sha256sums("abc123  file.AppImage\n", "file.AppImage"),
        None
    );
}

#[test]
fn api_digest_must_be_a_full_sha256() {
    assert_eq!(
        digest_sha256(&format!("sha256:{SHA_A}")).as_deref(),
        Some(SHA_A)
    );
    assert_eq!(
        digest_sha256(&format!("sha256:{}", SHA_A.to_uppercase())).as_deref(),
        Some(SHA_A)
    );
    assert_eq!(digest_sha256("sha1:abcd"), None);
    assert_eq!(digest_sha256("sha256:abcd"), None);
}

#[test]
fn stable_update_uses_semver_not_string_order() {
    let c = ctx("stable", "1.1.10", "x", InstallKind::AppImageManaged);
    let newer = release("v1.2.0", "main", vec![asset("a_amd64.AppImage")]);
    let info = evaluate_stable(&newer, &c).unwrap();
    assert!(info.available && info.can_install);
    assert_eq!(info.latest_version.as_deref(), Some("1.2.0"));

    let same = evaluate_stable(&release("v1.1.10", "main", vec![]), &c).unwrap();
    assert!(!same.available);

    // Wydanie 1.1.6 jest nowsze niż wersja deweloperska 1.1.6-dev tego samego numeru.
    let dev_build = ctx("stable", "1.1.6-dev", "x", InstallKind::System);
    let release_116 = release("v1.1.6", "main", vec![asset("a.AppImage")]);
    let info = evaluate_stable(&release_116, &dev_build).unwrap();
    assert!(info.available);
    assert!(
        !info.can_install,
        "pakiety systemowe aktualizuje menedżer pakietów"
    );

    assert!(evaluate_stable(&release("not-a-version", "main", vec![]), &c).is_err());
}

#[test]
fn dev_update_compares_commits_and_never_looks_at_versions() {
    let c = ctx("dev", "1.1.6-dev", OLD_COMMIT, InstallKind::AppImageManaged);
    let rel = release("dev-build", NEW_COMMIT, vec![asset("a.AppImage")]);
    let info = evaluate_dev(&rel, NEW_COMMIT, &c);
    assert!(info.available);
    assert_eq!(info.latest_version.as_deref(), Some("dev-2222222"));
    assert_eq!(info.latest_commit.as_deref(), Some(NEW_COMMIT));

    let current = ctx("dev", "1.1.6-dev", NEW_COMMIT, InstallKind::AppImageManaged);
    assert!(!evaluate_dev(&rel, NEW_COMMIT, &current).available);

    // Uruchomienie deweloperskie kanału dev może zainstalować aktualizację z przycisku.
    let dev_server = ctx("dev", "1.1.6-dev", OLD_COMMIT, InstallKind::DevServer);
    assert!(evaluate_dev(&rel, NEW_COMMIT, &dev_server).can_install);
    let system = ctx("dev", "1.1.6-dev", OLD_COMMIT, InstallKind::System);
    assert!(!evaluate_dev(&rel, NEW_COMMIT, &system).can_install);

    let unknown = ctx("dev", "1.1.6-dev", "unknown", InstallKind::AppImageManaged);
    assert!(!evaluate_dev(&rel, NEW_COMMIT, &unknown).available);
}

#[test]
fn commit_ids_match_by_prefix() {
    assert!(commits_match(NEW_COMMIT, "2222222"));
    assert!(commits_match("2222222", NEW_COMMIT));
    assert!(!commits_match(NEW_COMMIT, OLD_COMMIT));
    assert!(
        !commits_match("222", "222"),
        "zbyt krótki skrót nie identyfikuje commita"
    );
}

#[test]
fn background_checks_are_throttled_to_six_hours() {
    let now = 1_000_000;
    assert!(should_check(now, None, false));
    assert!(!should_check(now, Some(now - 60), false));
    assert!(!should_check(
        now,
        Some(now - CHECK_INTERVAL_SECS + 1),
        false
    ));
    assert!(should_check(now, Some(now - CHECK_INTERVAL_SECS), false));
    assert!(
        should_check(now, Some(now - 60), true),
        "force omija throttling"
    );
    assert!(
        should_check(now, Some(now + 500), false),
        "zegar cofnięty → sprawdź ponownie"
    );
}

#[test]
fn skipped_version_matches_only_the_same_id() {
    assert!(is_skipped(Some("1.2.0"), Some("1.2.0")));
    assert!(!is_skipped(Some("1.2.0"), Some("1.2.1")));
    assert!(!is_skipped(None, Some("1.2.0")));
    assert!(!is_skipped(Some(""), Some("")));
}

#[test]
fn asset_urls_must_be_https_github() {
    assert!(validate_asset_url("https://github.com/o/r/releases/download/t/a.AppImage").is_ok());
    assert!(validate_asset_url("https://objects.githubusercontent.com/x/a").is_ok());
    for bad in [
        "http://github.com/o/r/a.AppImage",
        "https://evil.example.com/a.AppImage",
        "https://github.com.evil.example/a",
        "https://notgithub.com/a",
        "file:///etc/passwd",
        "not a url",
    ] {
        assert!(validate_asset_url(bad).is_err(), "{bad}");
    }
}

#[test]
fn staging_file_sits_next_to_the_target() {
    let target = Path::new("/home/u/.local/share/auralune/auralune.AppImage");
    assert_eq!(
        staging_path(target),
        Path::new("/home/u/.local/share/auralune/auralune.AppImage.update")
    );
}

/// Serwer HTTP odpowiadający na ścieżki z mapy: `ścieżka → (status, dodatkowe nagłówki, treść)`.
fn serve(routes: HashMap<&'static str, (u16, &'static str, String)>) -> String {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    std::thread::spawn(move || {
        for stream in listener.incoming() {
            let Ok(mut stream) = stream else { return };
            let mut buf = [0u8; 4096];
            let n = stream.read(&mut buf).unwrap_or(0);
            let request = String::from_utf8_lossy(&buf[..n]).to_string();
            let path = request.split_whitespace().nth(1).unwrap_or("/").to_string();
            let (status, headers, body) =
                routes
                    .get(path.as_str())
                    .cloned()
                    .unwrap_or((404, "", String::new()));
            let _ = write!(
                stream,
                "HTTP/1.1 {status} X\r\n{headers}Content-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
        }
    });
    base
}

fn release_json(tag: &str, commitish: &str) -> String {
    serde_json::json!({
        "tag_name": tag,
        "html_url": "https://github.com/o/r/releases/tag/x",
        "target_commitish": commitish,
        "body": "changelog",
        "assets": [
            { "name": "Auralune_amd64.AppImage", "browser_download_url": "https://github.com/o/r/releases/download/x/Auralune_amd64.AppImage", "size": 1234, "digest": format!("sha256:{SHA_A}") },
            { "name": "SHA256SUMS", "browser_download_url": "https://github.com/o/r/releases/download/x/SHA256SUMS", "size": 100 }
        ]
    })
    .to_string()
}

fn http_ctx<'a>(
    base: &'a str,
    channel: &'a str,
    version: &'a str,
    commit: &'a str,
) -> CheckContext<'a> {
    CheckContext {
        api_base: base,
        channel,
        version,
        commit,
        install_kind: InstallKind::AppImageManaged,
        prefer_bazzite: false,
        now: 7,
    }
}

#[tokio::test]
async fn stable_channel_reads_releases_latest_only() {
    let mut routes = HashMap::new();
    routes.insert(
        "/releases/latest",
        (200, "", release_json("v1.3.0", "main")),
    );
    // Wydanie dev istnieje, ale kanał stable nie może go odpytywać.
    routes.insert(
        "/releases/tags/dev-build",
        (200, "", release_json("dev-build", NEW_COMMIT)),
    );
    let base = serve(routes);
    let client = metadata::http::build_client(std::time::Duration::from_secs(5));

    let info = check_release(&client, &http_ctx(&base, "stable", "1.1.6", "x"))
        .await
        .unwrap();
    assert!(info.available);
    assert_eq!(info.latest_version.as_deref(), Some("1.3.0"));
    let asset = info.asset.unwrap();
    assert_eq!(asset.sha256.as_deref(), Some(SHA_A));
    assert!(asset.checksums_url.is_some());
}

#[tokio::test]
async fn dev_channel_resolves_branch_names_to_commits() {
    let mut routes = HashMap::new();
    routes.insert(
        "/releases/tags/dev-build",
        (200, "", release_json("dev-build", "dev")),
    );
    routes.insert(
        "/commits/dev",
        (
            200,
            "",
            serde_json::json!({ "sha": NEW_COMMIT }).to_string(),
        ),
    );
    routes.insert(
        "/releases/latest",
        (200, "", release_json("v9.9.9", "main")),
    );
    let base = serve(routes);
    let client = metadata::http::build_client(std::time::Duration::from_secs(5));

    let outdated = check_release(&client, &http_ctx(&base, "dev", "1.1.6-dev", OLD_COMMIT))
        .await
        .unwrap();
    assert!(outdated.available);
    assert_eq!(outdated.latest_commit.as_deref(), Some(NEW_COMMIT));

    let current = check_release(&client, &http_ctx(&base, "dev", "1.1.6-dev", NEW_COMMIT))
        .await
        .unwrap();
    assert!(!current.available);
}

#[tokio::test]
async fn rate_limit_and_missing_release_are_reported_with_codes() {
    let mut routes = HashMap::new();
    routes.insert(
        "/releases/latest",
        (
            403,
            "X-RateLimit-Remaining: 0\r\nX-RateLimit-Reset: 1900000000\r\n",
            String::new(),
        ),
    );
    let base = serve(routes);
    let client = metadata::http::build_client(std::time::Duration::from_secs(5));

    let limited = check_release(&client, &http_ctx(&base, "stable", "1.1.6", "x"))
        .await
        .unwrap_err();
    assert_eq!(serde_json::to_value(&limited).unwrap()["code"], "network");
    assert!(limited.message.contains("1900000000"));

    let missing = check_release(&client, &http_ctx(&base, "dev", "1.1.6-dev", OLD_COMMIT))
        .await
        .unwrap_err();
    assert_eq!(serde_json::to_value(&missing).unwrap()["code"], "not_found");
}

#[tokio::test]
async fn checksum_comes_from_digest_then_sha256sums_and_is_otherwise_refused() {
    let mut routes = HashMap::new();
    routes.insert(
        "/SHA256SUMS",
        (200, "", format!("{SHA_B}  Auralune_amd64.AppImage\n")),
    );
    let base = serve(routes);
    let client = metadata::http::build_client(std::time::Duration::from_secs(5));
    let mut asset = UpdateAsset {
        name: "Auralune_amd64.AppImage".to_string(),
        url: "https://github.com/o/r/a".to_string(),
        size: 1,
        sha256: Some(SHA_A.to_string()),
        checksums_url: Some(format!("{base}/SHA256SUMS")),
    };
    assert_eq!(resolve_sha256(&client, &asset).await.unwrap(), SHA_A);

    asset.sha256 = None;
    assert_eq!(resolve_sha256(&client, &asset).await.unwrap(), SHA_B);

    asset.name = "unlisted.AppImage".to_string();
    let err = resolve_sha256(&client, &asset).await.unwrap_err();
    assert_eq!(serde_json::to_value(&err).unwrap()["code"], "validation");

    asset.checksums_url = None;
    let err = resolve_sha256(&client, &asset).await.unwrap_err();
    assert_eq!(serde_json::to_value(&err).unwrap()["code"], "validation");
}

#[test]
fn downloaded_file_must_look_like_an_elf_appimage() {
    let dir = std::env::temp_dir().join(format!("auralune-update-test-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let elf = dir.join("ok.AppImage");
    let html = dir.join("bad.AppImage");
    std::fs::write(&elf, b"\x7fELF\x02\x01\x01").unwrap();
    std::fs::write(&html, b"<html>rate limited</html>").unwrap();
    assert!(looks_like_appimage(&elf));
    assert!(!looks_like_appimage(&html));
    assert!(!looks_like_appimage(&dir.join("missing")));
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn restart_prefers_the_launcher_and_falls_back_to_the_appimage() {
    let home = std::env::temp_dir().join(format!("auralune-restart-test-{}", std::process::id()));
    let bin = home.join(".local/bin");
    std::fs::create_dir_all(&bin).unwrap();
    let appimage = "/home/u/.local/share/auralune/auralune.AppImage";
    assert_eq!(
        restart_target(Some(&home), false, Some(appimage)),
        Some(Path::new(appimage).to_path_buf())
    );
    std::fs::write(bin.join("auralune-dev"), "#!/bin/sh\n").unwrap();
    assert_eq!(
        restart_target(Some(&home), true, Some(appimage)),
        Some(bin.join("auralune-dev"))
    );
    // Launcher kanału stable nie zastępuje launchera dev i odwrotnie.
    assert_eq!(
        restart_target(Some(&home), false, None),
        None,
        "bez launchera stable i bez APPIMAGE nie ma czym uruchomić"
    );
    let _ = std::fs::remove_dir_all(&home);
}
