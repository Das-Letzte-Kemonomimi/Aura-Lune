//! Dialogs and the file manager (KDE Dolphin, Zenity, xdg-open).

use super::error::CommandError;
use tracing::info;

pub fn is_kde_environment() -> bool {
    std::env::var("XDG_CURRENT_DESKTOP")
        .map(|d| d.to_uppercase().contains("KDE"))
        .unwrap_or(false)
        || std::env::var("KDE_FULL_SESSION").is_ok()
}

#[tauri::command]
pub async fn pick_folder() -> Result<Option<String>, CommandError> {
    tokio::task::spawn_blocking(|| {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());

        let try_kdialog = || -> Option<String> {
            if let Ok(output) = std::process::Command::new("kdialog")
                .args([
                    "--getexistingdirectory",
                    &home,
                    "--title",
                    "Choose a music folder (Dolphin)",
                ])
                .output()
            {
                if output.status.success() {
                    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !path.is_empty() {
                        return Some(path);
                    }
                }
            }
            None
        };

        let try_zenity = || -> Option<String> {
            if let Ok(output) = std::process::Command::new("zenity")
                .args([
                    "--file-selection",
                    "--directory",
                    "--title=Choose a music folder",
                ])
                .output()
            {
                if output.status.success() {
                    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !path.is_empty() {
                        return Some(path);
                    }
                }
            }
            None
        };

        if is_kde_environment() {
            try_kdialog().or_else(try_zenity)
        } else {
            try_zenity().or_else(try_kdialog)
        }
    })
    .await
    .map_err(CommandError::from)
}

#[tauri::command]
pub async fn pick_files() -> Result<Vec<String>, CommandError> {
    tokio::task::spawn_blocking(|| {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());

        let try_kdialog = || -> Option<Vec<String>> {
            if let Ok(output) = std::process::Command::new("kdialog")
                .args([
                    "--getopenfilename",
                    &home,
                    "*.flac *.mp3 *.ogg *.opus *.wav *.m4a *.aac *.alac *.aiff|Audio files (*.flac, *.mp3, *.ogg, *.opus, *.wav, *.m4a)",
                    "--multiple",
                    "--separate-output",
                    "--title",
                    "Choose audio files (Dolphin)",
                ])
                .output()
            {
                if output.status.success() {
                    let paths_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !paths_str.is_empty() {
                        let paths: Vec<String> = paths_str
                            .lines()
                            .map(|s| s.trim().to_string())
                            .filter(|s| !s.is_empty())
                            .collect();
                        return Some(paths);
                    }
                }
            }
            None
        };

        let try_zenity = || -> Option<Vec<String>> {
            if let Ok(output) = std::process::Command::new("zenity")
                .args([
                    "--file-selection",
                    "--multiple",
                    "--separator=|",
                    "--title=Choose audio files",
                    "--file-filter=Audio files (FLAC, MP3, OGG, OPUS, WAV, M4A) | *.flac *.mp3 *.ogg *.opus *.wav *.m4a *.aac *.alac *.aiff",
                ])
                .output()
            {
                if output.status.success() {
                    let paths_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !paths_str.is_empty() {
                        let paths: Vec<String> = paths_str
                            .split('|')
                            .map(|s| s.trim().to_string())
                            .filter(|s| !s.is_empty())
                            .collect();
                        return Some(paths);
                    }
                }
            }
            None
        };

        let selected = if is_kde_environment() {
            try_kdialog().or_else(try_zenity)
        } else {
            try_zenity().or_else(try_kdialog)
        };

        selected.unwrap_or_default()
    })
    .await
    .map_err(CommandError::from)
}

