use super::error::CommandError;
use crate::AppState;
use domain::Theme;
use sha2::{Digest, Sha256};
use std::io::{Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::{Manager, State};
use tracing::warn;

const BACKGROUND_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "webp", "gif", "mp4", "webm"];
const MAX_IMAGE_BG_BYTES: usize = 25 * 1024 * 1024;
const MAX_VIDEO_BG_BYTES: usize = 100 * 1024 * 1024;
static BG_TMP_SEQ: AtomicU64 = AtomicU64::new(1);

fn normalize_bg_ext(ext: &str) -> Option<&'static str> {
    match ext.to_ascii_lowercase().as_str() {
        "png" => Some("png"),
        "jpg" | "jpeg" => Some("jpg"),
        "webp" => Some("webp"),
        "gif" => Some("gif"),
        "mp4" => Some("mp4"),
        "webm" => Some("webm"),
        _ => None,
    }
}

fn mime_for_bg_ext(ext: &str) -> Option<&'static str> {
    match ext.to_ascii_lowercase().as_str() {
        "png" => Some("image/png"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "webp" => Some("image/webp"),
        "gif" => Some("image/gif"),
        "mp4" => Some("video/mp4"),
        "webm" => Some("video/webm"),
        _ => None,
    }
}

fn ext_for_bg_mime(mime: &str) -> Option<&'static str> {
    match mime.trim().to_ascii_lowercase().as_str() {
        "image/png" => Some("png"),
        "image/jpeg" | "image/jpg" => Some("jpg"),
        "image/webp" => Some("webp"),
        "image/gif" => Some("gif"),
        "video/mp4" => Some("mp4"),
        "video/webm" => Some("webm"),
        _ => None,
    }
}

fn max_bg_bytes_for_ext(ext: &str) -> usize {
    match ext {
        "mp4" | "webm" => MAX_VIDEO_BG_BYTES,
        _ => MAX_IMAGE_BG_BYTES,
    }
}

/// Streams a local file into `app_data/backgrounds/{sha256}.{ext}` and returns its media URL.
pub fn store_background_file(data_dir: &Path, src_path: &Path) -> Result<String, CommandError> {
    let resolved = super::paths::ensure_readable(src_path, BACKGROUND_EXTENSIONS)?;
    let raw_ext = resolved.extension().and_then(|s| s.to_str()).unwrap_or("");
    let Some(clean_ext) = normalize_bg_ext(raw_ext) else {
        return Err(CommandError::validation(
            "Supported files are PNG, JPG, WebP, GIF and animated MP4/WebM video backgrounds",
        ));
    };
    let max_size = max_bg_bytes_for_ext(clean_ext);

    let meta = std::fs::metadata(&resolved)
        .map_err(|e| CommandError::from(e).context("Failed to read background file metadata"))?;
    if meta.len() > max_size as u64 {
        return Err(CommandError::validation(format!(
            "The background file is too large (max. {} MB)",
            max_size / (1024 * 1024)
        )));
    }

    let bg_dir = crate::media_protocol::backgrounds_dir(data_dir);
    std::fs::create_dir_all(&bg_dir)
        .map_err(|e| CommandError::from(e).context("Failed to create backgrounds directory"))?;

    let seq = BG_TMP_SEQ.fetch_add(1, Ordering::Relaxed);
    let tmp_path = bg_dir.join(format!(".tmp_{}_{}.part", std::process::id(), seq));

    let mut reader = std::fs::File::open(&resolved)
        .map_err(|e| CommandError::from(e).context("Failed to open the background file"))?;
    let mut writer = std::fs::File::create(&tmp_path)
        .map_err(|e| CommandError::from(e).context("Failed to stage background file"))?;

    let mut hasher = Sha256::new();
    let mut buf = [0u8; 64 * 1024];
    let mut total: usize = 0;

    loop {
        let n = reader
            .read(&mut buf)
            .map_err(|e| CommandError::from(e).context("Failed to read the background file"))?;
        if n == 0 {
            break;
        }
        total = total.saturating_add(n);
        if total > max_size {
            let _ = std::fs::remove_file(&tmp_path);
            return Err(CommandError::validation(format!(
                "The background file is too large (max. {} MB)",
                max_size / (1024 * 1024)
            )));
        }
        hasher.update(&buf[..n]);
        if let Err(e) = writer.write_all(&buf[..n]) {
            let _ = std::fs::remove_file(&tmp_path);
            return Err(CommandError::from(e).context("Failed to write the background file"));
        }
    }
    drop(writer);

    let sha_hex = hex::encode(hasher.finalize());
    let file_name = format!("{sha_hex}.{clean_ext}");
    let dest_path = bg_dir.join(&file_name);

    if dest_path.exists() {
        let _ = std::fs::remove_file(&tmp_path);
    } else if let Err(e) = std::fs::rename(&tmp_path, &dest_path) {
        let _ = std::fs::remove_file(&tmp_path);
        return Err(CommandError::from(e).context("Failed to finalise background file"));
    }

    Ok(crate::media_protocol::background_url(&file_name))
}

