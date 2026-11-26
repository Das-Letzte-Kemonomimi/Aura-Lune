//! MusicBrainz and Cover Art Archive metadata integration.
//!
//! Per ADR 0007 and AGENTS.md:
//! - releases are identified by MBID,
//! - an explicit User-Agent with the version and project address (`http::USER_AGENT`),
//! - request rate limiting (1 req/s to the MusicBrainz server),
//! - release candidates are returned for confirmation when the match is ambiguous,
//! - covers are downloaded from Cover Art Archive and cached locally.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use thiserror::Error;
use tokio::sync::Mutex;
use tracing::{debug, info, warn};

pub mod acoustid;
pub mod http;
pub mod lastfm;
pub mod listenbrainz;
pub mod lyrics;
pub mod net_guard;
pub use acoustid::*;
pub use lastfm::*;
pub use listenbrainz::*;
pub use lyrics::*;

#[derive(Debug, Error)]
pub enum MetadataError {
    #[error("HTTP network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("JSON parse error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("No cover found for release MBID: {0}")]
    CoverNotFound(String),
    #[error("MusicBrainz query error: {0}")]
    Query(String),
    #[error("AcoustID / Chromaprint error: {0}")]
    AcoustId(String),
}

/// Scrobbling client errors (Last.fm, ListenBrainz).
#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum ScrobbleError {
    /// Missing or empty input (token, session key).
    #[error("{0}")]
    Validation(String),
    /// No connection / HTTP transport error.
    #[error("{0}")]
    Network(String),
    /// Unexpected response format.
    #[error("{0}")]
    Parse(String),
    /// The service answered with an error (HTTP status, invalid token, rejected scrobble).
    #[error("{0}")]
    Service(String),
}

/// A MusicBrainz release candidate.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ReleaseCandidateDto {
    pub mbid: String,
    pub title: String,
    pub artist: String,
    pub date: Option<String>,
    pub country: Option<String>,
    pub track_count: Option<usize>,
    pub score: u32,
}

/// A cover candidate to pick in the dialog (in the style of the Poweramp Cover Art Picker).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CoverCandidateDto {
    pub source: String,
    pub title: String,
    pub artist: String,
    pub thumbnail_url: String,
    pub full_url: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

/// MusicBrainz API client.
pub struct MusicBrainzClient {
    http: reqwest::Client,
    limiter: Arc<http::RateLimiter>,
}

impl Default for MusicBrainzClient {
    fn default() -> Self {
        Self::new()
    }
}

impl MusicBrainzClient {
    pub fn new() -> Self {
        Self {
            http: http::build_client(Duration::from_secs(10)),
            // MusicBrainz: at most 1 request per second.
            limiter: Arc::new(http::RateLimiter::new(Duration::from_millis(1050))),
        }
    }

    /// Enforces the limit of 1 request per second (MusicBrainz rate limit).
    async fn wait_rate_limit(&self) {
        self.limiter.wait().await;
    }

    /// Searches releases by album title and artist.
    pub async fn search_releases(
        &self,
        album: &str,
        artist: &str,
    ) -> Result<Vec<ReleaseCandidateDto>, MetadataError> {
        self.wait_rate_limit().await;

        let clean_album = album.replace('"', "");
        let clean_artist = artist.replace('"', "");

        let query = format!(
            "release:\"{}\" AND artist:\"{}\"",
            clean_album, clean_artist
        );

        let url = format!(
            "https://musicbrainz.org/ws/2/release/?query={}&fmt=json&limit=10",
            urlencoding::encode(&query)
        );

        debug!("MusicBrainz API search: {}", url);

        let resp =
            http::send_with_retry(self.http.get(&url).header("Accept", "application/json")).await?;

        if !resp.status().is_success() {
            return Err(MetadataError::Query(format!(
                "MusicBrainz server returned HTTP status: {}",
                resp.status()
            )));
        }

        let body: serde_json::Value = resp.json().await?;
        Ok(Self::parse_release_candidates(&body))
    }