#[tauri::command]
pub async fn pick_image_file() -> Result<Option<String>, CommandError> {
    tokio::task::spawn_blocking(|| {
        let pictures = std::env::var("HOME")
            .map(|h| format!("{}/Pictures", h))
            .unwrap_or_else(|_| ".".to_string());

        let try_kdialog = || -> Option<String> {
            if let Ok(output) = std::process::Command::new("kdialog")
                .args([
                    "--getopenfilename",
                    &pictures,
                    "*.png *.jpg *.jpeg *.webp *.gif *.mp4 *.webm|Wallpapers and animated video (*.png, *.jpg, *.mp4, *.webm)",
                    "--title",
                    "Choose a wallpaper or animated video background (Dolphin)",
                ])
                .output()
            {
                if output.status.success() {
                    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !path.is_empty() {
                        return Some(path);
                    }
                }
            }
            None
        };

        let try_zenity = || -> Option<String> {
            if let Ok(output) = std::process::Command::new("zenity")
                .args([
                    "--file-selection",
                    "--title=Choose a wallpaper or animated video background",
                    "--file-filter=Images and video (PNG, JPG, WebP, MP4, WebM) | *.png *.jpg *.jpeg *.webp *.gif *.mp4 *.webm",
                ])
                .output()
            {
                if output.status.success() {
                    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !path.is_empty() {
                        return Some(path);
                    }
                }
            }
            None
        };

        if is_kde_environment() {
            try_kdialog().or_else(try_zenity)
        } else {
            try_zenity().or_else(try_kdialog)
        }
    })
    .await
    .map_err(CommandError::from)
}

#[tauri::command]
pub async fn pick_single_audio_file() -> Result<Option<String>, CommandError> {
    tokio::task::spawn_blocking(|| {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());

        let try_kdialog = || -> Option<String> {
            if let Ok(output) = std::process::Command::new("kdialog")
                .args([
                    "--getopenfilename",
                    &home,
                    "*.flac *.mp3 *.ogg *.opus *.wav *.m4a *.aac *.alac *.aiff|Audio files (*.flac, *.mp3, *.ogg, *.opus, *.wav, *.m4a)",
                    "--title",
                    "Choose a source file to transcode (Dolphin)",
                ])
                .output()
            {
                if output.status.success() {
                    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !path.is_empty() {
                        return Some(path);
                    }
                }
            }
            None
        };

        let try_zenity = || -> Option<String> {
            if let Ok(output) = std::process::Command::new("zenity")
                .args([
                    "--file-selection",
                    "--title=Choose a source file to transcode",
                    "--file-filter=Audio files (FLAC, MP3, OGG, OPUS, WAV, M4A) | *.flac *.mp3 *.ogg *.opus *.wav *.m4a *.aac *.alac *.aiff",
                ])
                .output()
            {
                if output.status.success() {
                    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !path.is_empty() {
                        return Some(path);
                    }
                }
            }
            None
        };

        if is_kde_environment() {
            try_kdialog().or_else(try_zenity)
        } else {
            try_zenity().or_else(try_kdialog)
        }
    })
    .await
    .map_err(CommandError::from)
}

#[tauri::command]
pub async fn pick_save_destination(
    default_name: String,
    extension: String,
) -> Result<Option<String>, CommandError> {
    tokio::task::spawn_blocking(move || {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
        let target_file = format!("{}/{}", home, default_name);
        let filter = format!("*.{}|Files (*.{})", extension, extension);

        let try_kdialog = || -> Option<String> {
            if let Ok(output) = std::process::Command::new("kdialog")
                .args([
                    "--getsavefilename",
                    &target_file,
                    &filter,
                    "--title",
                    "Choose where to save (Dolphin)",
                ])
                .output()
            {
                if output.status.success() {
                    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !path.is_empty() {
                        return Some(path);
                    }
                }
            }
            None
        };

        let try_zenity = || -> Option<String> {
            if let Ok(output) = std::process::Command::new("zenity")
                .args([
                    "--file-selection",
                    "--save",
                    "--confirm-overwrite",
                    &format!("--filename={}", target_file),
                    "--title=Choose where to save",
                ])
                .output()
            {
                if output.status.success() {
                    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !path.is_empty() {
                        return Some(path);
                    }
                }
            }
            None
        };

        if is_kde_environment() {
            try_kdialog().or_else(try_zenity)
        } else {
            try_zenity().or_else(try_kdialog)
        }
    })
    .await
    .map_err(CommandError::from)
}

#[tauri::command]
pub async fn pick_custom_file(
    title: String,
    filter: String,
) -> Result<Option<String>, CommandError> {
    // The filter is a positional kdialog argument: a value starting with `-` would be an option.
    if filter.trim_start().starts_with('-') {
        return Err(CommandError::validation(format!(
            "Invalid file filter: {filter}"
        )));
    }
    tokio::task::spawn_blocking(move || {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());

        let try_kdialog = || -> Option<String> {
            if let Ok(output) = std::process::Command::new("kdialog")
                .args(["--getopenfilename", &home, &filter, "--title", &title])
                .output()
            {
                if output.status.success() {
                    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !path.is_empty() {
                        return Some(path);
                    }
                }
            }
            None
        };

        let try_zenity = || -> Option<String> {
            let filter_arg = format!("--file-filter={}", filter);
            let title_arg = format!("--title={}", title);
            if let Ok(output) = std::process::Command::new("zenity")
                .args(["--file-selection", &title_arg, &filter_arg])
                .output()
            {
                if output.status.success() {
                    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !path.is_empty() {
                        return Some(path);
                    }
                }
            }
            None
        };

        if is_kde_environment() {
            try_kdialog().or_else(try_zenity)
        } else {
            try_zenity().or_else(try_kdialog)
        }
    })
    .await
    .map_err(CommandError::from)
}

