use crate::DomainError;
use serde::{Deserialize, Serialize};
use std::path::Path;

/// A single track entry in an M3U/M3U8 file.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct M3uEntry {
    /// Path to a local file or a URI (e.g. file:// or http(s)://)
    pub path_or_uri: String,
    /// Optional track title from the #EXTINF directive
    pub title: Option<String>,
    /// Optional artist from the #EXTINF directive
    pub artist: Option<String>,
    /// Duration in seconds (-1 if unknown / a stream)
    pub duration_seconds: Option<i64>,
}

/// A parsed M3U/M3U8 playlist.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct M3uPlaylist {
    pub name: String,
    pub entries: Vec<M3uEntry>,
}

/// Result of importing an M3U/M3U8 playlist into the Auralune database.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ImportM3uResult {
    pub playlist_id: i64,
    pub playlist_name: String,
    pub total_entries: usize,
    pub matched_tracks: usize,
    pub missing_tracks: Vec<String>,
}

impl M3uPlaylist {
    /// Parses the contents of a UTF-8 `.m3u` or `.m3u8` file.
    /// If `base_dir` is given, relative paths are resolved against that directory.
    pub fn parse(
        content: &str,
        playlist_name: &str,
        base_dir: Option<&Path>,
    ) -> Result<Self, DomainError> {
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

                    // Try to split into "Artist - Title"
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

            // Ignore other header directives and comments starting with #
            if line.starts_with('#') {
                continue;
            }

            // Normalise Windows path separators (\ -> /) for Linux compatibility
            let normalized_path = line.replace('\\', "/");

            let resolved_path = if normalized_path.starts_with("file://")
                || normalized_path.starts_with("http://")
                || normalized_path.starts_with("https://")
                || normalized_path.starts_with('/')
            {
                normalized_path
            } else if let Some(dir) = base_dir {
                let joined = dir.join(&normalized_path);
                // Canonicalise or simplify the path
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

    /// Exports the playlist entries in the `#EXTM3U` format (UTF-8 M3U8).
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

/// Simplifies and normalises a system path (removes redundant . and ..).
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

/// Computes the path of `target_path` relative to `base_dir`.
fn compute_relative_path(target_path: &str, base_dir: &Path) -> String {
    // If the target is a URI (e.g. http:// or file://), leave it unchanged
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