    /// Parses the MusicBrainz JSON response into a list of candidates.
    pub fn parse_release_candidates(json: &serde_json::Value) -> Vec<ReleaseCandidateDto> {
        let mut candidates = Vec::new();
        if let Some(releases) = json.get("releases").and_then(|r| r.as_array()) {
            for r in releases {
                let mbid = match r.get("id").and_then(|id| id.as_str()) {
                    Some(id) => id.to_string(),
                    None => continue,
                };
                let title = r
                    .get("title")
                    .and_then(|t| t.as_str())
                    .unwrap_or("Unknown Album")
                    .to_string();

                let artist = r
                    .get("artist-credit")
                    .and_then(|ac| ac.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|obj| obj.get("name"))
                    .and_then(|n| n.as_str())
                    .unwrap_or("Unknown Artist")
                    .to_string();

                let date = r
                    .get("date")
                    .and_then(|d| d.as_str())
                    .map(|s| s.to_string());
                let country = r
                    .get("country")
                    .and_then(|c| c.as_str())
                    .map(|s| s.to_string());
                let track_count = r
                    .get("track-count")
                    .and_then(|tc| tc.as_u64())
                    .map(|n| n as usize);
                let score = r.get("score").and_then(|s| s.as_u64()).unwrap_or(0) as u32;

                candidates.push(ReleaseCandidateDto {
                    mbid,
                    title,
                    artist,
                    date,
                    country,
                    track_count,
                    score,
                });
            }
        }
        candidates.sort_by_key(|a| std::cmp::Reverse(a.score));
        candidates
    }
}

/// Cleans an album title of extra noise (brackets, remaster notes, special editions, discs),
/// so music services (Deezer, Apple Music, MusicBrainz) can find the original release precisely.
pub fn clean_album_title(title: &str) -> String {
    // 1. Remove the contents of round (), square [] and curly {} brackets
    let mut cleaned = String::new();
    let mut depth = 0;
    for c in title.chars() {
        match c {
            '(' | '[' | '{' => depth += 1,
            ')' | ']' | '}' => {
                if depth > 0 {
                    depth -= 1;
                }
            }
            _ if depth == 0 => cleaned.push(c),
            _ => {}
        }
    }

    // 2. Remove common noise keywords in case they were not in brackets. Matching is by
    //    whole words (case-insensitive): "Ghost" and "Lost" do not lose "ost",
    //    and characters whose lowercase form has a different length (e.g. "İ") do not break the indexes.
    const NOISE_PATTERNS: &[&[&str]] = &[
        &["remastered"],
        &["remaster"],
        &["deluxe", "edition"],
        &["deluxe"],
        &["special", "edition"],
        &["anniversary", "edition"],
        &["expanded", "edition"],
        &["bonus", "tracks"],
        &["bonus", "track"],
        &["original", "soundtrack"],
        &["soundtrack"],
        &["ost"],
        &["disc", "1"],
        &["disc", "2"],
        &["disc", "3"],
        &["cd", "1"],
        &["cd", "2"],
        &["cd", "3"],
        &["cd1"],
        &["cd2"],
    ];

    let mut words: Vec<&str> = cleaned.split_whitespace().collect();
    let normalized = |w: &str| {
        w.trim_matches(|c: char| !c.is_alphanumeric())
            .to_lowercase()
    };
    for pat in NOISE_PATTERNS {
        let mut i = 0;
        while i + pat.len() <= words.len() {
            let matches = words[i..i + pat.len()]
                .iter()
                .zip(pat.iter())
                .all(|(w, p)| normalized(w) == *p);
            if matches {
                words.drain(i..i + pat.len());
            } else {
                i += 1;
            }
        }
    }

    let final_str = words.join(" ");

    if final_str.is_empty() {
        title.trim().to_string()
    } else {
        final_str
    }
}

/// Cleans an artist name of brackets and noise.
pub fn clean_artist_name(artist: &str) -> String {
    let mut cleaned = String::new();
    let mut depth = 0;
    for c in artist.chars() {
        match c {
            '(' | '[' | '{' => depth += 1,
            ')' | ']' | '}' => {
                if depth > 0 {
                    depth -= 1;
                }
            }
            _ if depth == 0 => cleaned.push(c),
            _ => {}
        }
    }
    let words: Vec<&str> = cleaned.split_whitespace().collect();
    let final_str = words.join(" ");
    if final_str.is_empty() {
        artist.trim().to_string()
    } else {
        final_str
    }
}

