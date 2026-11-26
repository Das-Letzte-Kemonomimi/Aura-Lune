//! Song lyrics (LRC and the LRCLIB service).
//!
//! Provides:
//! - loading local .lrc files next to the track,
//! - fetching synced and plain lyrics from the open LRCLIB API,
//! - parsing [mm:ss.xx] timestamps into milliseconds.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tracing::{debug, info};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LyricLineDto {
    pub time_ms: u64,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LyricsDto {
    pub is_synced: bool,
    pub lines: Vec<LyricLineDto>,
    pub plain_lyrics: Option<String>,
    pub source: String, // "local_lrc" | "lrclib"
}

#[derive(Debug, Deserialize)]
struct LrclibResponse {
    #[serde(rename = "plainLyrics")]
    plain_lyrics: Option<String>,
    #[serde(rename = "syncedLyrics")]
    synced_lyrics: Option<String>,
    instrumental: Option<bool>,
}

/// Parses the contents of an LRC file or synced lyrics into a list of lines with milliseconds.
pub fn parse_lrc_content(content: &str) -> Vec<LyricLineDto> {
    let mut lines = Vec::new();

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        // Standard LRC: [mm:ss.xx] Tekst
        let mut rest = trimmed;
        let mut timestamps = Vec::new();

        while rest.starts_with('[') {
            if let Some(close_idx) = rest.find(']') {
                let tag = &rest[1..close_idx];
                if let Some(ms) = parse_timestamp_tag(tag) {
                    timestamps.push(ms);
                }
                rest = rest[close_idx + 1..].trim_start();
            } else {
                break;
            }
        }

        let text = rest.to_string();
        for ts in timestamps {
            lines.push(LyricLineDto {
                time_ms: ts,
                text: text.clone(),
            });
        }
    }

    lines.sort_by_key(|l| l.time_ms);
    lines
}

fn parse_timestamp_tag(tag: &str) -> Option<u64> {
    // Format mm:ss.xx or mm:ss.xxx or mm:ss:xx
    let parts: Vec<&str> = tag.split(':').collect();
    if parts.len() < 2 {
        return None;
    }

    let minutes: u64 = parts[0].parse().ok()?;
    let sec_parts: Vec<&str> = parts[1].split(&['.', ':'][..]).collect();

    let seconds: u64 = sec_parts[0].parse().ok()?;
    let millis: u64 = if sec_parts.len() > 1 {
        let frac_str = sec_parts[1];
        let digits: String = frac_str.chars().filter(|c| c.is_ascii_digit()).collect();
        if digits.len() == 1 {
            digits.parse::<u64>().ok()? * 100
        } else if digits.len() == 2 {
            digits.parse::<u64>().ok()? * 10
        } else if digits.len() >= 3 {
            digits[..3].parse::<u64>().ok()?
        } else {
            0
        }
    } else {
        0
    };

    Some(minutes * 60_000 + seconds * 1_000 + millis)
}

/// Tries to find a local .lrc file next to the audio track.
pub fn find_local_lrc(track_path: &str) -> Option<LyricsDto> {
    let path = Path::new(track_path);
    let lrc_path = path.with_extension("lrc");

    if lrc_path.exists() && lrc_path.is_file() {
        if let Ok(content) = fs::read_to_string(&lrc_path) {
            let lines = parse_lrc_content(&content);
            if !lines.is_empty() {
                info!("Loaded local LRC lyrics file: {:?}", lrc_path);
                return Some(LyricsDto {
                    is_synced: true,
                    lines,
                    plain_lyrics: None,
                    source: "local_lrc".to_string(),
                });
            }
        }
    }

    None
}

/// Fetches song lyrics (looks for a local .lrc file first, then the LRCLIB API).
pub async fn fetch_lyrics_online_or_local(
    track_path: Option<&str>,
    title: &str,
    artist: &str,
    album: Option<&str>,
    duration_sec: Option<f64>,
) -> Option<LyricsDto> {
    // 1. Check the local .lrc file if a path was given
    if let Some(path) = track_path {
        let clean_path = path.strip_prefix("file://").unwrap_or(path);
        if let Some(local_lrc) = find_local_lrc(clean_path) {
            return Some(local_lrc);
        }
    }

    // 2. Fetch from the free and open LRCLIB API
    // One client for the whole process (connection pool) instead of a new one per track.
    static CLIENT: std::sync::OnceLock<reqwest::Client> = std::sync::OnceLock::new();
    let client =
        CLIENT.get_or_init(|| crate::http::build_client(std::time::Duration::from_secs(4)));

    let mut query = vec![
        ("track_name", title.to_string()),
        ("artist_name", artist.to_string()),
    ];

    if let Some(alb) = album {
        if !alb.is_empty() {
            query.push(("album_name", alb.to_string()));
        }
    }

    let dur_str;
    if let Some(dur) = duration_sec {
        if dur > 0.0 {
            dur_str = (dur.round() as u64).to_string();
            query.push(("duration", dur_str));
        }
    }

    debug!("Zapytanie o teksty LRCLIB: {:?}", query);

    let res = client
        .get("https://lrclib.net/api/get")
        .query(&query)
        .send()
        .await
        .ok()?;
    if !res.status().is_success() {
        return None;
    }

    let lrclib: LrclibResponse = res.json().await.ok()?;

    if lrclib.instrumental == Some(true) {
        return Some(LyricsDto {
            is_synced: false,
            lines: Vec::new(),
            plain_lyrics: Some("♪ Instrumental (no lyrics) ♪".to_string()),
            source: "lrclib".to_string(),
        });
    }

    if let Some(synced) = lrclib.synced_lyrics {
        let parsed_lines = parse_lrc_content(&synced);
        if !parsed_lines.is_empty() {
            return Some(LyricsDto {
                is_synced: true,
                lines: parsed_lines,
                plain_lyrics: lrclib.plain_lyrics,
                source: "lrclib".to_string(),
            });
        }
    }

    if let Some(plain) = lrclib.plain_lyrics {
        return Some(LyricsDto {
            is_synced: false,
            lines: Vec::new(),
            plain_lyrics: Some(plain),
            source: "lrclib".to_string(),
        });
    }

    None
}
