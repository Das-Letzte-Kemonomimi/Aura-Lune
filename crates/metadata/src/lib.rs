//! Moduł integracji metadanych MusicBrainz oraz Cover Art Archive.
//!
//! Zgodnie z ADR 0007 i AGENTS.md:
//! - Identyfikacja wydań muzycznych przez identyfikatory MBID,
//! - Jawny User-Agent z wersją i adresem projektu (`http::USER_AGENT`),
//! - Ograniczenie zapytań (rate limiting 1 req/s na serwer MusicBrainz),
//! - Zwracanie kandydatów wydań do potwierdzenia przy niejednoznacznym dopasowaniu,
//! - Pobieranie i lokalne buforowanie okładek z Cover Art Archive.

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
    #[error("Błąd sieciowy HTTP: {0}")]
    Network(#[from] reqwest::Error),
    #[error("Błąd parsowania JSON: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Błąd operacji wejścia/wyjścia (I/O): {0}")]
    Io(#[from] std::io::Error),
    #[error("Nie znaleziono okładki dla wydania MBID: {0}")]
    CoverNotFound(String),
    #[error("Błąd zapytania MusicBrainz: {0}")]
    Query(String),
    #[error("Błąd AcoustID / Chromaprint: {0}")]
    AcoustId(String),
}

/// Błędy klientów scrobblingu (Last.fm, ListenBrainz).
#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum ScrobbleError {
    /// Brakujące lub puste dane wejściowe (token, klucz sesji).
    #[error("{0}")]
    Validation(String),
    /// Brak połączenia / błąd transportu HTTP.
    #[error("{0}")]
    Network(String),
    /// Nieoczekiwany format odpowiedzi.
    #[error("{0}")]
    Parse(String),
    /// Serwis odpowiedział błędem (kod HTTP, nieprawidłowy token, odrzucony scrobble).
    #[error("{0}")]
    Service(String),
}

/// Reprezentacja kandydata wydania z MusicBrainz.
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

/// Kandydat okładki do wyboru w oknie dialogowym (w stylu Poweramp Cover Art Picker).
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

/// Klient API MusicBrainz.
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
            // MusicBrainz: najwyżej 1 zapytanie na sekundę.
            limiter: Arc::new(http::RateLimiter::new(Duration::from_millis(1050))),
        }
    }

    /// Zapewnia przestrzeganie limitu 1 zapytania na sekundę (MusicBrainz Rate Limit).
    async fn wait_rate_limit(&self) {
        self.limiter.wait().await;
    }

    /// Wyszukuje wydania na podstawie tytułu albumu i artysty.
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
                "Serwer MusicBrainz zwrócił kod HTTP: {}",
                resp.status()
            )));
        }

        let body: serde_json::Value = resp.json().await?;
        Ok(Self::parse_release_candidates(&body))
    }

    /// Parsuje odpowiedź JSON z MusicBrainz do listy kandydatów.
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
                    .unwrap_or("Nieznany album")
                    .to_string();

                let artist = r
                    .get("artist-credit")
                    .and_then(|ac| ac.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|obj| obj.get("name"))
                    .and_then(|n| n.as_str())
                    .unwrap_or("Nieznany wykonawca")
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