/// Cover Art Archive client that downloads and caches covers locally.
pub struct CoverArtArchiveClient {
    http: reqwest::Client,
    cache_dir: PathBuf,
    search_cache: Arc<Mutex<std::collections::HashMap<String, Vec<CoverCandidateDto>>>>,
}

impl CoverArtArchiveClient {
    pub fn new(cache_dir: impl AsRef<Path>) -> Self {
        let http = http::build_client(Duration::from_secs(15));

        Self {
            http,
            cache_dir: cache_dir.as_ref().to_path_buf(),
            search_cache: Arc::new(Mutex::new(std::collections::HashMap::new())),
        }
    }

    /// Downloads the cover (500px front thumbnail) for the given MBID and stores it in the cache.
    /// If the cover is already cached, returns the existing path immediately.
    pub async fn fetch_and_cache_cover(&self, mbid: &str) -> Result<PathBuf, MetadataError> {
        ensure_safe_token(mbid)?;
        let covers_dir = self.cache_dir.join("covers");
        tokio::fs::create_dir_all(&covers_dir).await?;

        let cached_file = covers_dir.join(format!("{}.jpg", mbid));
        if cached_file.exists() {
            debug!("Cover Art Cache Hit: {:?}", cached_file);
            return Ok(cached_file);
        }

        // Download the 500px thumbnail or the front cover
        let url = format!("https://coverartarchive.org/release/{}/front-500", mbid);
        info!("Downloading cover from Cover Art Archive: {}", url);

        let resp = self.http.get(&url).send().await?;

        if !resp.status().is_success() {
            warn!(
                "No cover in Cover Art Archive (HTTP {}) for MBID: {}",
                resp.status(),
                mbid
            );
            return Err(MetadataError::CoverNotFound(mbid.to_string()));
        }

        let bytes = read_image_body(resp).await?;
        if bytes.is_empty() {
            return Err(MetadataError::CoverNotFound(mbid.to_string()));
        }

        // Write to a temp file and rename atomically
        let temp_file = covers_dir.join(format!("{}.tmp", mbid));
        tokio::fs::write(&temp_file, &bytes).await?;
        tokio::fs::rename(&temp_file, &cached_file).await?;

        info!("Cover stored in the cache: {:?}", cached_file);
        Ok(cached_file)
    }

    async fn query_deezer(
        &self,
        url: &str,
        default_album: &str,
        default_artist: &str,
    ) -> Vec<CoverCandidateDto> {
        debug!("Searching Deezer covers: {}", url);
        let req = self.http.get(url).send();

        let resp = match tokio::time::timeout(Duration::from_millis(3500), req).await {
            Ok(Ok(r)) => r,
            _ => return Vec::new(),
        };

        if !resp.status().is_success() {
            return Vec::new();
        }

        let json = match resp.json::<serde_json::Value>().await {
            Ok(j) => j,
            Err(_) => return Vec::new(),
        };

        let mut results = Vec::new();
        if let Some(data) = json.get("data").and_then(|d| d.as_array()) {
            for item in data {
                let title = item
                    .get("title")
                    .and_then(|t| t.as_str())
                    .unwrap_or(default_album)
                    .to_string();
                let artist_name = item
                    .get("artist")
                    .and_then(|a| a.get("name"))
                    .and_then(|n| n.as_str())
                    .unwrap_or(default_artist)
                    .to_string();
                let cover_xl = item.get("cover_xl").and_then(|c| c.as_str());
                let cover_big = item.get("cover_big").and_then(|c| c.as_str());
                let cover_med = item.get("cover_medium").and_then(|c| c.as_str());

                if let Some(full) = cover_xl.or(cover_big) {
                    let thumb = cover_med.unwrap_or(full);
                    results.push(CoverCandidateDto {
                        source: "Deezer (1000px)".to_string(),
                        title,
                        artist: artist_name,
                        thumbnail_url: thumb.to_string(),
                        full_url: full.to_string(),
                        width: Some(1000),
                        height: Some(1000),
                    });
                }
            }
        }
        results
    }

