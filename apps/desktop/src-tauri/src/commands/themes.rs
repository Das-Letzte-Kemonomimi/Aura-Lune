use crate::AppState;
use domain::Theme;
use tauri::{Manager, State};

#[tauri::command]
pub fn list_themes(state: State<'_, AppState>) -> Result<Vec<Theme>, String> {
    let db = state.db.clone();
    state
        .rt
        .block_on(async move { db.list_themes().await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_active_theme(state: State<'_, AppState>) -> Result<Theme, String> {
    let db = state.db.clone();
    state
        .rt
        .block_on(async move {
            let active_id = db
                .get_app_setting("active_theme_id")
                .await?
                .unwrap_or_else(|| "cyber-kitsune".to_string());
            if let Some(theme) = db.get_theme(&active_id).await? {
                Ok(theme)
            } else {
                db.get_theme("cyber-kitsune").await?.ok_or_else(|| {
                    storage::StorageError::Migration("Nie znaleziono domyślnego motywu".to_string())
                })
            }
        })
        .map_err(|e: storage::StorageError| e.to_string())
}

#[tauri::command]
pub fn set_active_theme(theme_id: String, state: State<'_, AppState>) -> Result<Theme, String> {
    let db = state.db.clone();
    state
        .rt
        .block_on(async move {
            let theme = db.get_theme(&theme_id).await?.ok_or_else(|| {
                storage::StorageError::Migration(format!("Motyw '{}' nie istnieje", theme_id))
            })?;
            db.set_app_setting("active_theme_id", &theme_id).await?;
            Ok(theme)
        })
        .map_err(|e: storage::StorageError| e.to_string())
}

#[tauri::command]
pub fn save_theme(theme: Theme, state: State<'_, AppState>) -> Result<(), String> {
    theme.validate()?;
    let db = state.db.clone();
    state
        .rt
        .block_on(async move { db.save_theme(&theme).await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_theme_background(
    theme_id: String,
    background_ref: Option<String>,
    overlay_opacity: f32,
    blur_radius: f32,
    state: State<'_, AppState>,
) -> Result<Theme, String> {
    let db = state.db.clone();
    state
        .rt
        .block_on(async move {
            let mut theme = db.get_theme(&theme_id).await?.ok_or_else(|| {
                storage::StorageError::Migration(format!("Motyw '{}' nie istnieje", theme_id))
            })?;
            theme.background_ref = background_ref;
            theme.overlay_opacity = overlay_opacity;
            theme.blur_radius = blur_radius;
            theme.validate().map_err(storage::StorageError::Migration)?;
            db.save_theme(&theme).await?;
            Ok(theme)
        })
        .map_err(|e: storage::StorageError| e.to_string())
}

#[tauri::command]
pub fn export_theme_json(theme_id: String, state: State<'_, AppState>) -> Result<String, String> {
    let db = state.db.clone();
    state
        .rt
        .block_on(async move {
            let theme = db.get_theme(&theme_id).await?.ok_or_else(|| {
                storage::StorageError::Migration(format!("Motyw '{}' nie istnieje", theme_id))
            })?;
            serde_json::to_string_pretty(&theme)
                .map_err(|e| storage::StorageError::Migration(e.to_string()))
        })
        .map_err(|e: storage::StorageError| e.to_string())
}

#[tauri::command]
pub fn import_theme_json(
    json_content: String,
    state: State<'_, AppState>,
) -> Result<Theme, String> {
    let theme: Theme =
        serde_json::from_str(&json_content).map_err(|e| format!("Błąd parsowania JSON: {}", e))?;
    theme.validate()?;
    let db = state.db.clone();
    let theme_clone = theme.clone();
    state
        .rt
        .block_on(async move {
            db.save_theme(&theme_clone).await?;
            db.set_app_setting("active_theme_id", &theme_clone.id)
                .await?;
            Ok::<(), storage::StorageError>(())
        })
        .map_err(|e| e.to_string())?;
    Ok(theme)
}

#[tauri::command]
pub fn upload_background_image(file_path: String) -> Result<String, String> {
    let path = std::path::Path::new(&file_path);
    if !path.exists() {
        return Err("Wskazany plik nie istnieje".to_string());
    }
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
            return Err(
                "Obsługiwane są pliki PNG, JPG, WebP oraz animowane wideo tła MP4/WebM".to_string(),
            )
        }
    };

    let bytes = std::fs::read(path).map_err(|e| format!("Błąd odczytu pliku: {}", e))?;
    let max_size = if mime.starts_with("video/") {
        100 * 1024 * 1024
    } else {
        25 * 1024 * 1024
    };
    if bytes.len() > max_size {
        return Err(format!(
            "Plik tła jest zbyt duży (maks. {} MB)",
            max_size / (1024 * 1024)
        ));
    }

    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
}

pub fn update_system_icons(app: &tauri::AppHandle, style: &str) -> Result<(), String> {
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

    // 2. Zainstaluj w ~/.local/share/icons/hicolor dla środowiska Wayland / KDE Plasma
    if let Some(home) = std::env::var_os("HOME") {
        let base_icons = std::path::PathBuf::from(home.clone()).join(".local/share/icons/hicolor");
        let sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
        for s in sizes {
            let dir = base_icons.join(format!("{}x{}/apps", s, s));
            let _ = std::fs::create_dir_all(&dir);

            let specific_bytes = if clean_style == "lineout" {
                std::fs::read(format!("/tmp/lineout_{}.png", s))
                    .unwrap_or_else(|_| icon_bytes.clone())
            } else {
                icon_bytes.clone()
            };

            let _ = std::fs::write(dir.join("auralune.png"), &specific_bytes);
            let _ = std::fs::write(dir.join("auralune-desktop.png"), &specific_bytes);
        }

        // 3. Zaktualizuj pliki .desktop w ~/.local/share/applications
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
) -> Result<String, String> {
    let clean = if style == "classic" {
        "classic"
    } else {
        "lineout"
    };
    state
        .db
        .set_app_setting("app_icon_style", clean)
        .await
        .map_err(|e| e.to_string())?;

    update_system_icons(&app, clean)?;
    Ok(clean.to_string())
}

#[tauri::command]
pub async fn get_app_icon_style(state: State<'_, AppState>) -> Result<String, String> {
    let style = state
        .db
        .get_app_setting("app_icon_style")
        .await
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| "lineout".to_string());
    Ok(style)
}
