use serde::{Deserialize, Serialize};
use std::path::Path;

/// Reprezentacja pojedynczego wpisu utworu w pliku M3U/M3U8.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct M3uEntry {
    /// Ścieżka do pliku lokalnego lub adres URI (np. file:// lub http(s)://)
    pub path_or_uri: String,
    /// Opcjonalny tytuł utworu z dyrektywy #EXTINF
    pub title: Option<String>,
    /// Opcjonalny wykonawca z dyrektywy #EXTINF
    pub artist: Option<String>,
    /// Czas trwania w sekundach (-1 jeśli nieznany/strumień)
    pub duration_seconds: Option<i64>,
}

/// Reprezentacja sparsowanej playlisty M3U/M3U8.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct M3uPlaylist {
    pub name: String,
    pub entries: Vec<M3uEntry>,
}

/// Wynik operacji importu playlisty M3U/M3U8 do bazy danych Auralune.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ImportM3uResult {
    pub playlist_id: i64,
    pub playlist_name: String,
    pub total_entries: usize,
    pub matched_tracks: usize,
    pub missing_tracks: Vec<String>,
}

impl M3uPlaylist {
    /// Parsuje zawartość pliku `.m3u` lub `.m3u8` w standardzie UTF-8.
    /// Jeśli podano `base_dir`, ścieżki względne są automatycznie rozwiązywane względem tego katalogu.
    pub fn parse(
        content: &str,
        playlist_name: &str,
        base_dir: Option<&Path>,
    ) -> Result<Self, String> {
        let mut entries = Vec::new();
        let mut pending_duration: Option<i64> = None;
        let mut pending_artist: Option<String> = None;
        let mut pending_title: Option<String> = None;

        for raw_line in content.lines() {
            let line = raw_line.trim();
            if line.is_empty() {
                continue;
            }

            if let Some(info_content) = line.strip_prefix("#EXTINF:") {
                if let Some(comma_idx) = info_content.find(',') {
                    let dur_part = info_content[..comma_idx].trim();
                    let title_part = info_content[comma_idx + 1..].trim();

                    if let Ok(dur) = dur_part.parse::<i64>() {
                        pending_duration = Some(dur);
                    }

                    // Próba podziału na "Wykonawca - Tytuł"
                    if let Some(dash_idx) = title_part.find(" - ") {
                        let artist = title_part[..dash_idx].trim().to_string();
                        let title = title_part[dash_idx + 3..].trim().to_string();
                        pending_artist = if !artist.is_empty() {
                            Some(artist)
                        } else {
                            None
                        };
                        pending_title = if !title.is_empty() { Some(title) } else { None };
                    } else if !title_part.is_empty() {
                        pending_title = Some(title_part.to_string());
                    }
                }
                continue;
            }

            // Ignorujemy inne dyrektywy nagłówka lub komentarze rozpoczynające się od #
            if line.starts_with('#') {
                continue;
            }

            // Normalizacja separatorów ścieżek z Windows (\ -> /) dla zgodności z Linuksem
            let normalized_path = line.replace('\\', "/");

            let resolved_path = if normalized_path.starts_with("file://")
                || normalized_path.starts_with("http://")
                || normalized_path.starts_with("https://")
                || normalized_path.starts_with('/')
            {
                normalized_path
            } else if let Some(dir) = base_dir {
                let joined = dir.join(&normalized_path);
                // Rozwijamy canonical lub upraszczamy ścieżkę
                normalize_path(&joined)
            } else {
                normalized_path
            };

            entries.push(M3uEntry {
                path_or_uri: resolved_path,
                title: pending_title.take(),
                artist: pending_artist.take(),
                duration_seconds: pending_duration.take(),
            });
        }

        Ok(M3uPlaylist {
            name: playlist_name.to_string(),
            entries,
        })
    }

    /// Eksportuje listę wpisów playlisty do standardu `#EXTM3U` (M3U8 UTF-8).
    pub fn export_to_m3u8(
        playlist_name: &str,
        entries: &[M3uEntry],
        base_dir: Option<&Path>,
        use_relative_paths: bool,
    ) -> String {
        let mut out = String::from("#EXTM3U\n");
        out.push_str(&format!("#PLAYLIST:{}\n\n", playlist_name));

        for entry in entries {
            let dur = entry.duration_seconds.unwrap_or(-1);
            let title = entry.title.as_deref().unwrap_or("Unknown Title");
            let artist = entry.artist.as_deref().unwrap_or("Unknown Artist");

            out.push_str(&format!("#EXTINF:{},{} - {}\n", dur, artist, title));

            let path_to_write = if use_relative_paths {
                if let Some(base) = base_dir {
                    compute_relative_path(&entry.path_or_uri, base)
                } else {
                    entry.path_or_uri.clone()
                }
            } else {
                entry.path_or_uri.clone()
            };

            out.push_str(&path_to_write);
            out.push('\n');
        }

        out
    }
}

