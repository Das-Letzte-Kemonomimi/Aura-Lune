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
pub mod cover_query;
pub mod http;
pub mod lastfm;
pub mod listenbrainz;
pub mod lyrics;
pub mod net_guard;
pub use acoustid::*;
pub use cover_query::AUTO_ACCEPT_SCORE;
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
}

/// Ladder steps tried per search, at most.
const MAX_LADDER_RUNGS: usize = 6;
/// Number of well-matching candidates after which the ladder stops relaxing the query.
const ENOUGH_GOOD_CANDIDATES: usize = 3;
/// MusicBrainz releases inspected per search (each costs a Cover Art Archive request).
const MAX_MB_RELEASES: usize = 5;
/// MusicBrainz releases that score below this are not worth a Cover Art Archive request.
const MIN_MB_RELEASE_SCORE: u8 = 40;

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
        let mut last_error = None;
        for query in Self::release_queries(album, artist) {
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

    /// Lucene queries from strict to loose: album + full artist, album + primary artist,
    /// album only, then free text. The first one that finds anything wins.
    pub fn release_queries(album: &str, artist: &str) -> Vec<String> {
        let album = clean_album_title(album).replace(['"', '\\'], "");
        let album = album.trim();
        let full_artist = clean_artist_name(artist).replace(['"', '\\'], "");
        let full_artist = full_artist.trim();
        let primary = cover_query::split_artists(full_artist)
            .into_iter()
            .next()
            .unwrap_or_default();
        let has_artist = !cover_query::is_neutral_artist(full_artist);

        let mut queries = Vec::new();
        if album.is_empty() {
            return queries;
        }
        if has_artist {
            queries.push(format!("release:\"{album}\" AND artist:\"{full_artist}\""));
            if primary != full_artist {
                queries.push(format!("release:\"{album}\" AND artist:\"{primary}\""));
            }
        }
        queries.push(format!("release:\"{album}\""));
        if has_artist {
            queries.push(format!("{album} {primary}"));
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
    deezer_base_url: String,
    itunes_base_url: String,
    search_cache: Arc<Mutex<std::collections::HashMap<String, Vec<CoverCandidateDto>>>>,
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
                        match_score: 0,
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
                        match_score: 0,
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

    /// Searches for cover candidates, album first and artist second, relaxing the query step by
    /// step ([`cover_query::query_ladder`]): full artist string, primary artist, shortened album
    /// titles, album only. Each step asks Deezer and iTunes concurrently. When fewer than two
    /// good matches turn up and a MusicBrainz client is given, releases found there are added
    /// through the Cover Art Archive.
    ///
    /// Every candidate carries a `match_score`; the list is sorted best first and results are
    /// cached in RAM. Callers that pick a cover unattended must use [`Self::find_best_cover`].
    pub async fn search_cover_candidates_with(
        &self,
        album: &str,
        artist: &str,
        mb: Option<&MusicBrainzClient>,
    ) -> Vec<CoverCandidateDto> {
        let ladder = cover_query::query_ladder(album, artist);
        if ladder.is_empty() {
            return Vec::new();
        }

        let cache_key = format!(
            "{}---{}---{}",
            clean_album_title(album).trim().to_lowercase(),
            clean_artist_name(artist).trim().to_lowercase(),
            mb.is_some()
        );
        if let Some(cached) = self.search_cache.lock().await.get(&cache_key) {
            debug!("Cover art search cache hit for: '{album}' / '{artist}'");
            return cached.clone();
        }

        let mut candidates: Vec<CoverCandidateDto> = Vec::new();
        let mut seen_urls = std::collections::HashSet::new();
        let mut add = |found: Vec<CoverCandidateDto>, candidates: &mut Vec<CoverCandidateDto>| {
            for mut cand in found {
                if !seen_urls.insert(cand.full_url.clone()) {
                    continue;
                }
                cand.match_score =
                    cover_query::match_score(album, artist, &cand.title, &cand.artist);
                candidates.push(cand);
            }
        };

        for query in ladder.iter().take(MAX_LADDER_RUNGS) {
            let found = self.query_ladder_rung(query).await;
            add(found, &mut candidates);
            if count_good(&candidates) >= ENOUGH_GOOD_CANDIDATES {
                break;
            }
        }

        if count_good(&candidates) < 2 {
            if let Some(mb) = mb {
                let found = self.query_musicbrainz_covers(mb, album, artist).await;
                add(found, &mut candidates);
            }
        }

        candidates.sort_by_key(|c| std::cmp::Reverse(c.match_score));

        if !candidates.is_empty() {
            self.search_cache
                .lock()
                .await
                .insert(cache_key, candidates.clone());
        }
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

    /// Looks releases up on MusicBrainz and returns the ones that have front art in the
    /// Cover Art Archive. Used when Deezer and iTunes do not know the album (anime and game
    /// soundtracks, small labels).
    async fn query_musicbrainz_covers(
        &self,
        mb: &MusicBrainzClient,
        album: &str,
        artist: &str,
    ) -> Vec<CoverCandidateDto> {
        let head = cover_query::album_variants(album)
            .into_iter()
            .next()
            .unwrap_or_default();
        let primary = cover_query::split_artists(&clean_artist_name(artist))
            .into_iter()
            .next()
            .unwrap_or_default();
        let Ok(releases) = mb.search_releases(&head, &primary).await else {
            return Vec::new();
        };

        let mut out = Vec::new();
        for release in releases.iter().take(MAX_MB_RELEASES) {
            if out.len() >= 3 {
                break;
            }
            let score = cover_query::match_score(album, artist, &release.title, &release.artist);
            if score < MIN_MB_RELEASE_SCORE {
                continue;
            }
            if let Some(cand) = self.caa_front_candidate(release).await {
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
        Some(CoverCandidateDto {
            source: "Cover Art Archive".to_string(),
            title: release.title.clone(),
            artist: release.artist.clone(),
            thumbnail_url: thumb,
            full_url: full,
            width: None,
            height: None,
            match_score: 0,
        })
    }

    /// Public URL of the front cover of a release (after redirects), or `None` when the
    /// Cover Art Archive has none. Used for Discord, which needs a direct public image URL.
    pub async fn release_front_url(&self, mbid: &str) -> Option<String> {
        ensure_safe_token(mbid).ok()?;
        let url = format!("https://coverartarchive.org/release/{mbid}/front-500");
        let resp = tokio::time::timeout(Duration::from_millis(3500), self.http.head(&url).send())
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
    /// (`match_score >= AUTO_ACCEPT_SCORE`). For callers that pick without asking the user:
    /// a wrong cover is worse than none. When no album matches, a song lookup with an exact
    /// artist and title match gives the cover of the album that song is on.
    pub async fn find_best_cover(
        &self,
        album: &str,
        artist: &str,
        title_hint: Option<&str>,
        mb: Option<&MusicBrainzClient>,
    ) -> Option<CoverCandidateDto> {
        if !cover_query::is_unknown_album(album) {
            let candidates = self.search_cover_candidates_with(album, artist, mb).await;
            if let Some(best) = candidates
                .into_iter()
                .find(|c| c.match_score >= AUTO_ACCEPT_SCORE)
            {
                return Some(best);
            }
        }
        let title = title_hint?.trim();
        if title.is_empty() || cover_query::is_neutral_artist(artist) {
            return None;
        }
        self.find_cover_by_song(artist, title).await
    }

    /// iTunes song lookup: accepts only a song whose title and artist match exactly.
    async fn find_cover_by_song(&self, artist: &str, title: &str) -> Option<CoverCandidateDto> {
        let term = format!("{} {}", clean_artist_name(artist), title);
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
            })
        })
    }

    /// GET with the 3.5 s search timeout; `None` on any failure.
    async fn get_json(&self, url: &str) -> Option<serde_json::Value> {
        let resp = tokio::time::timeout(Duration::from_millis(3500), self.http.get(url).send())
            .await
            .ok()?
            .ok()?;
        if !resp.status().is_success() {
            return None;
        }
        resp.json().await.ok()
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
