//! Moduł integracji metadanych MusicBrainz oraz Cover Art Archive.
//!
//! Zgodnie z ADR 0007 i AGENTS.md:
//! - Identyfikacja wydań muzycznych przez identyfikatory MBID,
//! - Jawny User-Agent ("Auralune/0.1.0 ( https://github.com/Auralune/Auralune )"),
//! - Ograniczenie zapytań (rate limiting 1 req/s na serwer MusicBrainz),
//! - Zwracanie kandydatów wydań do potwierdzenia przy niejednoznacznym dopasowaniu,
//! - Pobieranie i lokalne buforowanie okładek z Cover Art Archive.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant};
use thiserror::Error;
use tokio::sync::Mutex;
use tracing::{debug, info, warn};

pub mod listenbrainz;
pub mod lyrics;
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
    user_agent: String,
    last_request: Arc<Mutex<Option<Instant>>>,
}

impl Default for MusicBrainzClient {
    fn default() -> Self {
        Self::new()
    }
}

impl MusicBrainzClient {
    pub fn new() -> Self {
        let user_agent = "Auralune/0.1.0 ( https://github.com/Auralune/Auralune )".to_string();
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .unwrap_or_default();

        Self {
            http,
            user_agent,
            last_request: Arc::new(Mutex::new(None)),
        }
    }

    /// Zapewnia przestrzeganie limitu 1 zapytania na sekundę (MusicBrainz Rate Limit).
    async fn wait_rate_limit(&self) {
        let mut last = self.last_request.lock().await;
        if let Some(t) = *last {
            let elapsed = t.elapsed();
            if elapsed < Duration::from_millis(1050) {
                tokio::time::sleep(Duration::from_millis(1050) - elapsed).await;
            }
        }
        *last = Some(Instant::now());
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

        let resp = self
            .http
            .get(&url)
            .header("User-Agent", &self.user_agent)
            .header("Accept", "application/json")
            .send()
            .await?;

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

    let mut result = cleaned;
    // 2. Usunięcie typowych słów-kluczy szumu, gdyby nie były w nawiasach
    let noise_patterns = [
        "remastered",
        "remaster",
        "deluxe edition",
        "deluxe",
        "special edition",
        "anniversary edition",
        "expanded edition",
        "bonus tracks",
        "bonus track",
        "original soundtrack",
        "soundtrack",
        "ost",
        "disc 1",
        "disc 2",
        "disc 3",
        "cd 1",
        "cd 2",
        "cd 3",
        "cd1",
        "cd2",
    ];

    for pat in noise_patterns {
        let lower = result.to_lowercase();
        if let Some(pos) = lower.find(pat) {
            result = format!("{} {}", &result[..pos], &result[pos + pat.len()..]);
        }
    }

    let words: Vec<&str> = result.split_whitespace().collect();
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
}

impl CoverArtArchiveClient {
    pub fn new(cache_dir: impl AsRef<Path>) -> Self {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .build()
            .unwrap_or_default();

        Self {
            http,
            cache_dir: cache_dir.as_ref().to_path_buf(),
        }
    }

