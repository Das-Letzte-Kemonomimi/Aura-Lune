use serde::{Deserialize, Serialize};
use tracing::{debug, error, info};

/// Metadane utworu przesyłane do protokołu ListenBrainz (MetaBrainz).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdditionalInfoPayload {
    pub media_player: String,
    pub submission_client: String,
    pub submission_client_version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recording_mbid: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub release_mbid: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
}

impl Default for AdditionalInfoPayload {
    fn default() -> Self {
        Self {
            media_player: "Auralune".to_string(),
            submission_client: "Auralune".to_string(),
            submission_client_version: env!("CARGO_PKG_VERSION").to_string(),
            recording_mbid: None,
            release_mbid: None,
            duration_ms: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackMetadataPayload {
    pub artist_name: String,
    pub track_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub release_name: Option<String>,
    #[serde(default)]
    pub additional_info: AdditionalInfoPayload,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListenItemPayload {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub listened_at: Option<u64>,
    pub track_metadata: TrackMetadataPayload,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmitListensRequest {
    /// Typ: "single" (ukończone odtworzenie) lub "playing_now" (aktualnie odtwarzany utwór)
    pub listen_type: String,
    pub payload: Vec<ListenItemPayload>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ValidateTokenResponse {
    pub code: Option<i64>,
    pub message: Option<String>,
    pub valid: bool,
    pub user_name: Option<String>,
}

/// Klient scrobblera ListenBrainz (otwarty ekosystem MetaBrainz).
#[derive(Clone)]
pub struct ListenBrainzClient {
    client: reqwest::Client,
    base_url: String,
}

impl Default for ListenBrainzClient {
    fn default() -> Self {
        Self::new()
    }
}

impl ListenBrainzClient {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .user_agent(format!(
                "Auralune/{} ( kitsune-player )",
                env!("CARGO_PKG_VERSION")
            ))
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());

        Self {
            client,
            base_url: "https://api.listenbrainz.org/1".to_string(),
        }
    }

    /// Weryfikuje token użytkownika w serwisie ListenBrainz i zwraca nazwę użytkownika.
    pub async fn validate_token(&self, token: &str) -> Result<String, String> {
        let clean_token = token.trim();
        if clean_token.is_empty() {
            return Err("Token ListenBrainz nie może być pusty".to_string());
        }

        let url = format!("{}/validate-token", self.base_url);
        let res = self
            .client
            .get(&url)
            .header("Authorization", format!("Token {}", clean_token))
            .send()
            .await
            .map_err(|e| format!("Błąd połączenia z serwerem ListenBrainz: {}", e))?;

        if !res.status().is_success() {
            return Err(format!(
                "Nieprawidłowy kod odpowiedzi HTTP ListenBrainz: {}",
                res.status()
            ));
        }

        let body: ValidateTokenResponse = res
            .json()
            .await
            .map_err(|e| format!("Błąd parsowania odpowiedzi ListenBrainz: {}", e))?;

        if !body.valid {
            return Err(body.message.unwrap_or_else(|| {
                "Token ListenBrainz jest nieprawidłowy lub wygasł".to_string()
            }));
        }

        Ok(body
            .user_name
            .unwrap_or_else(|| "Użytkowniczka ListenBrainz".to_string()))
    }

    /// Wysyła status "Playing Now" (teraz odtwarzane) do ListenBrainz.
    pub async fn submit_playing_now(
        &self,
        token: &str,
        artist: &str,
        title: &str,
        album: Option<&str>,
        duration_ms: Option<u64>,
    ) -> Result<(), String> {
        let clean_token = token.trim();
        if clean_token.is_empty() {
            return Ok(());
        }

        let payload = SubmitListensRequest {
            listen_type: "playing_now".to_string(),
            payload: vec![ListenItemPayload {
                listened_at: None,
                track_metadata: TrackMetadataPayload {
                    artist_name: artist.to_string(),
                    track_name: title.to_string(),
                    release_name: album.map(|a| a.to_string()),
                    additional_info: AdditionalInfoPayload {
                        duration_ms,
                        ..Default::default()
                    },
                },
            }],
        };

        let url = format!("{}/submit-listens", self.base_url);
        let res = self
            .client
            .post(&url)
            .header("Authorization", format!("Token {}", clean_token))
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Błąd wysyłania playing_now do ListenBrainz: {}", e))?;

        if res.status().is_success() {
            debug!(
                "Wysłano status 'playing_now' do ListenBrainz: {} - {}",
                artist, title
            );
            Ok(())
        } else {
            let status = res.status();
            let text = res.text().await.unwrap_or_default();
            error!(
                "Błąd wysyłania playing_now ListenBrainz ({}): {}",
                status, text
            );
            Err(format!("Błąd ListenBrainz ({}): {}", status, text))
        }
    }

    /// Wysyła odtworzony utwór (scrobble) do ListenBrainz.
    pub async fn submit_listen(
        &self,
        token: &str,
        artist: &str,
        title: &str,
        album: Option<&str>,
        listened_at: u64,
        duration_ms: Option<u64>,
    ) -> Result<(), String> {
        let clean_token = token.trim();
        if clean_token.is_empty() {
            return Ok(());
        }

        let payload = SubmitListensRequest {
            listen_type: "single".to_string(),
            payload: vec![ListenItemPayload {
                listened_at: Some(listened_at),
                track_metadata: TrackMetadataPayload {
                    artist_name: artist.to_string(),
                    track_name: title.to_string(),
                    release_name: album.map(|a| a.to_string()),
                    additional_info: AdditionalInfoPayload {
                        duration_ms,
                        ..Default::default()
                    },
                },
            }],
        };

        let url = format!("{}/submit-listens", self.base_url);
        let res = self
            .client
            .post(&url)
            .header("Authorization", format!("Token {}", clean_token))
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Błąd wysyłania listen do ListenBrainz: {}", e))?;

        if res.status().is_success() {
            info!(
                "Zascrobblowano utwór do ListenBrainz: {} - {}",
                artist, title
            );
            Ok(())
        } else {
            let status = res.status();
            let text = res.text().await.unwrap_or_default();
            error!("Błąd scrobblowania ListenBrainz ({}): {}", status, text);
            Err(format!("Błąd ListenBrainz ({}): {}", status, text))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_listenbrainz_payload_serialization() {
        let payload = SubmitListensRequest {
            listen_type: "single".to_string(),
            payload: vec![ListenItemPayload {
                listened_at: Some(1698200000),
                track_metadata: TrackMetadataPayload {
                    artist_name: "Das Letzte Kemonomimi".to_string(),
                    track_name: "Skrzydła Białe".to_string(),
                    release_name: Some("Auralune OST".to_string()),
                    additional_info: AdditionalInfoPayload {
                        duration_ms: Some(215000),
                        ..Default::default()
                    },
                },
            }],
        };

        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("\"listen_type\":\"single\""));
        assert!(json.contains("\"artist_name\":\"Das Letzte Kemonomimi\""));
        assert!(json.contains("\"track_name\":\"Skrzydła Białe\""));
        assert!(json.contains("\"media_player\":\"Auralune\""));
        assert!(json.contains("\"listened_at\":1698200000"));
    }
}