/// Czyści tytuł albumu ze zbędnego szumu (nawiasy, dopiski remasterów, wydania specjalne, dyski),
/// aby serwisy muzyczne (Deezer, Apple Music, MusicBrainz) mogły precyzyjnie znaleźć oryginalne wydanie.
pub fn clean_album_title(title: &str) -> String {
    // 1. Usunięcie zawartości w nawiasach okrągłych (), kwadratowych [] i klamrowych {}
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

    // 2. Usunięcie typowych słów-kluczy szumu, gdyby nie były w nawiasach. Dopasowanie po
    //    całych słowach (bez rozróżniania wielkości liter): "Ghost" ani "Lost" nie tracą "ost",
    //    a znaki, których małe litery mają inną długość (np. "İ"), nie psują indeksów.
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

/// Czyści nazwę wykonawcy z nawiasów i szumu.
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

/// Klient Cover Art Archive odpowiedzialny za pobieranie i lokalne buforowanie okładek.
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

    /// Pobiera okładkę (front thumbnail 500px) dla danego MBID i zapisuje w pamięci podręcznej.
    /// Jeśli okładka jest już w cache, natychmiast zwraca istniejącą ścieżkę.
    pub async fn fetch_and_cache_cover(&self, mbid: &str) -> Result<PathBuf, MetadataError> {
        ensure_safe_token(mbid)?;
        let covers_dir = self.cache_dir.join("covers");
        tokio::fs::create_dir_all(&covers_dir).await?;

        let cached_file = covers_dir.join(format!("{}.jpg", mbid));
        if cached_file.exists() {
            debug!("Cover Art Cache Hit: {:?}", cached_file);
            return Ok(cached_file);
        }

        // Pobieranie miniatury 500px lub front cover
        let url = format!("https://coverartarchive.org/release/{}/front-500", mbid);
        info!("Pobieranie okładki z Cover Art Archive: {}", url);

        let resp = self.http.get(&url).send().await?;

        if !resp.status().is_success() {
            warn!(
                "Brak okładki w Cover Art Archive (HTTP {}) dla MBID: {}",
                resp.status(),
                mbid
            );
            return Err(MetadataError::CoverNotFound(mbid.to_string()));
        }

        let bytes = read_image_body(resp).await?;
        if bytes.is_empty() {
            return Err(MetadataError::CoverNotFound(mbid.to_string()));
        }

        // Zapis do pliku tymczasowego i atomowa zmiana nazwy
        let temp_file = covers_dir.join(format!("{}.tmp", mbid));
        tokio::fs::write(&temp_file, &bytes).await?;
        tokio::fs::rename(&temp_file, &cached_file).await?;

        info!("Okładka zapisana w pamięci podręcznej: {:?}", cached_file);
        Ok(cached_file)
    }

    async fn query_deezer(
        &self,
        url: &str,
        default_album: &str,
        default_artist: &str,
    ) -> Vec<CoverCandidateDto> {
        debug!("Wyszukiwanie okładek Deezer: {}", url);
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
        debug!("Wyszukiwanie okładek iTunes: {}", url);
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

    /// Wyszukuje kandydatów na okładki w internecie (Deezer, Apple Music / iTunes) w stylu Poweramp Cover Art Picker.
    /// Zapytania do serwisów są wykonywane współbieżnie (równolegle), z natychmiastowym buforowaniem w pamięci RAM.
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

        // 1. Sprawdź szybki cache pamięci podręcznej (0ms)
        {
            let cache = self.search_cache.lock().await;
            if let Some(cached) = cache.get(&cache_key) {
                debug!(
                    "Cover Art Search Cache Hit dla: '{}' / '{}'",
                    clean_album, clean_artist
                );
                return cached.clone();
            }
        }

        // 2. Przygotuj równoległe zapytania do Deezer i iTunes/Apple Music
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

        // Równoległe pobieranie (concurrent tokio::join!)
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

        // Fallback dla raw query jeśli wyczyszczone dało niewiele wyników
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

        // Ranking i sortowanie (dokładne dopasowanie tytułu i wykonawcy na pierwszym miejscu)
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

        // Zapisz w pamięci podręcznej dla natychmiastowych ponownych otwarć
        {
            let mut cache = self.search_cache.lock().await;
            cache.insert(cache_key, candidates.clone());
        }

        candidates
    }

    /// Pobiera okładkę ze wskazanego bezpośredniego adresu URL i zapisuje pod wybranym stemem pliku w pamięci podręcznej.
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
            "Pobieranie okładki z URL: {} do pliku: {:?}",
            url, cached_file
        );

        let resp = self.http.get(url).send().await?;

        if !resp.status().is_success() {
            return Err(MetadataError::Query(format!(
                "Serwer zwrócił kod HTTP: {} podczas pobierania okładki",
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

        info!("Okładka zapisana pomyślnie: {:?}", cached_file);
        Ok(cached_file)
    }

    /// Zapisuje plik własnej okładki z lokalnego dysku do katalogu pamięci podręcznej okładek Auralune.
    pub async fn save_custom_cover_file(
        &self,
        album_id: i64,
        source_path: impl AsRef<Path>,
    ) -> Result<PathBuf, MetadataError> {
        let src = source_path.as_ref();
        if !src.exists() {
            return Err(MetadataError::Io(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "Wskazany plik graficzny nie istnieje",
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
            "Zapisano własną okładkę dla albumu #{}: {:?}",
            album_id, cached_file
        );
        Ok(cached_file)
    }

    /// Zapisuje dane binarne własnej okładki (np. z przeciągniętego pliku / inputu) do pamięci podręcznej.
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
            "Zapisano własną okładkę z danych binarnych dla albumu #{}: {:?}",
            album_id, cached_file
        );
        Ok(cached_file)
    }
}

// Prosta funkcja kodowania URL bez potrzeby dodatkowych dużych zależności
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

/// Maksymalny rozmiar pobieranej okładki (chroni przed zapełnieniem pamięci i dysku).
pub const MAX_COVER_BYTES: u64 = 20 * 1024 * 1024;
const IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "webp", "gif"];

/// Identyfikator używany w nazwie pliku okładki (MBID, `album_<id>`) nie może zawierać
/// separatorów ścieżki ani `..`.
fn ensure_safe_token(token: &str) -> Result<(), MetadataError> {
    if domain::paths::is_safe_file_token(token) {
        Ok(())
    } else {
        Err(MetadataError::Query(format!(
            "Niedozwolony identyfikator okładki: {token:?}"
        )))
    }
}

/// Rozszerzenie pliku okładki z listy dozwolonych (zwraca je małymi literami).
fn image_extension(ext: &str) -> Result<String, MetadataError> {
    let lower = ext.to_ascii_lowercase();
    if IMAGE_EXTENSIONS.contains(&lower.as_str()) {
        Ok(lower)
    } else {
        Err(MetadataError::Query(format!(
            "Nieobsługiwany format okładki: .{ext}"
        )))
    }
}

/// Czyta odpowiedź z okładką: wymaga typu `image/*` (gdy serwer go podaje) i limitu rozmiaru.
async fn read_image_body(resp: reqwest::Response) -> Result<Vec<u8>, MetadataError> {
    let content_type = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_ascii_lowercase();
    if !content_type.is_empty() && !content_type.starts_with("image/") {
        return Err(MetadataError::Query(format!(
            "Serwer zwrócił {content_type} zamiast obrazu okładki"
        )));
    }
    if resp
        .content_length()
        .is_some_and(|len| len > MAX_COVER_BYTES)
    {
        return Err(MetadataError::Query("Okładka przekracza 20 MB".into()));
    }
    // Strumieniowo: serwer bez Content-Length (chunked) też nie przekroczy limitu.
    let mut resp = resp;
    let mut bytes = Vec::new();
    while let Some(chunk) = resp.chunk().await? {
        if bytes.len() as u64 + chunk.len() as u64 > MAX_COVER_BYTES {
            return Err(MetadataError::Query("Okładka przekracza 20 MB".into()));
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}