    async fn query_itunes(
        &self,
        url: &str,
        default_album: &str,
        default_artist: &str,
    ) -> Vec<CoverCandidateDto> {
        debug!("Searching iTunes covers: {}", url);
        let req = self.http.get(url).send();

        let resp = match tokio::time::timeout(Duration::from_millis(3500), req).await {
            Ok(Ok(r)) => r,
            _ => return Vec::new(),
        };

        if !resp.status().is_success() {
            return Vec::new();
        }

        let json = match resp.json::<serde_json::Value>().await {
            Ok(j) => j,
            Err(_) => return Vec::new(),
        };

        let mut results = Vec::new();
        if let Some(res_arr) = json.get("results").and_then(|r| r.as_array()) {
            for res in res_arr {
                let title = res
                    .get("collectionName")
                    .and_then(|s| s.as_str())
                    .unwrap_or(default_album)
                    .to_string();
                let artist_name = res
                    .get("artistName")
                    .and_then(|s| s.as_str())
                    .unwrap_or(default_artist)
                    .to_string();
                if let Some(thumb) = res.get("artworkUrl100").and_then(|s| s.as_str()) {
                    let full = thumb.replace("100x100bb.jpg", "1200x1200bb.jpg");
                    let thumb_300 = thumb.replace("100x100bb.jpg", "300x300bb.jpg");
                    results.push(CoverCandidateDto {
                        source: "Apple Music (1200px)".to_string(),
                        title,
                        artist: artist_name,
                        thumbnail_url: thumb_300,
                        full_url: full,
                        width: Some(1200),
                        height: Some(1200),
                    });
                }
            }
        }
        results
    }

    /// Searches the internet for cover candidates (Deezer, Apple Music / iTunes) in the style of the Poweramp Cover Art Picker.
    /// The service queries run concurrently, and the results are cached in RAM immediately.
    pub async fn search_cover_candidates(
        &self,
        album: &str,
        artist: &str,
    ) -> Vec<CoverCandidateDto> {
        let clean_album = clean_album_title(album);
        let clean_artist = clean_artist_name(artist);

        if clean_album.trim().is_empty() && clean_artist.trim().is_empty() {
            return Vec::new();
        }

        let cache_key = format!(
            "{}---{}",
            clean_album.trim().to_lowercase(),
            clean_artist.trim().to_lowercase()
        );

        // 1. Check the fast in-memory cache (0ms)
        {
            let cache = self.search_cache.lock().await;
            if let Some(cached) = cache.get(&cache_key) {
                debug!(
                    "Cover art search cache hit for: '{}' / '{}'",
                    clean_album, clean_artist
                );
                return cached.clone();
            }
        }

        // 2. Prepare the parallel queries to Deezer and iTunes/Apple Music
        let deezer_adv_url = if !clean_artist.is_empty() && !clean_album.is_empty() {
            Some(format!(
                "https://api.deezer.com/search/album?q=artist:\"{}\" album:\"{}\"&limit=10",
                urlencoding::encode(&clean_artist),
                urlencoding::encode(&clean_album)
            ))
        } else {
            None
        };

        let deezer_general_query = format!("{} {}", clean_artist, clean_album)
            .trim()
            .to_string();
        let deezer_gen_url = if !deezer_general_query.is_empty() {
            Some(format!(
                "https://api.deezer.com/search/album?q={}&limit=10",
                urlencoding::encode(&deezer_general_query)
            ))
        } else {
            None
        };

        let itunes_q1 = format!("{} {}", clean_album, clean_artist)
            .trim()
            .to_string();
        let itunes_url_1 = if !itunes_q1.is_empty() {
            Some(format!(
                "https://itunes.apple.com/search?term={}&entity=album&limit=8",
                urlencoding::encode(&itunes_q1)
            ))
        } else {
            None
        };

        let itunes_q2 = format!("{} {}", clean_artist, clean_album)
            .trim()
            .to_string();
        let itunes_url_2 = if !itunes_q2.is_empty() && itunes_q2 != itunes_q1 {
            Some(format!(
                "https://itunes.apple.com/search?term={}&entity=album&limit=8",
                urlencoding::encode(&itunes_q2)
            ))
        } else {
            None
        };

        // Concurrent fetching (tokio::join!)
        let (res_deezer_adv, res_deezer_gen, res_itunes_1, res_itunes_2) = tokio::join!(
            async {
                if let Some(url) = deezer_adv_url {
                    self.query_deezer(&url, album, artist).await
                } else {
                    Vec::new()
                }
            },
            async {
                if let Some(url) = deezer_gen_url {
                    self.query_deezer(&url, album, artist).await
                } else {
                    Vec::new()
                }
            },
            async {
                if let Some(url) = itunes_url_1 {
                    self.query_itunes(&url, album, artist).await
                } else {
                    Vec::new()
                }
            },
            async {
                if let Some(url) = itunes_url_2 {
                    self.query_itunes(&url, album, artist).await
                } else {
                    Vec::new()
                }
            }
        );

        let mut candidates = Vec::new();
        let mut seen_urls = std::collections::HashSet::new();

        for cand in res_deezer_adv
            .into_iter()
            .chain(res_itunes_1)
            .chain(res_deezer_gen)
            .chain(res_itunes_2)
        {
            if seen_urls.insert(cand.full_url.clone()) {
                candidates.push(cand);
            }
        }

        // Fall back to the raw query if the cleaned one gave few results
        let raw_album = album.trim();
        if candidates.len() < 3 && raw_album != clean_album && !raw_album.is_empty() {
            let fallback_url = format!(
                "https://itunes.apple.com/search?term={}&entity=album&limit=6",
                urlencoding::encode(raw_album)
            );
            let fallback_cands = self.query_itunes(&fallback_url, album, artist).await;
            for cand in fallback_cands {
                if seen_urls.insert(cand.full_url.clone()) {
                    candidates.push(cand);
                }
            }
        }

        // Ranking and sorting (exact title and artist matches first)
        let target_album_lower = clean_album.to_lowercase();
        let target_artist_lower = clean_artist.to_lowercase();

        candidates.sort_by(|a, b| {
            let a_title_exact = a.title.to_lowercase() == target_album_lower;
            let b_title_exact = b.title.to_lowercase() == target_album_lower;
            let a_artist_match = !target_artist_lower.is_empty()
                && a.artist.to_lowercase().contains(&target_artist_lower);
            let b_artist_match = !target_artist_lower.is_empty()
                && b.artist.to_lowercase().contains(&target_artist_lower);

            let a_score = (if a_title_exact {
                4
            } else if a.title.to_lowercase().contains(&target_album_lower) {
                2
            } else {
                0
            }) + (if a_artist_match { 2 } else { 0 });
            let b_score = (if b_title_exact {
                4
            } else if b.title.to_lowercase().contains(&target_album_lower) {
                2
            } else {
                0
            }) + (if b_artist_match { 2 } else { 0 });

            b_score.cmp(&a_score)
        });

        // Store in the cache for instant reopening
        {
            let mut cache = self.search_cache.lock().await;
            cache.insert(cache_key, candidates.clone());
        }

        candidates
    }

