use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// Element podglądu zmiany nazwy pliku utworu.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RenamePreviewItem {
    pub track_id: i64,
    pub old_path: String,
    pub new_path: String,
    pub will_overwrite: bool,
    pub is_valid: bool,
    pub error: Option<String>,
}

/// Zastępuje niedozwolone znaki w nazwach plików i folderów bezpiecznymi odpowiednikami.
pub fn sanitize_filename_part(input: &str) -> String {
    let forbidden = ['/', '\\', ':', '*', '?', '"', '<', '>', '|'];
    let mut out = String::with_capacity(input.len());
    for ch in input.chars() {
        if forbidden.contains(&ch) || ch.is_control() {
            out.push('_');
        } else {
            out.push(ch);
        }
    }
    let trimmed = out.trim();
    if trimmed.is_empty() {
        "Unknown".to_string()
    } else {
        trimmed.to_string()
    }
}

/// Formatuje nową nazwę pliku utworu wg zadanego schematu tagów w stylu foobar2000.
/// Dane metadanych utworu przekazywane do formatera nazw plików.
#[derive(Debug, Clone, Default)]
pub struct RenamerTrackInfo<'a> {
    pub title: &'a str,
    pub artist: &'a str,
    pub album_artist: Option<&'a str>,
    pub album: Option<&'a str>,
    pub track_no: Option<i64>,
    pub disc_no: Option<i64>,
    pub ext: &'a str,
}

/// Formatuje nową nazwę pliku utworu wg zadanego schematu tagów w stylu foobar2000.
///
/// Dostępne tagi:
/// - `%artist%`: Wykonawca
/// - `%albumartist%`: Wykonawca albumu (lub wykonawca)
/// - `%album%`: Tytuł albumu
/// - `%title%`: Tytuł utworu
/// - `%track%` / `%tracknumber%`: Numer utworu z zerem wiodącym (np. 01, 05)
/// - `%disc%`: Numer płyty
/// - `%ext%`: Rozszerzenie pliku
pub fn format_pattern_for_track(pattern: &str, info: &RenamerTrackInfo) -> String {
    let clean_title = sanitize_filename_part(info.title);
    let clean_artist = sanitize_filename_part(info.artist);
    let clean_album_artist = sanitize_filename_part(info.album_artist.unwrap_or(info.artist));
    let clean_album = sanitize_filename_part(info.album.unwrap_or("Unknown Album"));
    let clean_ext = info.ext.trim_start_matches('.').to_lowercase();

    let track_str = match info.track_no {
        Some(no) if no > 0 => format!("{:02}", no),
        _ => "00".to_string(),
    };
    let disc_str = match info.disc_no {
        Some(no) if no > 0 => format!("{}", no),
        _ => "1".to_string(),
    };

    let mut result = pattern.to_string();
    result = result.replace("%artist%", &clean_artist);
    result = result.replace("%albumartist%", &clean_album_artist);
    result = result.replace("%album%", &clean_album);
    result = result.replace("%title%", &clean_title);
    result = result.replace("%tracknumber%", &track_str);
    result = result.replace("%track%", &track_str);
    result = result.replace("%disc%", &disc_str);
    result = result.replace("%ext%", &clean_ext);

    // Jeśli wzorzec nie zawierał rozszerzenia na końcu, dodajemy je automatycznie
    if !result.to_lowercase().ends_with(&format!(".{}", clean_ext)) {
        result.push('.');
        result.push_str(&clean_ext);
    }

    result
}

/// Buduje pełną nową ścieżkę dla pliku, zachowując katalog macierzysty lub budując strukturę folderów.
pub fn resolve_renamed_path(old_path_str: &str, formatted_name: &str) -> Result<PathBuf, String> {
    let old_path = Path::new(old_path_str);
    let parent = old_path
        .parent()
        .ok_or_else(|| "Brak katalogu nadrzędnego dla pliku".to_string())?;

    // Jeśli sformatowana nazwa zawiera podfoldery (np. %artist%/%album%/%track% - %title%.flac)
    let new_path = parent.join(formatted_name);
    Ok(new_path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_filename() {
        assert_eq!(sanitize_filename_part("AC/DC: Live?"), "AC_DC_ Live_");
        assert_eq!(sanitize_filename_part("   "), "Unknown");
        assert_eq!(sanitize_filename_part("YOASOBI"), "YOASOBI");
    }

    #[test]
    fn test_format_pattern_for_track() {
        let pattern = "%track% - %artist% - %title%";
        let info = RenamerTrackInfo {
            title: "Sparkle",
            artist: "RADWIMPS",
            album_artist: Some("RADWIMPS"),
            album: Some("Your Name."),
            track_no: Some(8),
            disc_no: Some(1),
            ext: "flac",
        };
        let res = format_pattern_for_track(pattern, &info);
        assert_eq!(res, "08 - RADWIMPS - Sparkle.flac");
    }

    #[test]
    fn test_format_pattern_with_extension_already() {
        let pattern = "%artist% - %title%.%ext%";
        let info = RenamerTrackInfo {
            title: "Idol",
            artist: "YOASOBI",
            album_artist: None,
            album: None,
            track_no: Some(1),
            disc_no: None,
            ext: "mp3",
        };
        let res = format_pattern_for_track(pattern, &info);
        assert_eq!(res, "YOASOBI - Idol.mp3");
    }
}
