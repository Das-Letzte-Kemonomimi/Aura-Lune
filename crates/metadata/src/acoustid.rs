//! Integracja z bazą AcoustID oraz narzędziem Chromaprint (`fpcalc`).
//!
//! Pozwala na akustyczną identyfikację nieotagowanych plików audio
//! na podstawie ich fali dźwiękowej (audio fingerprinting) i automatyczne
//! powiązanie z nagraniami i wydaniami MusicBrainz.

use crate::MetadataError;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::Duration;
use tracing::debug;

/// Domyślny publiczny klucz klienta AcoustID dla odtwarzaczy open-source.
pub const DEFAULT_ACOUSTID_CLIENT_KEY: &str = "v8pQ6oyB";
pub const ACOUSTID_API_URL: &str = "https://api.acoustid.org/v2/lookup";

/// Pojedyncze dopasowanie metadanych z bazy AcoustID / MusicBrainz.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TrackFingerprintMatchDto {
    pub acoustid: String,
    pub recording_mbid: Option<String>,
    pub release_mbid: Option<String>,
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub album_artist: Option<String>,
    pub year: Option<i32>,
    pub track_no: Option<i32>,
    pub track_total: Option<i32>,
    pub disc_no: Option<i32>,
    pub score: u32,
}

/// Klient AcoustID do generowania fingerprintu i wyszukiwania metadanych.
#[derive(Clone, Debug)]
pub struct AcoustidClient {
    http: reqwest::Client,
    client_key: String,
}

impl Default for AcoustidClient {
    fn default() -> Self {
        Self::new(None)
    }
}

impl AcoustidClient {
    pub fn new(client_key: Option<String>) -> Self {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(12))
            .build()
            .unwrap_or_default();