/// Writes decoded background bytes into `app_data/backgrounds/{sha256}.{ext}` and returns its media URL.
pub fn store_background_bytes(
    data_dir: &Path,
    bytes: &[u8],
    ext: &str,
) -> Result<String, CommandError> {
    let Some(clean_ext) = normalize_bg_ext(ext) else {
        return Err(CommandError::validation(
            "Unsupported background media format",
        ));
    };
    let max_size = max_bg_bytes_for_ext(clean_ext);
    if bytes.len() > max_size {
        return Err(CommandError::validation(format!(
            "The background file is too large (max. {} MB)",
            max_size / (1024 * 1024)
        )));
    }

    let bg_dir = crate::media_protocol::backgrounds_dir(data_dir);
    std::fs::create_dir_all(&bg_dir)
        .map_err(|e| CommandError::from(e).context("Failed to create backgrounds directory"))?;

    let sha_hex = hex::encode(Sha256::digest(bytes));
    let file_name = format!("{sha_hex}.{clean_ext}");
    let dest_path = bg_dir.join(&file_name);

    if !dest_path.exists() {
        let seq = BG_TMP_SEQ.fetch_add(1, Ordering::Relaxed);
        let tmp_path = bg_dir.join(format!(".tmp_{}_{}.part", std::process::id(), seq));
        std::fs::write(&tmp_path, bytes)
            .map_err(|e| CommandError::from(e).context("Failed to write background file"))?;
        if let Err(e) = std::fs::rename(&tmp_path, &dest_path) {
            let _ = std::fs::remove_file(&tmp_path);
            return Err(CommandError::from(e).context("Failed to finalise background file"));
        }
    }

    Ok(crate::media_protocol::background_url(&file_name))
}

/// Converts a `data:<mime>;base64,...` wallpaper ref into a stored `auralune-media://localhost/bg/...` URL.
pub fn normalize_background_ref_for_storage(
    data_dir: &Path,
    bg_ref: Option<String>,
) -> Result<Option<String>, CommandError> {
    let Some(raw) = bg_ref else {
        return Ok(None);
    };
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    if !trimmed.starts_with("data:") {
        return Ok(Some(trimmed.to_string()));
    }

    let Some((header, payload)) = trimmed.split_once(',') else {
        return Err(CommandError::validation("Invalid data URI background"));
    };
    let meta = header.strip_prefix("data:").unwrap_or("");
    let mime = meta.split(';').next().unwrap_or("");
    let Some(ext) = ext_for_bg_mime(mime) else {
        return Err(CommandError::validation(format!(
            "Unsupported background data URI MIME type: {mime}"
        )));
    };

    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(payload)
        .map_err(|e| CommandError::validation(format!("Invalid background base64 data: {e}")))?;

    store_background_bytes(data_dir, &bytes, ext).map(Some)
}

/// Inlines an `auralune-media://localhost/bg/{sha}.{ext}` wallpaper as a portable `data:` URI for export.
pub fn inline_background_ref_for_export(data_dir: &Path, bg_ref: Option<&str>) -> Option<String> {
    let raw = bg_ref?.trim();
    if raw.is_empty() {
        return None;
    }
    if let Some(crate::media_protocol::MediaRoute::Background { file_name }) =
        crate::media_protocol::parse_media_route(raw)
    {
        let candidate = crate::media_protocol::backgrounds_dir(data_dir).join(&file_name);
        let Ok(resolved) = super::paths::ensure_readable(&candidate, BACKGROUND_EXTENSIONS) else {
            warn!("Background file missing during export: {file_name}");
            return Some(raw.to_string());
        };
        let ext = resolved
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("png");
        let Some(mime) = mime_for_bg_ext(ext) else {
            return Some(raw.to_string());
        };
        if let Ok(bytes) = std::fs::read(&resolved) {
            use base64::Engine;
            let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
            return Some(format!("data:{mime};base64,{b64}"));
        }
    }
    Some(raw.to_string())
}

