use std::path::Path;
use std::process::Command;

/// Commit the app was built from: `GITHUB_SHA` (CI) → `git rev-parse HEAD` → `unknown`.
fn build_commit() -> String {
    for var in ["AURALUNE_BUILD_COMMIT", "GITHUB_SHA"] {
        if let Ok(value) = std::env::var(var) {
            let value = value.trim().to_string();
            if !value.is_empty() {
                return value;
            }
        }
    }
    Command::new("git")
        .args(["rev-parse", "HEAD"])
        .output()
        .ok()
        .filter(|out| out.status.success())
        .and_then(|out| String::from_utf8(out.stdout).ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "unknown".to_string())
}

/// Build channel: `AURALUNE_BUILD_CHANNEL` (CI), or `dev` when the version has a `-dev` suffix.
fn build_channel() -> String {
    match std::env::var("AURALUNE_BUILD_CHANNEL").ok().as_deref() {
        Some("dev") => "dev".to_string(),
        Some("stable") => "stable".to_string(),
        _ => {
            let version = std::env::var("CARGO_PKG_VERSION").unwrap_or_default();
            if version.contains("-dev") {
                "dev".to_string()
            } else {
                "stable".to_string()
            }
        }
    }
}

/// Rebuild when the commit changes (HEAD and the branch file it points to).
fn watch_git_head() {
    let head = Path::new("../.git/HEAD");
    if !head.is_file() {
        return;
    }
    println!("cargo:rerun-if-changed={}", head.display());
    let Ok(content) = std::fs::read_to_string(head) else {
        return;
    };
    if let Some(reference) = content.trim().strip_prefix("ref: ") {
        let ref_path = Path::new("../.git").join(reference);
        if ref_path.is_file() {
            println!("cargo:rerun-if-changed={}", ref_path.display());
        }
    }
}

fn main() {
    println!("cargo:rerun-if-env-changed=AURALUNE_BUILD_COMMIT");
    println!("cargo:rerun-if-env-changed=GITHUB_SHA");
    println!("cargo:rerun-if-env-changed=AURALUNE_BUILD_CHANNEL");
    watch_git_head();
    println!("cargo:rustc-env=AURALUNE_BUILD_COMMIT={}", build_commit());
    println!("cargo:rustc-env=AURALUNE_BUILD_CHANNEL={}", build_channel());
    tauri_build::build()
}