    /// Pobiera okładkę (front thumbnail 500px) dla danego MBID i zapisuje w pamięci podręcznej.
    /// Jeśli okładka jest już w cache, natychmiast zwraca istniejącą ścieżkę.
    pub async fn fetch_and_cache_cover(&self, mbid: &str) -> Result<PathBuf, MetadataError> {
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

        let resp = self
            .http
            .get(&url)
            .header("User-Agent", "Auralune/0.1.0")
            .send()
            .await?;

        if !resp.status().is_success() {
            warn!(
                "Brak okładki w Cover Art Archive (HTTP {}) dla MBID: {}",
                resp.status(),
                mbid
            );
            return Err(MetadataError::CoverNotFound(mbid.to_string()));
        }

        let bytes = resp.bytes().await?;
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
        candidates: &mut Vec<CoverCandidateDto>,
        seen_urls: &mut std::collections::HashSet<String>,
    ) {
        debug!("Wyszukiwanie okładek Deezer: {}", url);
        if let Ok(resp) = self
            .http
            .get(url)
            .header("User-Agent", "Auralune/0.1.0")
            .send()
            .await
        {
            if resp.status().is_success() {
                if let Ok(json) = resp.json::<serde_json::Value>().await {
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
                                if seen_urls.insert(full.to_string()) {
                                    candidates.push(CoverCandidateDto {
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
                    }
                }
            }
        }
    }

    async fn query_itunes(
        &self,
        url: &str,
        default_album: &str,
        default_artist: &str,
        candidates: &mut Vec<CoverCandidateDto>,
        seen_urls: &mut std::collections::HashSet<String>,
    ) {
        debug!("Wyszukiwanie okładek iTunes: {}", url);
        if let Ok(resp) = self
            .http
            .get(url)
            .header("User-Agent", "Auralune/0.1.0")
            .send()
            .await
        {
            if resp.status().is_success() {
                if let Ok(json) = resp.json::<serde_json::Value>().await {
                    if let Some(results) = json.get("results").and_then(|r| r.as_array()) {
                        for res in results {
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
                                if seen_urls.insert(full.clone()) {
                                    candidates.push(CoverCandidateDto {
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
                    }
                }
            }
        }
    }

    /// Wyszukuje kandydatów na okładki w internecie (Deezer, Apple Music / iTunes) w stylu Poweramp Cover Art Picker.
    pub async fn search_cover_candidates(
        &self,
        album: &str,
        artist: &str,
    ) -> Vec<CoverCandidateDto> {
        let clean_album = clean_album_title(album);
        let clean_artist = clean_artist_name(artist);
        let raw_album = album.trim();
        let raw_artist = artist.trim();

        let mut candidates = Vec::new();
        let mut seen_urls = std::collections::HashSet::new();

        // 1. DEEZER API - doskonała jakość 1000x1000 i szeroki europejski i światowy katalog
        if !clean_artist.is_empty() && !clean_album.is_empty() {
            let deezer_adv = format!(
                "https://api.deezer.com/search/album?q=artist:\"{}\" album:\"{}\"&limit=10",
                urlencoding::encode(&clean_artist),
                urlencoding::encode(&clean_album)
            );
            self.query_deezer(&deezer_adv, album, artist, &mut candidates, &mut seen_urls)
                .await;
        }

        let deezer_general = format!("{} {}", clean_artist, clean_album)
            .trim()
            .to_string();
        if !deezer_general.is_empty() {
            let deezer_url = format!(
                "https://api.deezer.com/search/album?q={}&limit=10",
                urlencoding::encode(&deezer_general)
            );
            self.query_deezer(&deezer_url, album, artist, &mut candidates, &mut seen_urls)
                .await;
        }

        if candidates.is_empty() && !clean_album.is_empty() {
            let deezer_album_only = format!(
                "https://api.deezer.com/search/album?q=album:\"{}\"&limit=6",
                urlencoding::encode(&clean_album)
            );
            self.query_deezer(
                &deezer_album_only,
                album,
                artist,
                &mut candidates,
                &mut seen_urls,
            )
            .await;
        }

        // 2. APPLE MUSIC / ITUNES SEARCH API (do 1200x1200px artwork)
        let itunes_queries = vec![
            format!("{} {}", clean_album, clean_artist)
                .trim()
                .to_string(),
            format!("{} {}", clean_artist, clean_album)
                .trim()
                .to_string(),
        ];

        for q in itunes_queries {
            if q.is_empty() {
                continue;
            }
            let itunes_url = format!(
                "https://itunes.apple.com/search?term={}&entity=album&limit=8",
                urlencoding::encode(&q)
            );
            self.query_itunes(&itunes_url, album, artist, &mut candidates, &mut seen_urls)
                .await;
            if candidates.len() >= 12 {
                break;
            }
        }

        // Fallback dla raw query jeśli wyczyszczone dało niewiele wyników
        if candidates.len() < 4 && raw_album != clean_album {
            let raw_q = format!("{} {}", raw_album, raw_artist).trim().to_string();
            let itunes_raw_url = format!(
                "https://itunes.apple.com/search?term={}&entity=album&limit=6",
                urlencoding::encode(&raw_q)
            );
            self.query_itunes(
                &itunes_raw_url,
                album,
                artist,
                &mut candidates,
                &mut seen_urls,
            )
            .await;
        }

        // 3. RANKING I SORTOWANIE (dokładne dopasowanie tytułu i wykonawcy na pierwszym miejscu)
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

        candidates
    }

    /// Pobiera okładkę ze wskazanego bezpośredniego adresu URL i zapisuje pod wybranym stemem pliku w pamięci podręcznej.
    pub async fn download_cover_from_url(
        &self,
        url: &str,
        file_stem: &str,
    ) -> Result<PathBuf, MetadataError> {
        let covers_dir = self.cache_dir.join("covers");
        tokio::fs::create_dir_all(&covers_dir).await?;

        let cached_file = covers_dir.join(format!("{}.jpg", file_stem));
        info!(
            "Pobieranie okładki z URL: {} do pliku: {:?}",
            url, cached_file
        );

        let resp = self
            .http
            .get(url)
            .header("User-Agent", "Auralune/0.1.0")
            .send()
            .await?;

        if !resp.status().is_success() {
            return Err(MetadataError::Query(format!(
                "Serwer zwrócił kod HTTP: {} podczas pobierania okładki",
                resp.status()
            )));
        }

        let bytes = resp.bytes().await?;
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
        let ext = src
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("jpg")
            .to_lowercase();
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
        let clean_ext = if ext.is_empty() { "jpg" } else { ext };
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
mod urlencoding {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_release_candidates() {
        let sample_json = serde_json::json!({
            "releases": [
                {
                    "id": "c3d4e5f6-7890-4123-8abc-def123456789",
                    "title": "Your Name.",
                    "artist-credit": [{ "name": "RADWIMPS" }],
                    "date": "2016-08-24",
                    "country": "JP",
                    "track-count": 27,
                    "score": 100
                },
                {
                    "id": "11223344-5566-7788-9900-aabbccddeeff",
                    "title": "Your Name. (Deluxe Edition)",
                    "artist-credit": [{ "name": "RADWIMPS" }],
                    "date": "2017-04-14",
                    "country": "US",
                    "track-count": 30,
                    "score": 85
                }
            ]
        });

        let candidates = MusicBrainzClient::parse_release_candidates(&sample_json);
        assert_eq!(candidates.len(), 2);
        assert_eq!(candidates[0].mbid, "c3d4e5f6-7890-4123-8abc-def123456789");
        assert_eq!(candidates[0].score, 100);
        assert_eq!(candidates[0].track_count, Some(27));
        assert_eq!(candidates[0].artist, "RADWIMPS");
        assert_eq!(candidates[1].score, 85);
    }

    #[test]
    fn test_url_encoding() {
        let encoded = urlencoding::encode("release:\"Your Name.\" AND artist:\"RADWIMPS\"");
        assert!(encoded.contains("%22Your%20Name.%22"));
        assert!(encoded.contains("AND"));
        assert!(encoded.contains("%22RADWIMPS%22"));
    }

    #[tokio::test]
    async fn test_cover_art_archive_cache_hit() {
        let temp_dir = std::env::temp_dir().join("auralune_test_cover_cache");
        let covers_dir = temp_dir.join("covers");
        tokio::fs::create_dir_all(&covers_dir).await.unwrap();

        let fake_mbid = "test-mbid-1234";
        let fake_cover = covers_dir.join(format!("{}.jpg", fake_mbid));
        tokio::fs::write(&fake_cover, b"FAKE_JPEG_IMAGE_DATA")
            .await
            .unwrap();

        let client = CoverArtArchiveClient::new(&temp_dir);
        let path = client.fetch_and_cache_cover(fake_mbid).await.unwrap();

        assert_eq!(path, fake_cover);
        assert!(path.exists());

        // Czyszczenie
        let _ = tokio::fs::remove_dir_all(&temp_dir).await;
    }

    #[test]
    fn test_clean_album_title() {
        assert_eq!(clean_album_title("7 (2015 Remastered)"), "7");
        assert_eq!(
            clean_album_title("Master of Puppets [Remastered]"),
            "Master of Puppets"
        );
        assert_eq!(
            clean_album_title("OK Computer (Collector's Edition) [Disc 1]"),
            "OK Computer"
        );
        assert_eq!(
            clean_album_title("Hybrid Theory (Deluxe Edition)"),
            "Hybrid Theory"
        );
        assert_eq!(clean_album_title("7"), "7");
        assert_eq!(clean_album_title("( )"), "( )");
    }

    #[test]
    fn test_clean_artist_name() {
        assert_eq!(clean_artist_name("In Extremo (Live)"), "In Extremo");
        assert_eq!(clean_artist_name("Linkin Park"), "Linkin Park");
    }

    #[tokio::test]
    async fn test_search_cover_candidates_online_in_extremo() {
        let temp_dir = std::env::temp_dir().join("auralune_test_cover_candidates");
        let client = CoverArtArchiveClient::new(&temp_dir);
        let candidates = client
            .search_cover_candidates("7 (2015 Remastered)", "In Extremo")
            .await;
        assert!(
            !candidates.is_empty(),
            "Kandydaci okładek dla '7' In Extremo powinni zostać znalezieni!"
        );
        let first = &candidates[0];
        assert_eq!(first.title, "7");
        assert_eq!(first.artist, "In Extremo");
        assert!(first.full_url.contains("1000x1000") || first.full_url.contains("1200x1200"));
    }
}