    /// Downloads a cover from the given direct URL and stores it in the cache under the chosen file stem.
    pub async fn download_cover_from_url(
        &self,
        url: &str,
        file_stem: &str,
    ) -> Result<PathBuf, MetadataError> {
        ensure_safe_token(file_stem)?;
        net_guard::ensure_public_https_url(url).await?;
        let covers_dir = self.cache_dir.join("covers");
        tokio::fs::create_dir_all(&covers_dir).await?;

        let cached_file = covers_dir.join(format!("{}.jpg", file_stem));
        info!(
            "Downloading cover from URL: {} to file: {:?}",
            url, cached_file
        );

        let resp = self.http.get(url).send().await?;

        if !resp.status().is_success() {
            return Err(MetadataError::Query(format!(
                "Server returned HTTP status {} while downloading the cover",
                resp.status()
            )));
        }

        let bytes = read_image_body(resp).await?;
        if bytes.is_empty() {
            return Err(MetadataError::CoverNotFound(url.to_string()));
        }

        let temp_file = covers_dir.join(format!("{}.tmp", file_stem));
        tokio::fs::write(&temp_file, &bytes).await?;
        tokio::fs::rename(&temp_file, &cached_file).await?;

        info!("Cover stored successfully: {:?}", cached_file);
        Ok(cached_file)
    }

