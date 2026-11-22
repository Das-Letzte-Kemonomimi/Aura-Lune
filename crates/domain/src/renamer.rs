use crate::DomainError;
use serde::{Deserialize, Serialize};
use std::path::{Component, Path, PathBuf};

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
        return "Unknown".to_string();
    }
    // Wartości tagów "." i ".." nie mogą stać się nawigacją po katalogach.
    if trimmed.chars().all(|c| c == '.') {
        return "_".repeat(trimmed.chars().count());
    }
    truncate_to_bytes(trimmed, MAX_TAG_PART_BYTES).to_string()
}

/// Limit długości pojedynczej wartości tagu w nazwie pliku (zostawia miejsce na numer i rozszerzenie).
const MAX_TAG_PART_BYTES: usize = 200;

/// Przycina tekst do `max` bajtów na granicy znaku UTF-8.
fn truncate_to_bytes(s: &str, max: usize) -> &str {
    if s.len() <= max {
        return s;
    }
    let mut end = max;
    while !s.is_char_boundary(end) {
        end -= 1;
    }
    s[..end].trim_end()
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

/// Maksymalna długość pojedynczego składnika ścieżki w bajtach (limit większości systemów plików).
pub const MAX_PATH_COMPONENT_BYTES: usize = 255;

/// Buduje pełną nową ścieżkę dla pliku, zachowując katalog macierzysty lub budując strukturę folderów.
///
/// Sformatowana nazwa może zawierać podfoldery (np. `%artist%/%album%/%track% - %title%`), ale
/// wynikowa ścieżka zawsze leży wewnątrz katalogu pliku źródłowego: ścieżki absolutne,
/// składniki `..` / `.` oraz składniki dłuższe niż [`MAX_PATH_COMPONENT_BYTES`] są odrzucane.
pub fn resolve_renamed_path(
    old_path_str: &str,
    formatted_name: &str,
) -> Result<PathBuf, DomainError> {
    let old_path = Path::new(old_path_str);
    let parent = old_path.parent().ok_or_else(|| {
        DomainError::Validation("Brak katalogu nadrzędnego dla pliku".to_string())
    })?;

    let relative = Path::new(formatted_name);
    if formatted_name.trim().is_empty() {
        return Err(DomainError::Validation("Pusta nazwa pliku".to_string()));
    }
    let mut new_path = parent.to_path_buf();
    for component in relative.components() {
        match component {
            Component::Normal(part) => {
                if part.len() > MAX_PATH_COMPONENT_BYTES {
                    return Err(DomainError::Validation(format!(
                        "Składnik ścieżki przekracza {} bajtów",
                        MAX_PATH_COMPONENT_BYTES
                    )));
                }
                new_path.push(part);
            }
            Component::RootDir | Component::Prefix(_) => {
                return Err(DomainError::Validation(
                    "Wzorzec nie może tworzyć ścieżki absolutnej".to_string(),
                ));
            }
            Component::ParentDir | Component::CurDir => {
                return Err(DomainError::Validation(
                    "Wzorzec nie może zawierać składników '.' ani '..'".to_string(),
                ));
            }
        }
    }
    Ok(new_path)
}

/// Sprawdza, czy docelowa ścieżka (np. przekazana z frontendu) jest dozwolonym celem zmiany
/// nazwy pliku `old_path_str`: musi leżeć wewnątrz jego katalogu i przejść walidację
/// [`resolve_renamed_path`].
pub fn validate_rename_target(
    old_path_str: &str,
    target_path_str: &str,
) -> Result<PathBuf, DomainError> {
    let parent = Path::new(old_path_str).parent().ok_or_else(|| {
        DomainError::Validation("Brak katalogu nadrzędnego dla pliku".to_string())
    })?;
    let relative = Path::new(target_path_str)
        .strip_prefix(parent)
        .map_err(|_| {
            DomainError::Validation(
                "Ścieżka docelowa musi leżeć w katalogu pliku źródłowego".to_string(),
            )
        })?;
    let relative_str = relative.to_str().ok_or_else(|| {
        DomainError::Validation("Ścieżka docelowa nie jest poprawnym UTF-8".to_string())
    })?;
    resolve_renamed_path(old_path_str, relative_str)
}