#[tauri::command]
pub async fn open_containing_folder(file_path: String) -> Result<String, CommandError> {
    info!("Tauri command: open_containing_folder('{}')", file_path);
    tokio::task::spawn_blocking(move || {
        let clean = if let Some(stripped) = file_path.strip_prefix("file://") {
            stripped
        } else {
            &file_path
        };

        let p = std::path::Path::new(clean);
        let abs_path = if p.is_absolute() {
            p.to_path_buf()
        } else {
            std::env::current_dir().unwrap_or_default().join(p)
        };

        let target_dir = if abs_path.is_dir() {
            abs_path.clone()
        } else {
            abs_path
                .parent()
                .map(|p| p.to_path_buf())
                .unwrap_or_else(|| std::path::PathBuf::from("."))
        };

        // 1. On KDE Plasma, use the native Dolphin command with --select
        if is_kde_environment() {
            if abs_path.exists() && !abs_path.is_dir() {
                if std::process::Command::new("dolphin")
                    .arg("--select")
                    .arg(&abs_path)
                    .spawn()
                    .map(reap_in_background)
                    .is_ok()
                {
                    return Ok(target_dir.to_string_lossy().to_string());
                }
            } else if std::process::Command::new("dolphin")
                .arg(&target_dir)
                .spawn()
                .map(reap_in_background)
                .is_ok()
            {
                return Ok(target_dir.to_string_lossy().to_string());
            }
        }

        // 2. Standard DBus: org.freedesktop.FileManager1.ShowItems (Dolphin, Nautilus, Nemo, Thunar)
        if abs_path.exists() && !abs_path.is_dir() {
            let uri = audio_engine::uri::media_uri(&abs_path.to_string_lossy());
            if let Ok(mut child) = std::process::Command::new("dbus-send")
                .args([
                    "--session",
                    "--dest=org.freedesktop.FileManager1",
                    "--type=method_call",
                    "/org/freedesktop/FileManager1",
                    "org.freedesktop.FileManager1.ShowItems",
                    &format!("array:string:{}", uri),
                    "string:\"\"",
                ])
                .spawn()
            {
                if let Ok(status) = child.wait() {
                    if status.success() {
                        return Ok(target_dir.to_string_lossy().to_string());
                    }
                }
            }
        }

        // 3. Fallback for file managers with a --select flag (e.g. Nautilus / Nemo / Thunar)
        if abs_path.exists() && !abs_path.is_dir() {
            for fm in &["nautilus", "nemo", "thunar"] {
                if std::process::Command::new(fm)
                    .arg("--select")
                    .arg(&abs_path)
                    .spawn()
                    .map(reap_in_background)
                    .is_ok()
                {
                    return Ok(target_dir.to_string_lossy().to_string());
                }
            }
        }

        // 4. Universal fallback: xdg-open on the parent directory
        std::process::Command::new("xdg-open")
            .arg(&target_dir)
            .spawn()
            .map(reap_in_background)
            .map_err(|e| {
                CommandError::from(e).context("Failed to open the folder in the file manager")
            })?;

        Ok(target_dir.to_string_lossy().to_string())
    })
    .await?
}

#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), CommandError> {
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err(CommandError::validation(
            "Only safe URLs (http/https) are allowed",
        ));
    }
    std::process::Command::new("xdg-open")
        .arg(&url)
        .spawn()
        .map(reap_in_background)
        .map_err(|e| CommandError::from(e).context("Failed to open the link in the browser"))?;
    Ok(())
}

/// Collects the exit status of a background process so it does not stay a zombie
/// (the file manager / browser outlives the command).
fn reap_in_background(mut child: std::process::Child) {
    let _ = std::thread::Builder::new()
        .name("auralune-child-reaper".into())
        .spawn(move || {
            let _ = child.wait();
        });
}