    /// Copies a custom cover file from the local disk into the Auralune cover cache directory.
    pub async fn save_custom_cover_file(
        &self,
        album_id: i64,
        source_path: impl AsRef<Path>,
    ) -> Result<PathBuf, MetadataError> {
        let src = source_path.as_ref();
        if !src.exists() {
            return Err(MetadataError::Io(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "The given image file does not exist",
            )));
        }
        let ext = image_extension(src.extension().and_then(|e| e.to_str()).unwrap_or("jpg"))?;
        let covers_dir = self.cache_dir.join("covers");
        tokio::fs::create_dir_all(&covers_dir).await?;

        let cached_file = covers_dir.join(format!("custom_album_{}.{}", album_id, ext));
        let temp_file = covers_dir.join(format!("custom_album_{}.tmp", album_id));

        tokio::fs::copy(src, &temp_file).await?;
        tokio::fs::rename(&temp_file, &cached_file).await?;
        info!(
            "Stored custom cover for album #{}: {:?}",
            album_id, cached_file
        );
        Ok(cached_file)
    }

    /// Stores the binary data of a custom cover (e.g. from a dropped file / input) in the cache.
    pub async fn save_custom_cover_bytes(
        &self,
        album_id: i64,
        bytes: &[u8],
        ext: &str,
    ) -> Result<PathBuf, MetadataError> {
        let clean_ext = image_extension(if ext.is_empty() { "jpg" } else { ext })?;
        let covers_dir = self.cache_dir.join("covers");
        tokio::fs::create_dir_all(&covers_dir).await?;

        let cached_file = covers_dir.join(format!("custom_album_{}.{}", album_id, clean_ext));
        let temp_file = covers_dir.join(format!("custom_album_{}.tmp", album_id));

        tokio::fs::write(&temp_file, bytes).await?;
        tokio::fs::rename(&temp_file, &cached_file).await?;
        info!(
            "Stored custom cover from binary data for album #{}: {:?}",
            album_id, cached_file
        );
        Ok(cached_file)
    }
}

// Simple URL encoding without extra heavy dependencies
pub mod urlencoding {
    pub fn encode(s: &str) -> String {
        let mut encoded = String::with_capacity(s.len() * 2);
        for byte in s.bytes() {
            match byte {
                b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                    encoded.push(byte as char);
                }
                b' ' => encoded.push_str("%20"),
                _ => {
                    encoded.push_str(&format!("%{:02X}", byte));
                }
            }
        }
        encoded
    }
}

/// Maximum size of a downloaded cover (protects memory and disk from filling up).
pub const MAX_COVER_BYTES: u64 = 20 * 1024 * 1024;
const IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "webp", "gif"];

/// The identifier used in a cover file name (MBID, `album_<id>`) must not contain
/// path separators or `..`.
fn ensure_safe_token(token: &str) -> Result<(), MetadataError> {
    if domain::paths::is_safe_file_token(token) {
        Ok(())
    } else {
        Err(MetadataError::Query(format!(
            "Invalid cover identifier: {token:?}"
        )))
    }
}

/// Cover file extension from the allow-list (returned in lowercase).
fn image_extension(ext: &str) -> Result<String, MetadataError> {
    let lower = ext.to_ascii_lowercase();
    if IMAGE_EXTENSIONS.contains(&lower.as_str()) {
        Ok(lower)
    } else {
        Err(MetadataError::Query(format!(
            "Unsupported cover format: .{ext}"
        )))
    }
}

/// Reads a cover response: requires an `image/*` type (when the server sends one) and the size limit.
async fn read_image_body(resp: reqwest::Response) -> Result<Vec<u8>, MetadataError> {
    let content_type = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_ascii_lowercase();
    if !content_type.is_empty() && !content_type.starts_with("image/") {
        return Err(MetadataError::Query(format!(
            "Server returned {content_type} instead of a cover image"
        )));
    }
    if resp
        .content_length()
        .is_some_and(|len| len > MAX_COVER_BYTES)
    {
        return Err(MetadataError::Query("The cover exceeds 20 MB".into()));
    }
    // Streaming: a server without Content-Length (chunked) cannot exceed the limit either.
    let mut resp = resp;
    let mut bytes = Vec::new();
    while let Some(chunk) = resp.chunk().await? {
        if bytes.len() as u64 + chunk.len() as u64 > MAX_COVER_BYTES {
            return Err(MetadataError::Query("The cover exceeds 20 MB".into()));
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}