/// Upraszcza i normalizuje ścieżkę systemową (usuwa zbędne . i ..).
fn normalize_path(path: &Path) -> String {
    let mut components = Vec::new();
    let is_abs = path.is_absolute();

    for comp in path.components() {
        match comp {
            std::path::Component::CurDir | std::path::Component::RootDir => {}
            std::path::Component::ParentDir => {
                if !components.is_empty() {
                    components.pop();
                }
            }
            c => components.push(c.as_os_str().to_string_lossy().to_string()),
        }
    }

    if components.is_empty() {
        return if is_abs {
            "/".to_string()
        } else {
            ".".to_string()
        };
    }

    let joined = components.join("/");
    if is_abs {
        format!("/{}", joined)
    } else {
        joined
    }
}

/// Oblicza ścieżkę względną od `base_dir` do `target_path`.
fn compute_relative_path(target_path: &str, base_dir: &Path) -> String {
    // Jeżeli target jest URI (np. http:// lub file://), nie zmieniamy go
    if target_path.starts_with("http://") || target_path.starts_with("https://") {
        return target_path.to_string();
    }

    let clean_path = if let Some(stripped) = target_path.strip_prefix("file://") {
        stripped
    } else {
        target_path
    };

    let target = Path::new(clean_path);
    if let Ok(rel) = target.strip_prefix(base_dir) {
        rel.to_string_lossy().to_string()
    } else {
        clean_path.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn test_parse_m3u_simple_absolute() {
        let content = r#"#EXTM3U
#EXTINF:215,Das Letzte Kemonomimi - Skrzydła Białe
/home/mimi/Music/skrzydla_biale.flac
#EXTINF:180,Artist Name - Song Title
/home/mimi/Music/song2.mp3
"#;
        let playlist = M3uPlaylist::parse(content, "Test List", None).unwrap();
        assert_eq!(playlist.name, "Test List");
        assert_eq!(playlist.entries.len(), 2);

        assert_eq!(playlist.entries[0].title.as_deref(), Some("Skrzydła Białe"));
        assert_eq!(
            playlist.entries[0].artist.as_deref(),
            Some("Das Letzte Kemonomimi")
        );
        assert_eq!(playlist.entries[0].duration_seconds, Some(215));
        assert_eq!(
            playlist.entries[0].path_or_uri,
            "/home/mimi/Music/skrzydla_biale.flac"
        );

        assert_eq!(playlist.entries[1].title.as_deref(), Some("Song Title"));
        assert_eq!(playlist.entries[1].artist.as_deref(), Some("Artist Name"));
        assert_eq!(playlist.entries[1].duration_seconds, Some(180));
    }

    #[test]
    fn test_parse_m3u_with_relative_and_windows_slashes() {
        let content = r#"#EXTM3U
#EXTINF:120,Anime Artist - Open The Door
SubFolder\track1.flac
#EXTINF:-1,Stream Radio
https://stream.example.com/radio.opus
"#;
        let base_dir = Path::new("/home/mimi/Music");
        let playlist = M3uPlaylist::parse(content, "Relative Playlist", Some(base_dir)).unwrap();
        assert_eq!(playlist.entries.len(), 2);
        assert_eq!(
            playlist.entries[0].path_or_uri,
            "/home/mimi/Music/SubFolder/track1.flac"
        );
        assert_eq!(
            playlist.entries[1].path_or_uri,
            "https://stream.example.com/radio.opus"
        );
    }

    #[test]
    fn test_export_to_m3u8() {
        let entries = vec![
            M3uEntry {
                path_or_uri: "/home/mimi/Music/track1.flac".to_string(),
                title: Some("Song One".to_string()),
                artist: Some("Artist One".to_string()),
                duration_seconds: Some(200),
            },
            M3uEntry {
                path_or_uri: "/home/mimi/Music/track2.flac".to_string(),
                title: None,
                artist: None,
                duration_seconds: None,
            },
        ];

        let base_dir = Path::new("/home/mimi/Music");
        let exported = M3uPlaylist::export_to_m3u8("My Anime List", &entries, Some(base_dir), true);

        assert!(exported.starts_with("#EXTM3U\n"));
        assert!(exported.contains("#PLAYLIST:My Anime List\n"));
        assert!(exported.contains("#EXTINF:200,Artist One - Song One\n"));
        assert!(exported.contains("track1.flac\n"));
        assert!(exported.contains("track2.flac\n"));
    }
}
