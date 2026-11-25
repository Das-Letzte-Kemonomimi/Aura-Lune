use super::error::CommandError;
use crate::AppState;
use domain::Theme;
use tauri::{Manager, State};

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
            .ok_or_else(|| CommandError::not_found("Nie znaleziono domyślnego motywu"))
    }
}

#[tauri::command]
pub async fn set_active_theme(
    theme_id: String,
    state: State<'_, AppState>,
) -> Result<Theme, CommandError> {
    let theme = state
        .db
        .get_theme(&theme_id)
        .await?
        .ok_or_else(|| CommandError::not_found(format!("Motyw '{}' nie istnieje", theme_id)))?;
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
    state: State<'_, AppState>,
) -> Result<Theme, CommandError> {
    let mut theme = state
        .db
        .get_theme(&theme_id)
        .await?
        .ok_or_else(|| CommandError::not_found(format!("Motyw '{}' nie istnieje", theme_id)))?;
    theme.background_ref = background_ref;
    theme.overlay_opacity = overlay_opacity;
    theme.blur_radius = blur_radius;
    theme.validate()?;
    state.db.save_theme(&theme).await?;
    Ok(theme)
}

#[tauri::command]
pub async fn export_theme_json(
    theme_id: String,
    state: State<'_, AppState>,
) -> Result<String, CommandError> {
    let theme = state
        .db
        .get_theme(&theme_id)
        .await?
        .ok_or_else(|| CommandError::not_found(format!("Motyw '{}' nie istnieje", theme_id)))?;
    serde_json::to_string_pretty(&theme).map_err(CommandError::from)
}

#[tauri::command]
pub async fn import_theme_json(
    json_content: String,
    state: State<'_, AppState>,
) -> Result<Theme, CommandError> {
    let theme: Theme = serde_json::from_str(&json_content)
        .map_err(|e| CommandError::from(e).context("Błąd parsowania JSON"))?;
    theme.validate()?;
    state.db.save_theme(&theme).await?;
    state
        .db
        .set_app_setting("active_theme_id", &theme.id)
        .await?;
    Ok(theme)
}

#[tauri::command]
pub async fn upload_background_image(file_path: String) -> Result<String, CommandError> {
    tokio::task::spawn_blocking(move || -> Result<String, CommandError> {
        // Rozwiązanie dowiązań: rozszerzenie sprawdzane jest na pliku docelowym.
        let resolved = super::paths::ensure_readable(
            std::path::Path::new(&file_path),
            &["png", "jpg", "jpeg", "webp", "gif", "mp4", "webm"],
        )?;
        let path = resolved.as_path();
        let ext = path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();
        let mime = match ext.as_str() {
            "png" => "image/png",
            "jpg" | "jpeg" => "image/jpeg",
            "webp" => "image/webp",
            "mp4" => "video/mp4",
            "webm" => "video/webm",
            _ => {
                return Err(CommandError::validation(
                    "Obsługiwane są pliki PNG, JPG, WebP oraz animowane wideo tła MP4/WebM",
                ))
            }
        };

        let bytes =
            std::fs::read(path).map_err(|e| CommandError::from(e).context("Błąd odczytu pliku"))?;
        let max_size = if mime.starts_with("video/") {
            100 * 1024 * 1024
        } else {
            25 * 1024 * 1024
        };
        if bytes.len() > max_size {
            return Err(format!(
                "Plik tła jest zbyt duży (maks. {} MB)",
                max_size / (1024 * 1024)
            )
            .into());
        }

        use base64::Engine;
        let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
        Ok(format!("data:{};base64,{}", mime, b64))
    })
    .await?
}

/// Tożsamość instalacji w systemie (kanał stable / dev), używana do nazw ikon i wpisu .desktop.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InstallIdentity {
    pub app_id: &'static str,
    pub display_name: &'static str,
    pub is_dev: bool,
}

/// Kanał dev rozpoznajemy po `AURALUNE_CHANNEL=dev` (ustawia go launcher z `install.sh`)
/// albo po ścieżce AppImage (`auralune-dev`). Wszystko inne to kanał stable.
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

    // Wbudowane ikony aplikacji bez zależności od lokalnych ścieżek dewelopera
    let icon_bytes: Vec<u8> = if clean_style == "classic" {
        include_bytes!("../../icons/icon_classic.png").to_vec()
    } else {
        include_bytes!("../../icons/icon_lineout.png").to_vec()
    };

    // 1. Zaktualizuj ikonę okna Tauri w locie
    if let Some(window) = app.get_webview_window("main") {
        if let Ok(tauri_icon) = tauri::image::Image::from_bytes(&icon_bytes) {
            let _ = window.set_icon(tauri_icon);
        }
    }

    let identity = install_identity(
        std::env::var("AURALUNE_CHANNEL").ok().as_deref(),
        std::env::var("APPIMAGE").ok().as_deref(),
    );

    // 2. Zainstaluj w ~/.local/share/icons/hicolor dla środowiska Wayland / KDE Plasma
    if let Some(home) = std::env::var_os("HOME") {
        let base_icons = std::path::PathBuf::from(home.clone()).join(".local/share/icons/hicolor");
        let sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
        for s in sizes {
            let dir = base_icons.join(format!("{}x{}/apps", s, s));
            let _ = std::fs::create_dir_all(&dir);

            // Ikona pochodzi wyłącznie z zasobów wbudowanych w aplikację (nigdy z /tmp,
            // gdzie dowolny użytkownik mógłby podłożyć plik).
            let _ = std::fs::write(dir.join(format!("{}.png", identity.app_id)), &icon_bytes);
            if !identity.is_dev {
                let _ = std::fs::write(dir.join("auralune-desktop.png"), &icon_bytes);
            }
        }

        // 3. Zaktualizuj pliki .desktop w ~/.local/share/applications
        // Kanał dev ma własny wpis `auralune-dev.desktop` tworzony przez install.sh (Exec wskazuje
        // jego launcher), więc nie nadpisujemy go ani nie tworzymy wpisu stable.
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

        // 4. Odśwież pamięć podręczną ikon
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

    // ~20 zapisów plików i `gtk-update-icon-cache` — poza wątkami Tokio.
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
