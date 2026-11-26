use crate::DomainError;
use serde::{Deserialize, Serialize};
use std::path::{Component, Path, PathBuf};

/// Preview item for renaming a track's file.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RenamePreviewItem {
    pub track_id: i64,
    pub old_path: String,
    pub new_path: String,
    pub will_overwrite: bool,
    pub is_valid: bool,
    pub error: Option<String>,
}

/// Replaces characters that are not allowed in file and folder names with safe equivalents.
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
    // Tag values "." and ".." must not turn into directory navigation.
    if trimmed.chars().all(|c| c == '.') {
        return "_".repeat(trimmed.chars().count());
    }
    truncate_to_bytes(trimmed, MAX_TAG_PART_BYTES).to_string()
}

/// Length limit of a single tag value in a file name (leaves room for the number and extension).
const MAX_TAG_PART_BYTES: usize = 200;

/// Truncates text to `max` bytes on a UTF-8 character boundary.
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

/// Track metadata passed to the file name formatter.
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

/// Formats a track's new file name from a foobar2000-style tag pattern.
///
/// Available tags:
/// - `%artist%`: artist
/// - `%albumartist%`: album artist (or artist)
/// - `%album%`: album title
/// - `%title%`: track title
/// - `%track%` / `%tracknumber%`: track number with a leading zero (e.g. 01, 05)
/// - `%disc%`: disc number
/// - `%ext%`: file extension
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

    // If the pattern did not end with the extension, add it automatically
    if !result.to_lowercase().ends_with(&format!(".{}", clean_ext)) {
        result.push('.');
        result.push_str(&clean_ext);
    }

    result
}

/// Maximum length of a single path component in bytes (the limit of most file systems).
pub const MAX_PATH_COMPONENT_BYTES: usize = 255;

/// Builds the full new path of a file, keeping the parent directory or building a folder structure.
///
/// The formatted name may contain subfolders (e.g. `%artist%/%album%/%track% - %title%`), but
/// the resulting path always lies inside the source file's directory: absolute paths,
/// `..` / `.` components and components longer than [`MAX_PATH_COMPONENT_BYTES`] are rejected.
pub fn resolve_renamed_path(
    old_path_str: &str,
    formatted_name: &str,
) -> Result<PathBuf, DomainError> {
    let old_path = Path::new(old_path_str);
    let parent = old_path
        .parent()
        .ok_or_else(|| DomainError::Validation("The file has no parent directory".to_string()))?;

    let relative = Path::new(formatted_name);
    if formatted_name.trim().is_empty() {
        return Err(DomainError::Validation("Empty file name".to_string()));
    }
    let mut new_path = parent.to_path_buf();
    for component in relative.components() {
        match component {
            Component::Normal(part) => {
                if part.len() > MAX_PATH_COMPONENT_BYTES {
                    return Err(DomainError::Validation(format!(
                        "Path component exceeds {} bytes",
                        MAX_PATH_COMPONENT_BYTES
                    )));
                }
                new_path.push(part);
            }
            Component::RootDir | Component::Prefix(_) => {
                return Err(DomainError::Validation(
                    "The pattern must not create an absolute path".to_string(),
                ));
            }
            Component::ParentDir | Component::CurDir => {
                return Err(DomainError::Validation(
                    "The pattern must not contain '.' or '..' components".to_string(),
                ));
            }
        }
    }
    Ok(new_path)
}

/// Checks whether the target path (e.g. passed from the frontend) is an allowed rename
/// target for the file `old_path_str`: it must lie inside its directory and pass
/// [`resolve_renamed_path`] validation.
pub fn validate_rename_target(
    old_path_str: &str,
    target_path_str: &str,
) -> Result<PathBuf, DomainError> {
    let parent = Path::new(old_path_str)
        .parent()
        .ok_or_else(|| DomainError::Validation("The file has no parent directory".to_string()))?;
    let relative = Path::new(target_path_str)
        .strip_prefix(parent)
        .map_err(|_| {
            DomainError::Validation(
                "The target path must lie in the source file's directory".to_string(),
            )
        })?;
    let relative_str = relative
        .to_str()
        .ok_or_else(|| DomainError::Validation("The target path is not valid UTF-8".to_string()))?;
    resolve_renamed_path(old_path_str, relative_str)
}