#[tauri::command]
pub async fn list_themes(state: State<'_, AppState>) -> Result<Vec<Theme>, CommandError> {
    state.db.list_themes().await.map_err(CommandError::from)
}

#[tauri::command]
pub async fn get_active_theme(state: State<'_, AppState>) -> Result<Theme, CommandError> {
    let active_id = state
        .db
        .get_app_setting("active_theme_id")
        .await?
        .unwrap_or_else(|| "cyber-kitsune".to_string());
    if let Some(theme) = state.db.get_theme(&active_id).await? {
        Ok(theme)
    } else {
        state
            .db
            .get_theme("cyber-kitsune")
            .await?
            .ok_or_else(|| CommandError::not_found("Default theme not found"))
    }
}

#[tauri::command]
pub async fn set_active_theme(
    theme_id: String,
    state: State<'_, AppState>,
) -> Result<Theme, CommandError> {
    let theme =
        state.db.get_theme(&theme_id).await?.ok_or_else(|| {
            CommandError::not_found(format!("Theme '{}' does not exist", theme_id))
        })?;
    state
        .db
        .set_app_setting("active_theme_id", &theme_id)
        .await?;
    Ok(theme)
}

#[tauri::command]
pub async fn update_theme_background(
    theme_id: String,
    background_ref: Option<String>,
    overlay_opacity: f32,
    blur_radius: f32,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Theme, CommandError> {
    let mut theme =
        state.db.get_theme(&theme_id).await?.ok_or_else(|| {
            CommandError::not_found(format!("Theme '{}' does not exist", theme_id))
        })?;

    let stored_ref = match background_ref {
        Some(ref s) if s.trim().starts_with("data:") => {
            let data_dir = app.path().app_data_dir()?;
            let input = Some(s.clone());
            tokio::task::spawn_blocking(move || {
                normalize_background_ref_for_storage(&data_dir, input)
            })
            .await??
        }
        other => other,
    };

    theme.background_ref = stored_ref;
    theme.overlay_opacity = overlay_opacity;
    theme.blur_radius = blur_radius;
    theme.validate()?;
    state.db.save_theme(&theme).await?;
    Ok(theme)
}

#[tauri::command]
pub async fn export_theme_json(
    theme_id: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<String, CommandError> {
    let mut theme =
        state.db.get_theme(&theme_id).await?.ok_or_else(|| {
            CommandError::not_found(format!("Theme '{}' does not exist", theme_id))
        })?;
    if theme
        .background_ref
        .as_deref()
        .is_some_and(|r| r.starts_with("auralune-media://"))
    {
        let data_dir = app.path().app_data_dir()?;
        let bg = theme.background_ref.clone();
        theme.background_ref = tokio::task::spawn_blocking(move || {
            inline_background_ref_for_export(&data_dir, bg.as_deref())
        })
        .await?;
    }
    serde_json::to_string_pretty(&theme).map_err(CommandError::from)
}

#[tauri::command]
pub async fn import_theme_json(
    json_content: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Theme, CommandError> {
    let mut theme: Theme = serde_json::from_str(&json_content)
        .map_err(|e| CommandError::from(e).context("JSON parse error"))?;
    theme.validate()?;

    if theme
        .background_ref
        .as_deref()
        .is_some_and(|r| r.trim().starts_with("data:"))
    {
        let data_dir = app.path().app_data_dir()?;
        let bg = theme.background_ref.take();
        theme.background_ref = tokio::task::spawn_blocking(move || {
            normalize_background_ref_for_storage(&data_dir, bg)
        })
        .await??;
    }

    state.db.save_theme(&theme).await?;
    state
        .db
        .set_app_setting("active_theme_id", &theme.id)
        .await?;
    Ok(theme)
}

#[tauri::command]
pub async fn upload_background_image(
    file_path: String,
    app: tauri::AppHandle,
) -> Result<String, CommandError> {
    let data_dir = app.path().app_data_dir()?;
    tokio::task::spawn_blocking(move || store_background_file(&data_dir, Path::new(&file_path)))
        .await?
}

/// The installation's identity on the system (stable / dev channel), used for icon names and the .desktop entry.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InstallIdentity {
    pub app_id: &'static str,
    pub display_name: &'static str,
    pub is_dev: bool,
}

/// The dev channel is recognised by `AURALUNE_CHANNEL=dev` (set by the `install.sh` launcher)
/// or by the AppImage path (`auralune-dev`). Everything else is the stable channel.
pub fn install_identity(channel_env: Option<&str>, appimage: Option<&str>) -> InstallIdentity {
    let is_dev = channel_env == Some("dev") || appimage.is_some_and(|p| p.contains("auralune-dev"));
    if is_dev {
        InstallIdentity {
            app_id: "auralune-dev",
            display_name: "Auralune (Dev)",
            is_dev,
        }
    } else {
        InstallIdentity {
            app_id: "auralune",
            display_name: "Auralune",
            is_dev,
        }
    }
}

pub fn update_system_icons(app: &tauri::AppHandle, style: &str) -> Result<(), CommandError> {
    let clean_style = if style == "classic" {
        "classic"
    } else {
        "lineout"
    };

    // App icons embedded in the binary, with no dependency on local developer paths
    let icon_bytes: Vec<u8> = if clean_style == "classic" {
        include_bytes!("../../icons/icon_classic.png").to_vec()
    } else {
        include_bytes!("../../icons/icon_lineout.png").to_vec()
    };

    // 1. Update the Tauri window icon on the fly
    if let Some(window) = app.get_webview_window("main") {
        if let Ok(tauri_icon) = tauri::image::Image::from_bytes(&icon_bytes) {
            let _ = window.set_icon(tauri_icon);
        }
    }

    let identity = install_identity(
        std::env::var("AURALUNE_CHANNEL").ok().as_deref(),
        std::env::var("APPIMAGE").ok().as_deref(),
    );

    // 2. Install into ~/.local/share/icons/hicolor for Wayland / KDE Plasma
    if let Some(home) = std::env::var_os("HOME") {
        let base_icons = std::path::PathBuf::from(home.clone()).join(".local/share/icons/hicolor");
        let sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
        for s in sizes {
            let dir = base_icons.join(format!("{}x{}/apps", s, s));
            let _ = std::fs::create_dir_all(&dir);

            // The icon comes only from resources embedded in the app (never from /tmp,
            // where any user could plant a file).
            let _ = std::fs::write(dir.join(format!("{}.png", identity.app_id)), &icon_bytes);
            if !identity.is_dev {
                let _ = std::fs::write(dir.join("auralune-desktop.png"), &icon_bytes);
            }
        }

        // 3. Update the .desktop files in ~/.local/share/applications
        // The dev channel has its own `auralune-dev.desktop` entry created by install.sh (Exec points at
        // its launcher), so we neither overwrite it nor create a stable entry.
        if !identity.is_dev {
            let apps_dir = std::path::PathBuf::from(home).join(".local/share/applications");
            let _ = std::fs::create_dir_all(&apps_dir);
            let desktop_content = r#"[Desktop Entry]
Name=Auralune
GenericName=Music Player
GenericName[pl]=Odtwarzacz muzyki
Comment=Poweramp & foobar2000 inspired Linux music player with anime aesthetics and real-time DSP
Comment[pl]=Inspirowany Powerampem i foobar2000 odtwarzacz muzyki dla Linuksa z estetyką anime i silnikiem DSP
Exec=auralune %U
Icon=auralune
Terminal=false
Type=Application
Categories=AudioVideo;Audio;Player;
MimeType=audio/flac;audio/mpeg;audio/ogg;audio/opus;audio/x-wav;audio/aac;audio/m4a;audio/x-m4a;
StartupNotify=true
StartupWMClass=auralune
Keywords=audio;music;player;dsp;soundtouch;rubberband;mpris;pipewire;
"#;
            let _ = std::fs::write(apps_dir.join("auralune.desktop"), desktop_content);
            let _ = std::fs::write(apps_dir.join("auralune-desktop.desktop"), desktop_content);
        }

        // 4. Refresh the icon cache
        let _ = std::process::Command::new("gtk-update-icon-cache")
            .arg("-f")
            .arg("-t")
            .arg(base_icons)
            .output();
    }

    Ok(())
}

#[tauri::command]
pub async fn set_app_icon_style(
    style: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<String, CommandError> {
    let clean = if style == "classic" {
        "classic"
    } else {
        "lineout"
    };
    state.db.set_app_setting("app_icon_style", clean).await?;

    // ~20 file writes and `gtk-update-icon-cache`, so off the Tokio threads.
    tokio::task::spawn_blocking(move || update_system_icons(&app, clean)).await??;
    Ok(clean.to_string())
}

#[tauri::command]
pub async fn get_app_icon_style(state: State<'_, AppState>) -> Result<String, CommandError> {
    let style = state
        .db
        .get_app_setting("app_icon_style")
        .await?
        .unwrap_or_else(|| "lineout".to_string());
    Ok(style)
}
