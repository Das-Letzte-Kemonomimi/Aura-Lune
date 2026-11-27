//! Song lyrics (LRC and the LRCLIB service).
//!
//! Provides:
//! - loading local .lrc files next to the track,
//! - fetching synced and plain lyrics from the open LRCLIB API,
//! - parsing [mm:ss.xx] timestamps into milliseconds.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::fs;
use std::path::Path;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};
use tracing::{debug, info};

const LYRICS_CACHE_CAPACITY: usize = 256;
const LYRICS_NEGATIVE_TTL: Duration = Duration::from_secs(3600);

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
struct LyricsCacheKey {
    artist: String,
    title: String,
    album: Option<String>,
    duration_sec: Option<u64>,
}

impl LyricsCacheKey {
    fn new(artist: &str, title: &str, album: Option<&str>, duration_sec: Option<f64>) -> Self {
        Self {
            artist: artist.trim().to_ascii_lowercase(),
            title: title.trim().to_ascii_lowercase(),
            album: album
                .map(|a| a.trim().to_ascii_lowercase())
                .filter(|a| !a.is_empty()),
            duration_sec: duration_sec
                .filter(|d| *d > 0.0 && d.is_finite())
                .map(|d| d.round() as u64),
        }
    }
}

#[derive(Debug, Clone)]
enum CachedLyrics {
    Hit(LyricsDto),
    NegativeMiss { cached_at: Instant },
}

#[derive(Default)]
struct LyricsLruCache {
    entries: HashMap<LyricsCacheKey, CachedLyrics>,
    order: VecDeque<LyricsCacheKey>,
}

impl LyricsLruCache {
    fn touch(&mut self, key: &LyricsCacheKey) {
        if let Some(pos) = self.order.iter().position(|k| k == key) {
            self.order.remove(pos);
        }
        self.order.push_back(key.clone());
    }

    fn get(&mut self, key: &LyricsCacheKey, now: Instant) -> Option<Option<LyricsDto>> {
        enum Lookup {
            Hit(LyricsDto),
            MissValid,
            Expired,
            Absent,
        }

        let state = match self.entries.get(key) {
            Some(CachedLyrics::Hit(dto)) => Lookup::Hit(dto.clone()),
            Some(CachedLyrics::NegativeMiss { cached_at }) => {
                if now.saturating_duration_since(*cached_at) < LYRICS_NEGATIVE_TTL {
                    Lookup::MissValid
                } else {
                    Lookup::Expired
                }
            }
            None => Lookup::Absent,
        };

        match state {
            Lookup::Hit(dto) => {
                self.touch(key);
                Some(Some(dto))
            }
            Lookup::MissValid => {
                self.touch(key);
                Some(None)
            }
            Lookup::Expired => {
                self.entries.remove(key);
                if let Some(pos) = self.order.iter().position(|k| k == key) {
                    self.order.remove(pos);
                }
                None
            }
            Lookup::Absent => None,
        }
    }

    fn insert(&mut self, key: LyricsCacheKey, val: CachedLyrics) {
        if self.entries.contains_key(&key) {
            self.entries.insert(key.clone(), val);
            self.touch(&key);
            return;
        }
        while self.entries.len() >= LYRICS_CACHE_CAPACITY {
            if let Some(oldest) = self.order.pop_front() {
                self.entries.remove(&oldest);
            } else {
                break;
            }
        }
        self.order.push_back(key.clone());
        self.entries.insert(key, val);
    }
}

fn lyrics_cache() -> &'static Mutex<LyricsLruCache> {
    static CACHE: OnceLock<Mutex<LyricsLruCache>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(LyricsLruCache::default()))
}

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

    // 2. Check the bounded online LRU cache before hitting LRCLIB
    let cache_key = LyricsCacheKey::new(artist, title, album, duration_sec);
    if let Ok(mut guard) = lyrics_cache().lock() {
        if let Some(cached) = guard.get(&cache_key, Instant::now()) {
            return cached;
        }
    }

    // 3. Fetch from the free and open LRCLIB API
    // One client for the whole process (connection pool) instead of a new one per track.
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    let client = CLIENT.get_or_init(|| crate::http::build_client(Duration::from_secs(4)));

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

    debug!("Querying LRCLIB lyrics: {:?}", query);

    let res = client
        .get("https://lrclib.net/api/get")
        .query(&query)
        .send()
        .await
        .ok()?;
    let status = res.status();
    if status == reqwest::StatusCode::NOT_FOUND {
        if let Ok(mut guard) = lyrics_cache().lock() {
            guard.insert(
                cache_key,
                CachedLyrics::NegativeMiss {
                    cached_at: Instant::now(),
                },
            );
        }
        return None;
    }
    if !status.is_success() {
        return None;
    }

    let lrclib: LrclibResponse = res.json().await.ok()?;

    let fetched = if lrclib.instrumental == Some(true) {
        Some(LyricsDto {
            is_synced: false,
            lines: Vec::new(),
            plain_lyrics: Some("♪ Instrumental (no lyrics) ♪".to_string()),
            source: "lrclib".to_string(),
        })
    } else if let Some(synced) = lrclib.synced_lyrics {
        let parsed_lines = parse_lrc_content(&synced);
        if !parsed_lines.is_empty() {
            Some(LyricsDto {
                is_synced: true,
                lines: parsed_lines,
                plain_lyrics: lrclib.plain_lyrics,
                source: "lrclib".to_string(),
            })
        } else {
            lrclib.plain_lyrics.map(|plain| LyricsDto {
                is_synced: false,
                lines: Vec::new(),
                plain_lyrics: Some(plain),
                source: "lrclib".to_string(),
            })
        }
    } else {
        lrclib.plain_lyrics.map(|plain| LyricsDto {
            is_synced: false,
            lines: Vec::new(),
            plain_lyrics: Some(plain),
            source: "lrclib".to_string(),
        })
    };

    if let Ok(mut guard) = lyrics_cache().lock() {
        let entry = match &fetched {
            Some(dto) => CachedLyrics::Hit(dto.clone()),
            None => CachedLyrics::NegativeMiss {
                cached_at: Instant::now(),
            },
        };
        guard.insert(cache_key, entry);
    }

    fetched
}

#[cfg(test)]
#[path = "lyrics_test.rs"]
mod tests;
