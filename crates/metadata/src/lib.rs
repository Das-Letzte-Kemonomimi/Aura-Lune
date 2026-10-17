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
}
