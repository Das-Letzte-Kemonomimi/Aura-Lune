//! MusicBrainz and Cover Art Archive metadata integration.
//!
//! Per ADR 0007 and AGENTS.md:
//! - releases are identified by MBID,
//! - an explicit User-Agent with the version and project address (`http::USER_AGENT`),
//! - request rate limiting (1 req/s to the MusicBrainz server),
//! - release candidates are returned for confirmation when the match is ambiguous,
//! - covers are downloaded from Cover Art Archive and cached locally.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant};
use thiserror::Error;
use tokio::sync::Mutex;
use tokio::task::JoinSet;
use tracing::{debug, info, warn};

pub mod acoustid;
pub mod cover_query;
pub mod http;
pub mod lastfm;
pub mod listenbrainz;
pub mod lyrics;
pub mod net_guard;
pub use acoustid::*;
pub use cover_query::{
    AlbumLookupContext, CandidateContext, AUTO_ACCEPT_SCORE, BACKGROUND_AUTO_ACCEPT_SCORE,
};
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
    /// How well the candidate matches the wanted album and artist, 0-100 (best first in lists).
    #[serde(default)]
    pub match_score: u8,
    /// Matched MusicBrainz release ID when the candidate comes from MusicBrainz / CAA.
    #[serde(default)]
    pub release_mbid: Option<String>,
    /// Release year if reported by the provider.
    #[serde(default)]
    pub release_year: Option<i64>,
    /// Album track count if reported by the provider.
    #[serde(default)]
    pub track_count: Option<usize>,
    /// Internal tracklist endpoint for verifying homonymous Deezer albums.
    #[serde(default, skip_serializing)]
    pub tracklist_url: Option<String>,
}

/// Interactive ladder rungs tried per search, at most.
const MAX_LADDER_RUNGS: usize = 5;
/// Number of well-matching candidates after which the ladder stops relaxing the query.
const ENOUGH_GOOD_CANDIDATES: usize = 3;
/// MusicBrainz releases inspected concurrently per search for Cover Art Archive art.
const MAX_MB_RELEASES: usize = 5;
/// MusicBrainz releases that score below this are not worth a Cover Art Archive request.
const MIN_MB_RELEASE_SCORE: u8 = 40;
/// Timeout for fast interactive cover search endpoints (Deezer, iTunes, CAA index JSON).
const FAST_SEARCH_TIMEOUT: Duration = Duration::from_millis(2500);
/// Positive search cache TTL in RAM.
const SEARCH_CACHE_HIT_TTL: Duration = Duration::from_secs(30 * 60);
/// Negative search cache TTL in RAM so repeated clicks do not stall.
const SEARCH_CACHE_MISS_TTL: Duration = Duration::from_secs(5 * 60);
/// Maximum cached searches retained in RAM.
const SEARCH_CACHE_MAX_ENTRIES: usize = 256;

#[derive(Debug, Clone)]
struct SearchCacheEntry {
    cached_at: Instant,
    candidates: Vec<CoverCandidateDto>,
}