        Self {
            http,
            client_key: client_key
                .filter(|k| !k.trim().is_empty())
                .unwrap_or_else(|| DEFAULT_ACOUSTID_CLIENT_KEY.to_string()),
        }
    }

    /// Sprawdza, czy w systemie dostępne jest narzędzie `fpcalc`.
    pub async fn is_fpcalc_available() -> bool {
        match tokio::process::Command::new("fpcalc")
            .arg("-v")
            .output()
            .await
        {
            Ok(output) => output.status.success(),
            Err(_) => false,
        }
    }

    /// Generuje fingerprint Chromaprint i czas trwania za pomocą narzędzia `fpcalc`.
    pub async fn generate_fingerprint(path: &Path) -> Result<(f64, String), MetadataError> {
        if !path.exists() {
            return Err(MetadataError::AcoustId(format!(
                "Plik audio nie istnieje: {}",
                path.display()
            )));
        }

        let output = tokio::process::Command::new("fpcalc")
            .arg("-json")
            .arg(path)
            .output()
            .await
            .map_err(|e| {
                MetadataError::AcoustId(format!(
                    "Nie udało się uruchomić 'fpcalc' (zainstaluj pakiet chromaprint): {}",
                    e
                ))
            })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(MetadataError::AcoustId(format!(
                "Błąd 'fpcalc': {}",
                stderr.trim()
            )));
        }

        let parsed: serde_json::Value = serde_json::from_slice(&output.stdout).map_err(|e| {
            MetadataError::AcoustId(format!("Błąd parsowania wyniku fpcalc: {}", e))
        })?;

        let duration = parsed
            .get("duration")
            .and_then(|d| d.as_f64())
            .ok_or_else(|| {
                MetadataError::AcoustId("fpcalc nie zwrócił pola 'duration'".to_string())
            })?;

        let fingerprint = parsed
            .get("fingerprint")
            .and_then(|f| f.as_str())
            .ok_or_else(|| {
                MetadataError::AcoustId("fpcalc nie zwrócił pola 'fingerprint'".to_string())
            })?
            .to_string();

        debug!(
            "Wygenerowano fingerprint Chromaprint dla {}: czas={:.1}s, fp_len={}",
            path.display(),
            duration,
            fingerprint.len()
        );

        Ok((duration, fingerprint))
    }

    /// Odpytuje web service AcoustID o metadane na podstawie fingerprintu i czasu trwania.
    pub async fn lookup(
        &self,
        duration: f64,
        fingerprint: &str,
    ) -> Result<Vec<TrackFingerprintMatchDto>, MetadataError> {
        let duration_secs = duration.round() as u64;

        let params = [
            ("client", self.client_key.as_str()),
            ("duration", &duration_secs.to_string()),
            ("fingerprint", fingerprint),
            ("meta", "recordings releases tracks"),
            ("format", "json"),
        ];

        let resp = self
            .http
            .post(ACOUSTID_API_URL)
            .form(&params)
            .send()
            .await?;

        if !resp.status().is_success() {
            return Err(MetadataError::AcoustId(format!(
                "Serwer AcoustID zwrócił kod HTTP: {}",
                resp.status()
            )));
        }

        let body: serde_json::Value = resp.json().await?;

        if let Some(err_obj) = body.get("error") {
            let msg = err_obj
                .get("message")
                .and_then(|m| m.as_str())
                .unwrap_or("Nieznany błąd AcoustID");
            return Err(MetadataError::AcoustId(msg.to_string()));
        }

        Ok(Self::parse_acoustid_response(&body))
    }

    /// Parsuje odpowiedź JSON z AcoustID do listy kandydatów posortowanych wg zgodności.
    pub fn parse_acoustid_response(json: &serde_json::Value) -> Vec<TrackFingerprintMatchDto> {
        let mut results = Vec::new();

        let raw_results = match json.get("results").and_then(|r| r.as_array()) {
            Some(arr) => arr,
            None => return results,
        };

        for item in raw_results {
            let acoustid = match item.get("id").and_then(|id| id.as_str()) {
                Some(id) => id.to_string(),
                None => continue,
            };

            let score_raw = item.get("score").and_then(|s| s.as_f64()).unwrap_or(0.0);
            let score = (score_raw * 100.0).clamp(0.0, 100.0) as u32;

            if let Some(recordings) = item.get("recordings").and_then(|rec| rec.as_array()) {
                for rec in recordings {
                    let recording_mbid = rec
                        .get("id")
                        .and_then(|id| id.as_str())
                        .map(|s| s.to_string());
                    let title = match rec.get("title").and_then(|t| t.as_str()) {
                        Some(t) => t.to_string(),
                        None => continue,
                    };

                    let artist = rec
                        .get("artists")
                        .and_then(|a| a.as_array())
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|artist_obj| {
                                    artist_obj.get("name").and_then(|n| n.as_str())
                                })
                                .collect::<Vec<_>>()
                                .join(", ")
                        })
                        .filter(|s| !s.is_empty())
                        .unwrap_or_else(|| "Nieznany wykonawca".to_string());

                    // Szukamy wydań (releases)
                    if let Some(releases) = rec.get("releases").and_then(|rel| rel.as_array()) {
                        for rel in releases {
                            let release_mbid = rel
                                .get("id")
                                .and_then(|id| id.as_str())
                                .map(|s| s.to_string());
                            let album = rel
                                .get("title")
                                .and_then(|t| t.as_str())
                                .map(|s| s.to_string());
                            let album_artist = rel
                                .get("artists")
                                .and_then(|a| a.as_array())
                                .map(|arr| {
                                    arr.iter()
                                        .filter_map(|artist_obj| {
                                            artist_obj.get("name").and_then(|n| n.as_str())
                                        })
                                        .collect::<Vec<_>>()
                                        .join(", ")
                                })
                                .filter(|s| !s.is_empty());

                            let year = rel
                                .get("date")
                                .and_then(|d| d.get("year"))
                                .and_then(|y| y.as_i64())
                                .map(|y| y as i32);

                            let track_total = rel
                                .get("track_count")
                                .and_then(|tc| tc.as_i64())
                                .map(|tc| tc as i32);

                            let (disc_no, track_no) = rel
                                .get("mediums")
                                .and_then(|m| m.as_array())
                                .and_then(|arr| arr.first())
                                .map(|medium| {
                                    let disc = medium
                                        .get("position")
                                        .and_then(|p| p.as_i64())
                                        .map(|p| p as i32);
                                    let track = medium
                                        .get("tracks")
                                        .and_then(|tr| tr.as_array())
                                        .and_then(|tr_arr| tr_arr.first())
                                        .and_then(|t| t.get("position"))
                                        .and_then(|p| p.as_i64())
                                        .map(|p| p as i32);
                                    (disc, track)
                                })
                                .unwrap_or((None, None));

                            results.push(TrackFingerprintMatchDto {
                                acoustid: acoustid.clone(),
                                recording_mbid: recording_mbid.clone(),
                                release_mbid,
                                title: title.clone(),
                                artist: artist.clone(),
                                album,
                                album_artist,
                                year,
                                track_no,
                                track_total,
                                disc_no,
                                score,
                            });
                        }
                    } else {
                        // Jeśli brak release, dodajemy chociaż samo recording
                        results.push(TrackFingerprintMatchDto {
                            acoustid: acoustid.clone(),
                            recording_mbid,
                            release_mbid: None,
                            title,
                            artist,
                            album: None,
                            album_artist: None,
                            year: None,
                            track_no: None,
                            track_total: None,
                            disc_no: None,
                            score,
                        });
                    }
                }
            }
        }

        // Deduplikacja i sortowanie według score malejąco
        results.sort_by_key(|r| std::cmp::Reverse(r.score));
        results.dedup_by(|a, b| {
            a.title.to_lowercase() == b.title.to_lowercase()
                && a.artist.to_lowercase() == b.artist.to_lowercase()
                && a.album.as_deref().unwrap_or("").to_lowercase()
                    == b.album.as_deref().unwrap_or("").to_lowercase()
        });

        results
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_acoustid_response() {
        let sample_json = serde_json::json!({
            "status": "ok",
            "results": [
                {
                    "id": "8d2a117d-37a1-4b84-9840-94fe4050c923",
                    "score": 0.969,
                    "recordings": [
                        {
                            "id": "7152b32c-28a6-49f9-9c8c-137fbeedd02e",
                            "title": "Omnia Sol Temperat",
                            "artists": [{ "id": "1", "name": "In Extremo" }],
                            "releases": [
                                {
                                    "id": "eb49df1b-b398-49b6-b1e6-cd55caf1d401",
                                    "title": "Raue Spree 2005",
                                    "date": { "year": 2006, "month": 2, "day": 10 },
                                    "track_count": 24,
                                    "mediums": [
                                        {
                                            "position": 1,
                                            "tracks": [{ "position": 8, "title": "Omnia Sol Temperat" }]
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        });

        let matches = AcoustidClient::parse_acoustid_response(&sample_json);
        assert_eq!(matches.len(), 1);
        let m = &matches[0];
        assert_eq!(m.title, "Omnia Sol Temperat");
        assert_eq!(m.artist, "In Extremo");
        assert_eq!(m.album.as_deref(), Some("Raue Spree 2005"));
        assert_eq!(m.year, Some(2006));
        assert_eq!(m.track_no, Some(8));
        assert_eq!(m.track_total, Some(24));
        assert_eq!(m.disc_no, Some(1));
        assert_eq!(m.score, 96);
    }

    #[tokio::test]
    async fn test_generate_fingerprint_fixture() {
        if !AcoustidClient::is_fpcalc_available().await {
            eprintln!("fpcalc not installed, skipping test");
            return;
        }

        let fixture_path = Path::new("../../tests/fixtures/08. Omnia Sol Temperat.flac");
        if !fixture_path.exists() {
            eprintln!("Fixture not found at {:?}, skipping", fixture_path);
            return;
        }

        let res = AcoustidClient::generate_fingerprint(fixture_path).await;
        assert!(
            res.is_ok(),
            "generate_fingerprint should succeed on sample FLAC"
        );
        let (duration, fingerprint) = res.unwrap();
        assert!(duration > 200.0);
        assert!(!fingerprint.is_empty());
    }
}
