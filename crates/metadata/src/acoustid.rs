//! AcoustID and Chromaprint (`fpcalc`) integration.
//!
//! Identifies untagged audio files acoustically from their waveform
//! (audio fingerprinting) and links them automatically
//! to MusicBrainz recordings and releases.

use crate::MetadataError;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::Duration;
use tracing::debug;

/// Default public AcoustID client key for open-source players.
pub const DEFAULT_ACOUSTID_CLIENT_KEY: &str = "v8pQ6oyB";
pub const ACOUSTID_API_URL: &str = "https://api.acoustid.org/v2/lookup";

/// A single metadata match from the AcoustID / MusicBrainz database.
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

/// Maximum `fpcalc` run time for a single file.
pub const FPCALC_TIMEOUT: Duration = Duration::from_secs(60);

/// AcoustID client for generating fingerprints and searching metadata.
#[derive(Clone, Debug)]
pub struct AcoustidClient {
    http: reqwest::Client,
    client_key: String,
    /// AcoustID: at most 3 requests per second (shared by client clones).
    limiter: std::sync::Arc<crate::http::RateLimiter>,
}

impl Default for AcoustidClient {
    fn default() -> Self {
        Self::new(None)
    }
}

impl AcoustidClient {
    pub fn new(client_key: Option<String>) -> Self {
        let http = crate::http::build_client(Duration::from_secs(12));

        Self {
            http,
            client_key: client_key
                .filter(|k| !k.trim().is_empty())
                .unwrap_or_else(|| DEFAULT_ACOUSTID_CLIENT_KEY.to_string()),
            limiter: std::sync::Arc::new(crate::http::RateLimiter::new(Duration::from_millis(340))),
        }
    }

    /// Checks whether the `fpcalc` tool is available on the system.
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

    /// Generates a Chromaprint fingerprint and the duration with the `fpcalc` tool.
    pub async fn generate_fingerprint(path: &Path) -> Result<(f64, String), MetadataError> {
        if !path.exists() {
            return Err(MetadataError::AcoustId(format!(
                "Audio file does not exist: {}",
                path.display()
            )));
        }

        // Timeout: a hung fpcalc (e.g. a damaged file) does not block identification forever.
        // A path starting with `-` would be read by fpcalc as an option.
        let path_arg = if path.as_os_str().to_string_lossy().starts_with('-') {
            Path::new(".").join(path)
        } else {
            path.to_path_buf()
        };
        let run = tokio::process::Command::new("fpcalc")
            .arg("-json")
            .arg(&path_arg)
            .kill_on_drop(true)
            .output();
        let output = tokio::time::timeout(FPCALC_TIMEOUT, run)
            .await
            .map_err(|_| {
                MetadataError::AcoustId(format!(
                    "fpcalc did not finish within {} s",
                    FPCALC_TIMEOUT.as_secs()
                ))
            })?
            .map_err(|e| {
                MetadataError::AcoustId(format!(
                    "Failed to run 'fpcalc' (install the chromaprint package): {}",
                    e
                ))
            })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(MetadataError::AcoustId(format!(
                "'fpcalc' error: {}",
                stderr.trim()
            )));
        }

        let parsed: serde_json::Value = serde_json::from_slice(&output.stdout).map_err(|e| {
            MetadataError::AcoustId(format!("Failed to parse the fpcalc output: {}", e))
        })?;

        let duration = parsed
            .get("duration")
            .and_then(|d| d.as_f64())
            .ok_or_else(|| {
                MetadataError::AcoustId("fpcalc returned no 'duration' field".to_string())
            })?;

        let fingerprint = parsed
            .get("fingerprint")
            .and_then(|f| f.as_str())
            .ok_or_else(|| {
                MetadataError::AcoustId("fpcalc returned no 'fingerprint' field".to_string())
            })?
            .to_string();

        debug!(
            "Generated a Chromaprint fingerprint for {}: duration={:.1}s, fp_len={}",
            path.display(),
            duration,
            fingerprint.len()
        );

        Ok((duration, fingerprint))
    }

    /// Queries the AcoustID web service for metadata from a fingerprint and duration.
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

        self.limiter.wait().await;
        let resp =
            crate::http::send_with_retry(self.http.post(ACOUSTID_API_URL).form(&params)).await?;

        if !resp.status().is_success() {
            return Err(MetadataError::AcoustId(format!(
                "AcoustID server returned HTTP status: {}",
                resp.status()
            )));
        }

        let body: serde_json::Value = resp.json().await?;

        if let Some(err_obj) = body.get("error") {
            let msg = err_obj
                .get("message")
                .and_then(|m| m.as_str())
                .unwrap_or("Unknown AcoustID error");
            return Err(MetadataError::AcoustId(msg.to_string()));
        }

        Ok(Self::parse_acoustid_response(&body))
    }

    /// Parses the AcoustID JSON response into a list of candidates sorted by match score.
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
                        .unwrap_or_else(|| "Unknown Artist".to_string());

                    // Look for releases
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
                        // Without a release, add at least the recording itself
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

        // Deduplicate and sort by score, descending
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