fn count_good(candidates: &[CoverCandidateDto]) -> usize {
    candidates
        .iter()
        .filter(|c| c.match_score >= AUTO_ACCEPT_SCORE)
        .count()
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
        self.search_releases_with_context(album, artist, &[]).await
    }

    /// Searches releases using optional sample track titles to disambiguate same-name artists
    /// and titles where soundtrack tags differ from MusicBrainz formatting.
    pub async fn search_releases_with_context(
        &self,
        album: &str,
        artist: &str,
        sample_tracks: &[String],
    ) -> Result<Vec<ReleaseCandidateDto>, MetadataError> {
        let mut last_error = None;
        for query in Self::release_queries_with_tracks(album, artist, sample_tracks) {
            match self.run_release_query(&query).await {
                Ok(found) if !found.is_empty() => return Ok(found),
                Ok(_) => {}
                Err(e) => last_error = Some(e),
            }
        }
        match last_error {
            Some(e) => Err(e),
            None => Ok(Vec::new()),
        }
    }

    /// Checks whether a specific MusicBrainz release contains at least one normalized track title
    /// from `sample_tracks` (`inc=recordings`).
    pub async fn release_matches_sample_tracks(
        &self,
        mbid: &str,
        sample_tracks: &[String],
    ) -> Option<bool> {
        if sample_tracks.is_empty() || ensure_safe_token(mbid).is_err() {
            return None;
        }
        self.wait_rate_limit().await;
        let url = format!(
            "https://musicbrainz.org/ws/2/release/{}?inc=recordings&fmt=json",
            urlencoding::encode(mbid)
        );
        let resp = http::send_with_retry(self.http.get(&url).header("Accept", "application/json"))
            .await
            .ok()?;
        if !resp.status().is_success() {
            return None;
        }
        let body: serde_json::Value = resp.json().await.ok()?;
        let wanted: HashSet<String> = sample_tracks
            .iter()
            .map(|t| cover_query::normalize(&clean_album_title(t)))
            .filter(|t| t.len() >= 3)
            .collect();
        if wanted.is_empty() {
            return None;
        }
        let media = body.get("media")?.as_array()?;
        for disc in media {
            let Some(tracks) = disc.get("tracks").and_then(|t| t.as_array()) else {
                continue;
            };
            for track in tracks {
                if let Some(title) = track.get("title").and_then(|t| t.as_str()) {
                    let norm = cover_query::normalize(&clean_album_title(title));
                    if wanted.contains(&norm) {
                        return Some(true);
                    }
                }
            }
        }
        Some(false)
    }

    /// Lucene queries from strict to loose: album + full artist, tokenized album + primary artist,
    /// sample recording + album tokens (pins homonymous releases), variants, then token-AND fallback.
    pub fn release_queries(album: &str, artist: &str) -> Vec<String> {
        Self::release_queries_with_tracks(album, artist, &[])
    }

    pub fn release_queries_with_tracks(
        album: &str,
        artist: &str,
        sample_tracks: &[String],
    ) -> Vec<String> {
        let raw_album = album.replace(['"', '\\'], " ");
        let raw_album = raw_album.split_whitespace().collect::<Vec<_>>().join(" ");
        let cleaned_album = clean_album_title(album).replace(['"', '\\'], " ");
        let cleaned_album = cleaned_album.trim().to_string();
        let full_artist = clean_artist_name(artist).replace(['"', '\\'], "");
        let full_artist = full_artist.trim();
        let primary = cover_query::split_artists(full_artist)
            .into_iter()
            .next()
            .unwrap_or_default();
        let has_artist = !cover_query::is_neutral_artist(full_artist);

        let mut queries = Vec::new();
        let mut push = |q: String| {
            if !q.is_empty() && !queries.contains(&q) {
                queries.push(q);
            }
        };

        if raw_album.is_empty() && cleaned_album.is_empty() {
            return queries;
        }

        let token_expr = |text: &str| -> Option<String> {
            let norm = cover_query::normalize(text);
            let toks: Vec<&str> = norm
                .split_whitespace()
                .filter(|t| t.len() >= 2 && !matches!(*t, "and" | "the" | "of" | "a"))
                .collect();
            if toks.len() >= 2 {
                Some(toks.join(" AND "))
            } else {
                None
            }
        };

        if has_artist {
            if !cleaned_album.is_empty() {
                push(format!(
                    "release:\"{cleaned_album}\" AND artist:\"{full_artist}\""
                ));
                if primary != full_artist {
                    push(format!(
                        "release:\"{cleaned_album}\" AND artist:\"{primary}\""
                    ));
                }
            }
            // Also try full unstripped album when soundtracks have "ORIGINAL SOUNDTRACK" inside quotes.
            if !raw_album.is_empty() && raw_album != cleaned_album {
                push(format!("release:\"{raw_album}\" AND artist:\"{primary}\""));
            }
            if let Some(toks) = token_expr(if !raw_album.is_empty() {
                &raw_album
            } else {
                &cleaned_album
            }) {
                push(format!("release:({toks}) AND artist:\"{primary}\""));
            }
        }

        // Pin homonymous or guest-vocalist album tracks via recording title + release tokens.
        if let Some(first_track) = sample_tracks
            .iter()
            .map(|s| s.replace(['"', '\\'], " ").trim().to_string())
            .find(|s| s.chars().count() >= 3)
        {
            if let Some(toks) = token_expr(&cleaned_album) {
                push(format!("release:({toks}) AND recording:\"{first_track}\""));
            } else if !cleaned_album.is_empty() {
                push(format!(
                    "release:\"{cleaned_album}\" AND recording:\"{first_track}\""
                ));
            }
        }

        for variant in cover_query::album_variants(album) {
            let v = variant.replace(['"', '\\'], "");
            let v = v.trim();
            if v.is_empty() || v == cleaned_album {
                continue;
            }
            if has_artist && !primary.is_empty() {
                push(format!("release:\"{v}\" AND artist:\"{primary}\""));
            }
        }

        if let Some(toks) = token_expr(&cleaned_album) {
            push(format!("release:({toks})"));
        } else if !cleaned_album.is_empty() {
            push(format!("release:\"{cleaned_album}\""));
        }
        if has_artist && !primary.is_empty() {
            let tail = if !cleaned_album.is_empty() {
                &cleaned_album
            } else {
                &raw_album
            };
            push(format!("{tail} {primary}"));
        }
        queries
    }

    async fn run_release_query(
        &self,
        query: &str,
    ) -> Result<Vec<ReleaseCandidateDto>, MetadataError> {
        self.wait_rate_limit().await;

        let url = format!(
            "https://musicbrainz.org/ws/2/release/?query={}&fmt=json&limit=10",
            urlencoding::encode(query)
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
                    .and_then(|arr| {
                        let mut joined = String::new();
                        for entry in arr {
                            if let Some(name) = entry.get("name").and_then(|n| n.as_str()) {
                                joined.push_str(name);
                                if let Some(jp) = entry.get("joinphrase").and_then(|j| j.as_str()) {
                                    joined.push_str(jp);
                                }
                            }
                        }
                        let trimmed = joined.trim();
                        (!trimmed.is_empty()).then(|| trimmed.to_string())
                    })
                    .unwrap_or_else(|| "Unknown Artist".to_string());

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

/// Cleans an artist name of brackets, full-width notes, and quoted character-voice (`"cv. ..."`) noise.
pub fn clean_artist_name(artist: &str) -> String {
    let mut cleaned = String::new();
    let mut depth = 0usize;
    let mut in_cv_quote = false;
    let chars: Vec<char> = artist.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        match c {
            '(' | '[' | '{' | '（' | '【' => depth += 1,
            ')' | ']' | '}' | '）' | '】' => {
                depth = depth.saturating_sub(1);
            }
            '"' | '“' | '”' if depth == 0 => {
                if !in_cv_quote {
                    let rest: String = chars[i + 1..].iter().collect();
                    let lower = rest.trim_start().to_ascii_lowercase();
                    if lower.starts_with("cv.") || lower.starts_with("cv:") {
                        in_cv_quote = true;
                        i += 1;
                        continue;
                    }
                } else {
                    in_cv_quote = false;
                    i += 1;
                    continue;
                }
                cleaned.push(c);
            }
            _ if depth == 0 && !in_cv_quote => cleaned.push(c),
            _ => {}
        }
        i += 1;
    }

    // Also strip unquoted trailing `cv. ...` / `cv: ...` if present.
    let lower = cleaned.to_ascii_lowercase();
    for marker in [" cv. ", " cv: "] {
        if let Some(pos) = lower.find(marker) {
            cleaned.truncate(pos);
            break;
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
#[derive(Clone)]
pub struct CoverArtArchiveClient {
    http: reqwest::Client,
    cache_dir: PathBuf,
    deezer_base_url: String,
    itunes_base_url: String,
    search_cache: Arc<Mutex<HashMap<String, SearchCacheEntry>>>,
}

impl CoverArtArchiveClient {
    pub fn new(cache_dir: impl AsRef<Path>) -> Self {
        Self::with_search_base_urls(
            cache_dir,
            "https://api.deezer.com",
            "https://itunes.apple.com",
        )
    }

    pub fn with_search_base_urls(
        cache_dir: impl AsRef<Path>,
        deezer_base_url: impl Into<String>,
        itunes_base_url: impl Into<String>,
    ) -> Self {
        let http = http::build_client(Duration::from_secs(15));

        Self {
            http,
            cache_dir: cache_dir.as_ref().to_path_buf(),
            deezer_base_url: deezer_base_url.into().trim_end_matches('/').to_string(),
            itunes_base_url: itunes_base_url.into().trim_end_matches('/').to_string(),
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

        let resp = match tokio::time::timeout(FAST_SEARCH_TIMEOUT, req).await {
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
                let track_count = item
                    .get("nb_tracks")
                    .and_then(|n| n.as_u64())
                    .map(|n| n as usize);
                let tracklist_url = item
                    .get("tracklist")
                    .and_then(|t| t.as_str())
                    .map(str::to_string);
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
                        match_score: 0,
                        release_mbid: None,
                        release_year: None,
                        track_count,
                        tracklist_url,
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

        let resp = match tokio::time::timeout(FAST_SEARCH_TIMEOUT, req).await {
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
                let track_count = res
                    .get("trackCount")
                    .and_then(|n| n.as_u64())
                    .map(|n| n as usize);
                let release_year = res
                    .get("releaseDate")
                    .and_then(|s| s.as_str())
                    .and_then(|s| s.get(..4))
                    .and_then(|y| y.parse::<i64>().ok());
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
                        match_score: 0,
                        release_mbid: None,
                        release_year,
                        track_count,
                        tracklist_url: None,
                    });
                }
            }
        }
        results
    }

    /// Searches Deezer and Apple Music (iTunes) for cover candidates, in the style of the
    /// Poweramp Cover Art Picker. See [`Self::search_cover_candidates_with`].
    pub async fn search_cover_candidates(
        &self,
        album: &str,
        artist: &str,
    ) -> Vec<CoverCandidateDto> {
        self.search_cover_candidates_with(album, artist, None).await
    }

    /// Searches for cover candidates without extra album verification context.
    pub async fn search_cover_candidates_with(
        &self,
        album: &str,
        artist: &str,
        mb: Option<&MusicBrainzClient>,
    ) -> Vec<CoverCandidateDto> {
        self.search_cover_candidates_for_album(
            album,
            artist,
            &cover_query::AlbumLookupContext::default(),
            mb,
        )
        .await
    }

    async fn read_search_cache(&self, key: &str) -> Option<Vec<CoverCandidateDto>> {
        let mut cache = self.search_cache.lock().await;
        let entry = cache.get(key)?;
        let ttl = if entry.candidates.is_empty() {
            SEARCH_CACHE_MISS_TTL
        } else {
            SEARCH_CACHE_HIT_TTL
        };
        if entry.cached_at.elapsed() < ttl {
            return Some(entry.candidates.clone());
        }
        cache.remove(key);
        None
    }

    async fn write_search_cache(&self, key: String, results: Vec<CoverCandidateDto>) {
        let mut cache = self.search_cache.lock().await;
        if cache.len() >= SEARCH_CACHE_MAX_ENTRIES {
            // Evict oldest entry when capacity is reached.
            if let Some(oldest_key) = cache
                .iter()
                .min_by_key(|(_, entry)| entry.cached_at)
                .map(|(k, _)| k.clone())
            {
                cache.remove(&oldest_key);
            }
        }
        cache.insert(
            key,
            SearchCacheEntry {
                cached_at: Instant::now(),
                candidates: results,
            },
        );
    }

    /// Searches for cover candidates using album year, track count and sample tracks to
    /// disambiguate same-name artists and titles. Rung 1 runs first; if needed, remaining ladder
    /// rungs run concurrently with MusicBrainz/Cover Art Archive discovery.
    pub async fn search_cover_candidates_for_album(
        &self,
        album: &str,
        artist: &str,
        ctx: &cover_query::AlbumLookupContext,
        mb: Option<&MusicBrainzClient>,
    ) -> Vec<CoverCandidateDto> {
        let ladder = cover_query::query_ladder(album, artist);
        if ladder.is_empty() {
            return Vec::new();
        }

        let cache_key = format!(
            "{}---{}---{:?}---{:?}---{}---{}",
            cover_query::normalize(&clean_album_title(album)),
            cover_query::normalize(&clean_artist_name(artist)),
            ctx.year,
            ctx.track_count,
            ctx.sample_tracks
                .first()
                .map(|t| cover_query::normalize(t))
                .unwrap_or_default(),
            mb.is_some(),
        );
        if let Some(cached) = self.read_search_cache(&cache_key).await {
            debug!("Cover art search cache hit for: '{album}' / '{artist}'");
            return cached;
        }

        let mut candidates: Vec<CoverCandidateDto> = Vec::new();
        let mut seen_urls = HashSet::new();
        let mut add = |found: Vec<CoverCandidateDto>, candidates: &mut Vec<CoverCandidateDto>| {
            for mut cand in found {
                if !seen_urls.insert(cand.full_url.clone()) {
                    continue;
                }
                let cand_ctx = cover_query::CandidateContext {
                    title: &cand.title,
                    artist: &cand.artist,
                    year: cand.release_year,
                    track_count: cand.track_count,
                    release_mbid: cand.release_mbid.as_deref(),
                };
                cand.match_score =
                    cover_query::match_score_with_context(album, artist, ctx, &cand_ctx);
                candidates.push(cand);
            }
        };

        // Run strict rung 1 concurrently across Deezer & iTunes first.
        if let Some(first_rung) = ladder.first() {
            add(self.query_ladder_rung(first_rung).await, &mut candidates);
        }

        let strong_top = candidates
            .iter()
            .any(|c| c.match_score >= cover_query::BACKGROUND_AUTO_ACCEPT_SCORE);
        if count_good(&candidates) < ENOUGH_GOOD_CANDIDATES && !strong_top {
            let rest_ladder_fut = async {
                let mut extra = Vec::new();
                for query in ladder.iter().skip(1).take(MAX_LADDER_RUNGS - 1) {
                    let found = self.query_ladder_rung(query).await;
                    extra.extend(found);
                    if extra
                        .iter()
                        .filter(|cand| {
                            let cand_ctx = cover_query::CandidateContext {
                                title: &cand.title,
                                artist: &cand.artist,
                                year: cand.release_year,
                                track_count: cand.track_count,
                                release_mbid: cand.release_mbid.as_deref(),
                            };
                            cover_query::match_score_with_context(album, artist, ctx, &cand_ctx)
                                >= AUTO_ACCEPT_SCORE
                        })
                        .count()
                        >= ENOUGH_GOOD_CANDIDATES
                    {
                        break;
                    }
                }
                extra
            };

            let mb_fut = async {
                if let Some(mb) = mb {
                    self.query_musicbrainz_covers_with_context(mb, album, artist, ctx)
                        .await
                } else {
                    Vec::new()
                }
            };

            let (ladder_more, mb_more) = tokio::join!(rest_ladder_fut, mb_fut);
            add(ladder_more, &mut candidates);
            add(mb_more, &mut candidates);
        }

        candidates.sort_by_key(|c| std::cmp::Reverse(c.match_score));
        self.write_search_cache(cache_key, candidates.clone()).await;
        candidates
    }

    /// Asks Deezer (strict and loose) and iTunes about one step of the query ladder.
    async fn query_ladder_rung(&self, query: &cover_query::CoverQuery) -> Vec<CoverCandidateDto> {
        let album = query.album.replace('"', "");
        let album = album.trim();
        let artist = query.artist.as_deref().unwrap_or_default().replace('"', "");
        let artist = artist.trim();

        let deezer_strict = (!artist.is_empty() && !album.is_empty()).then(|| {
            let q = format!("artist:\"{artist}\" album:\"{album}\"");
            format!(
                "{}/search/album?q={}&limit=10",
                self.deezer_base_url,
                urlencoding::encode(&q)
            )
        });
        let loose = format!("{artist} {album}").trim().to_string();
        let deezer_loose = (!loose.is_empty()).then(|| {
            format!(
                "{}/search/album?q={}&limit=10",
                self.deezer_base_url,
                urlencoding::encode(&loose)
            )
        });
        let itunes_term = format!("{album} {artist}").trim().to_string();
        let itunes = (!itunes_term.is_empty()).then(|| {
            format!(
                "{}/search?term={}&entity=album&limit=8",
                self.itunes_base_url,
                urlencoding::encode(&itunes_term)
            )
        });

        let (strict, itunes, loose) = tokio::join!(
            async {
                match &deezer_strict {
                    Some(url) => self.query_deezer(url, album, artist).await,
                    None => Vec::new(),
                }
            },
            async {
                match &itunes {
                    Some(url) => self.query_itunes(url, album, artist).await,
                    None => Vec::new(),
                }
            },
            async {
                match &deezer_loose {
                    Some(url) => self.query_deezer(url, album, artist).await,
                    None => Vec::new(),
                }
            }
        );
        strict.into_iter().chain(itunes).chain(loose).collect()
    }

    /// Looks releases up on MusicBrainz and checks the Cover Art Archive concurrently for all
    /// qualifying releases. Used for anime/game soundtracks, niche releases, and homonym disambiguation.
    async fn query_musicbrainz_covers_with_context(
        &self,
        mb: &MusicBrainzClient,
        album: &str,
        artist: &str,
        ctx: &cover_query::AlbumLookupContext,
    ) -> Vec<CoverCandidateDto> {
        let Ok(releases) = mb
            .search_releases_with_context(album, artist, &ctx.sample_tracks)
            .await
        else {
            return Vec::new();
        };

        let mut seen_release_keys = HashSet::new();
        let mut selected = Vec::new();
        for release in releases {
            if selected.len() >= MAX_MB_RELEASES {
                break;
            }
            let release_year = release
                .date
                .as_deref()
                .and_then(|d| d.get(..4))
                .and_then(|y| y.parse::<i64>().ok());
            let cand_ctx = cover_query::CandidateContext {
                title: &release.title,
                artist: &release.artist,
                year: release_year,
                track_count: release.track_count,
                release_mbid: Some(&release.mbid),
            };
            let score = cover_query::match_score_with_context(album, artist, ctx, &cand_ctx);
            if score < MIN_MB_RELEASE_SCORE {
                continue;
            }
            let dedup_key = (
                cover_query::normalize(&release.title),
                cover_query::normalize(&release.artist),
                release.track_count,
            );
            if !seen_release_keys.insert(dedup_key) {
                continue;
            }
            selected.push(release);
        }

        let mut join_set = JoinSet::new();
        for release in selected {
            let this = self.clone();
            join_set.spawn(async move { this.caa_front_candidate(&release).await });
        }

        let mut out = Vec::new();
        while let Some(res) = join_set.join_next().await {
            if let Ok(Some(cand)) = res {
                out.push(cand);
            }
        }
        out
    }

    /// Reads the Cover Art Archive index of a release. `None` when it has no images.
    async fn caa_front_candidate(
        &self,
        release: &ReleaseCandidateDto,
    ) -> Option<CoverCandidateDto> {
        ensure_safe_token(&release.mbid).ok()?;
        let url = format!("https://coverartarchive.org/release/{}", release.mbid);
        let json = self.get_json(&url).await?;
        let images = json.get("images")?.as_array()?;
        let image = images
            .iter()
            .find(|i| i.get("front").and_then(|f| f.as_bool()) == Some(true))
            .or_else(|| images.first())?;
        let https = |s: &str| s.replacen("http://", "https://", 1);
        let full = https(image.get("image")?.as_str()?);
        let thumb = image
            .get("thumbnails")
            .and_then(|t| t.get("500").or_else(|| t.get("large")))
            .and_then(|t| t.as_str())
            .map(https)
            .unwrap_or_else(|| full.clone());
        let release_year = release
            .date
            .as_deref()
            .and_then(|d| d.get(..4))
            .and_then(|y| y.parse::<i64>().ok());
        Some(CoverCandidateDto {
            source: "Cover Art Archive".to_string(),
            title: release.title.clone(),
            artist: release.artist.clone(),
            thumbnail_url: thumb,
            full_url: full,
            width: None,
            height: None,
            match_score: 0,
            release_mbid: Some(release.mbid.clone()),
            release_year,
            track_count: release.track_count,
            tracklist_url: None,
        })
    }

    /// Public URL of the front cover of a release (after redirects), or `None` when the
    /// Cover Art Archive has none. Used for Discord, which needs a direct public image URL.
    pub async fn release_front_url(&self, mbid: &str) -> Option<String> {
        ensure_safe_token(mbid).ok()?;
        let url = format!("https://coverartarchive.org/release/{mbid}/front-500");
        let resp = tokio::time::timeout(FAST_SEARCH_TIMEOUT, self.http.head(&url).send())
            .await
            .ok()?
            .ok()?;
        if !resp.status().is_success() {
            return None;
        }
        let final_url = resp.url().as_str();
        final_url
            .starts_with("https://")
            .then(|| final_url.to_string())
    }

    /// Returns the best cover only when it really is the wanted album
    /// (`match_score >= AUTO_ACCEPT_SCORE`).
    pub async fn find_best_cover(
        &self,
        album: &str,
        artist: &str,
        title_hint: Option<&str>,
        mb: Option<&MusicBrainzClient>,
    ) -> Option<CoverCandidateDto> {
        self.find_best_cover_for_album(
            album,
            artist,
            title_hint,
            &cover_query::AlbumLookupContext::default(),
            mb,
        )
        .await
    }

    /// Context-aware best cover lookup (`match_score >= AUTO_ACCEPT_SCORE`) for single-album auto-fetch
    /// and Discord Rich Presence.
    pub async fn find_best_cover_for_album(
        &self,
        album: &str,
        artist: &str,
        title_hint: Option<&str>,
        ctx: &cover_query::AlbumLookupContext,
        mb: Option<&MusicBrainzClient>,
    ) -> Option<CoverCandidateDto> {
        if !cover_query::is_unknown_album(album) {
            let candidates = self
                .search_cover_candidates_for_album(album, artist, ctx, mb)
                .await;
            if let Some(best) = candidates
                .into_iter()
                .find(|c| c.match_score >= AUTO_ACCEPT_SCORE)
            {
                return Some(best);
            }
        }
        let title = title_hint?.trim();
        if title.is_empty() || cover_query::is_neutral_artist(&clean_artist_name(artist)) {
            return None;
        }
        self.find_cover_by_song(artist, title).await
    }

    /// Stricter lookup for unattended background cover fetching (`BACKGROUND_AUTO_ACCEPT_SCORE = 90`).
    /// Prevents homonym/short-name mistakes by refusing neutral artists (without a verified MBID),
    /// rejecting close-tie different covers, and verifying against album track titles when ambiguous.
    pub async fn find_high_confidence_cover(
        &self,
        album: &str,
        artist: &str,
        ctx: &cover_query::AlbumLookupContext,
        mb: Option<&MusicBrainzClient>,
    ) -> Option<CoverCandidateDto> {
        if cover_query::is_unknown_album(album) {
            return None;
        }
        let has_mbid = ctx
            .release_mbid
            .as_deref()
            .is_some_and(|m| !m.trim().is_empty());
        if cover_query::is_neutral_artist(&clean_artist_name(artist)) && !has_mbid {
            return None;
        }

        let candidates = self
            .search_cover_candidates_for_album(album, artist, ctx, mb)
            .await;
        let top = candidates.first()?;
        if top.match_score < cover_query::BACKGROUND_AUTO_ACCEPT_SCORE {
            return None;
        }

        let has_close_conflict = candidates.iter().skip(1).any(|other| {
            other.full_url != top.full_url
                && top.match_score.saturating_sub(other.match_score) <= 6
                && cover_query::normalize(&other.title) != cover_query::normalize(&top.title)
        });
        let needs_track_verification = cover_query::is_ambiguity_prone(album, artist)
            || has_close_conflict
            || top.match_score < 95;

        if needs_track_verification && !ctx.sample_tracks.is_empty() {
            let track_verified = self
                .verify_candidate_tracks(top, &ctx.sample_tracks, mb)
                .await;
            match track_verified {
                Some(true) => return Some(top.clone()),
                Some(false) => return None,
                None if has_close_conflict || cover_query::is_ambiguity_prone(album, artist) => {
                    return None
                }
                None => {}
            }
        } else if has_close_conflict {
            return None;
        }

        Some(top.clone())
    }

    async fn verify_candidate_tracks(
        &self,
        cand: &CoverCandidateDto,
        sample_tracks: &[String],
        mb: Option<&MusicBrainzClient>,
    ) -> Option<bool> {
        if let (Some(mbid), Some(mb)) = (cand.release_mbid.as_deref(), mb) {
            return mb.release_matches_sample_tracks(mbid, sample_tracks).await;
        }
        let tracklist_url = cand.tracklist_url.as_deref()?;
        if !tracklist_url.starts_with(&self.deezer_base_url)
            && net_guard::ensure_public_https_url(tracklist_url)
                .await
                .is_err()
        {
            return None;
        }
        let json = self.get_json(tracklist_url).await?;
        let data = json.get("data")?.as_array()?;
        let wanted: HashSet<String> = sample_tracks
            .iter()
            .map(|t| cover_query::normalize(&clean_album_title(t)))
            .filter(|t| t.len() >= 3)
            .collect();
        if wanted.is_empty() {
            return None;
        }
        let matched = data.iter().any(|item| {
            item.get("title")
                .and_then(|t| t.as_str())
                .map(|t| wanted.contains(&cover_query::normalize(&clean_album_title(t))))
                .unwrap_or(false)
        });
        Some(matched)
    }

    /// iTunes song lookup: accepts only a song whose title and artist match strictly.
    async fn find_cover_by_song(&self, artist: &str, title: &str) -> Option<CoverCandidateDto> {
        let cleaned_artist = clean_artist_name(artist);
        let term = format!("{} {}", cleaned_artist, title);
        let url = format!(
            "{}/search?term={}&entity=song&limit=10",
            self.itunes_base_url,
            urlencoding::encode(term.trim())
        );
        let json = self.get_json(&url).await?;
        let wanted_title = cover_query::normalize(&clean_album_title(title));
        json.get("results")?.as_array()?.iter().find_map(|res| {
            let track = res.get("trackName")?.as_str()?;
            let track_artist = res.get("artistName")?.as_str()?;
            if cover_query::normalize(&clean_album_title(track)) != wanted_title
                || !cover_query::artists_match(artist, track_artist)
            {
                return None;
            }
            let thumb = res.get("artworkUrl100")?.as_str()?;
            let track_count = res
                .get("trackCount")
                .and_then(|n| n.as_u64())
                .map(|n| n as usize);
            let release_year = res
                .get("releaseDate")
                .and_then(|s| s.as_str())
                .and_then(|s| s.get(..4))
                .and_then(|y| y.parse::<i64>().ok());
            Some(CoverCandidateDto {
                source: "Apple Music (1200px)".to_string(),
                title: res
                    .get("collectionName")
                    .and_then(|s| s.as_str())
                    .unwrap_or(track)
                    .to_string(),
                artist: track_artist.to_string(),
                thumbnail_url: thumb.replace("100x100bb.jpg", "300x300bb.jpg"),
                full_url: thumb.replace("100x100bb.jpg", "1200x1200bb.jpg"),
                width: Some(1200),
                height: Some(1200),
                match_score: 90,
                release_mbid: None,
                release_year,
                track_count,
                tracklist_url: None,
            })
        })
    }

    /// GET with the fast interactive search timeout; `None` on any failure.
    async fn get_json(&self, url: &str) -> Option<serde_json::Value> {
        let resp = tokio::time::timeout(FAST_SEARCH_TIMEOUT, self.http.get(url).send())
            .await
            .ok()?
            .ok()?;
        if !resp.status().is_success() {
            return None;
        }
        resp.json().await.ok()
    }

    /// Downloads a cover from the given direct URL and stores it in the cache under the chosen
    /// file stem with an extension matching the server's MIME type.
    pub async fn download_cover_from_url(
        &self,
        url: &str,
        file_stem: &str,
    ) -> Result<PathBuf, MetadataError> {
        ensure_safe_token(file_stem)?;
        net_guard::ensure_public_https_url(url).await?;
        let covers_dir = self.cache_dir.join("covers");
        tokio::fs::create_dir_all(&covers_dir).await?;

        let resp = self.http.get(url).send().await?;

        if !resp.status().is_success() {
            return Err(MetadataError::Query(format!(
                "Server returned HTTP status {} while downloading the cover",
                resp.status()
            )));
        }

        let ext = ext_from_content_type(
            resp.headers()
                .get(reqwest::header::CONTENT_TYPE)
                .and_then(|v| v.to_str().ok()),
        );
        let cached_file = covers_dir.join(format!("{file_stem}.{ext}"));
        info!(
            "Downloading cover from URL: {} to file: {:?}",
            url, cached_file
        );

        let bytes = read_image_body(resp).await?;
        if bytes.is_empty() {
            return Err(MetadataError::CoverNotFound(url.to_string()));
        }

        let temp_file = covers_dir.join(format!("{file_stem}.tmp"));
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

fn ext_from_content_type(content_type: Option<&str>) -> &'static str {
    let ct = content_type.unwrap_or("").to_ascii_lowercase();
    if ct.contains("image/png") {
        "png"
    } else if ct.contains("image/webp") {
        "webp"
    } else if ct.contains("image/gif") {
        "gif"
    } else {
        "jpg"
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
