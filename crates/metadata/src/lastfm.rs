use crate::ScrobbleError;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use tracing::{debug, error, info, warn};

/// Default Auralune client identifier for the Last.fm 2.0 API.
/// The user can enter their own key and secret in the advanced settings.
pub const DEFAULT_LASTFM_API_KEY: &str = "b25b959554ed76058ac220b7b2e0a026";
pub const DEFAULT_LASTFM_API_SECRET: &str = "425b55779f4227dda7900343f6048563";

use md5::{Digest, Md5};

pub fn md5_hex(data: &[u8]) -> String {
    let mut hasher = Md5::new();
    hasher.update(data);
    let result = hasher.finalize();
    let mut s = String::with_capacity(32);
    for b in result {
        s.push_str(&format!("{:02x}", b));
    }
    s
}

// =========================================================================
// Last.fm 2.0 API client
// =========================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LastFmSession {
    pub username: String,
    pub session_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LastFmAuthTokenResponse {
    pub token: String,
}

#[derive(Debug, Clone)]
pub struct LastFmTrackInfo<'a> {
    pub artist: &'a str,
    pub track: &'a str,
    pub album: Option<&'a str>,
    pub duration_sec: Option<u64>,
}

#[derive(Debug, Clone, Default)]
pub struct LastFmAuthOverride<'a> {
    pub api_key: Option<&'a str>,
    pub api_secret: Option<&'a str>,
}

#[derive(Clone)]
pub struct LastFmClient {
    client: reqwest::Client,
    base_url: String,
}

impl Default for LastFmClient {
    fn default() -> Self {
        Self::new()
    }
}

impl LastFmClient {
    pub fn new() -> Self {
        let client = crate::http::build_client(std::time::Duration::from_secs(12));

        Self {
            client,
            base_url: "https://ws.audioscrobbler.com/2.0/".to_string(),
        }
    }

    /// Computes the `api_sig` signature following the Last.fm rules:
    /// 1. Sort the parameters alphabetically by key (skipping format and callback).
    /// 2. Concatenate key + value for each parameter.
    /// 3. Append `api_secret` at the end.
    /// 4. Compute the MD5 hash in hex (lowercase).
    pub fn calculate_signature(&self, params: &BTreeMap<&str, String>, api_secret: &str) -> String {
        let mut pre_hash = String::new();
        for (k, v) in params {
            if *k != "format" && *k != "callback" && *k != "api_sig" {
                pre_hash.push_str(k);
                pre_hash.push_str(v);
            }
        }
        pre_hash.push_str(api_secret);
        md5_hex(pre_hash.as_bytes())
    }

    /// Fetches a new `auth.getToken` token for authorisation in the browser.
    pub async fn get_auth_token(&self, api_key: Option<&str>) -> Result<String, ScrobbleError> {
        let key = api_key.unwrap_or(DEFAULT_LASTFM_API_KEY).trim();
        let url = format!(
            "{}/?method=auth.getToken&api_key={}&format=json",
            self.base_url,
            crate::urlencoding::encode(key)
        );

        let res = self.client.get(&url).send().await.map_err(|e| {
            ScrobbleError::Network(format!(
                "Network error while fetching the Last.fm token: {}",
                e
            ))
        })?;

        if !res.status().is_success() {
            return Err(ScrobbleError::Service(format!(
                "Last.fm server returned HTTP error: {}",
                res.status()
            )));
        }

        let json: serde_json::Value = res.json().await.map_err(|e| {
            ScrobbleError::Parse(format!("Failed to parse the Last.fm JSON response: {}", e))
        })?;

        if let Some(err_msg) = json.get("message").and_then(|m| m.as_str()) {
            return Err(ScrobbleError::Service(format!(
                "Last.fm error: {}",
                err_msg
            )));
        }

        let token = json.get("token").and_then(|t| t.as_str()).ok_or_else(|| {
            ScrobbleError::Parse("No 'token' field in the Last.fm response".to_string())
        })?;

        Ok(token.to_string())
    }

    /// Exchanges the token the user authorised for a permanent `session_key`.
    pub async fn fetch_session(
        &self,
        token: &str,
        api_key: Option<&str>,
        api_secret: Option<&str>,
    ) -> Result<LastFmSession, ScrobbleError> {
        let key = api_key.unwrap_or(DEFAULT_LASTFM_API_KEY).trim();
        let secret = api_secret.unwrap_or(DEFAULT_LASTFM_API_SECRET).trim();

        let mut params = BTreeMap::new();
        params.insert("api_key", key.to_string());
        params.insert("method", "auth.getSession".to_string());
        params.insert("token", token.trim().to_string());

        let sig = self.calculate_signature(&params, secret);
        params.insert("api_sig", sig);
        params.insert("format", "json".to_string());

        let res = self
            .client
            .post(&self.base_url)
            .form(&params)
            .send()
            .await
            .map_err(|e| {
                ScrobbleError::Network(format!("Last.fm session request failed: {}", e))
            })?;

        let json: serde_json::Value = res.json().await.map_err(|e| {
            ScrobbleError::Parse(format!("Failed to parse the Last.fm session JSON: {}", e))
        })?;

        if let Some(err_msg) = json.get("message").and_then(|m| m.as_str()) {
            return Err(ScrobbleError::Service(format!(
                "Failed to get a Last.fm session: {}",
                err_msg
            )));
        }

        let session_obj = json.get("session").ok_or_else(|| {
            ScrobbleError::Parse("No 'session' object in the Last.fm response".to_string())
        })?;

        let username = session_obj
            .get("name")
            .and_then(|n| n.as_str())
            .ok_or_else(|| ScrobbleError::Parse("No user name in the session".to_string()))?
            .to_string();

        let session_key = session_obj
            .get("key")
            .and_then(|k| k.as_str())
            .ok_or_else(|| ScrobbleError::Parse("No session key in the response".to_string()))?
            .to_string();

        Ok(LastFmSession {
            username,
            session_key,
        })
    }

    /// Verifies the session key with a `user.getInfo` request.
    pub async fn validate_session(
        &self,
        session_key: &str,
        api_key: Option<&str>,
        api_secret: Option<&str>,
    ) -> Result<String, ScrobbleError> {
        let clean_sk = session_key.trim();
        if clean_sk.is_empty() {
            return Err(ScrobbleError::Validation(
                "The Last.fm session key must not be empty".to_string(),
            ));
        }

        let key = api_key.unwrap_or(DEFAULT_LASTFM_API_KEY).trim();
        let secret = api_secret.unwrap_or(DEFAULT_LASTFM_API_SECRET).trim();

        let mut params = BTreeMap::new();
        params.insert("api_key", key.to_string());
        params.insert("method", "user.getInfo".to_string());
        params.insert("sk", clean_sk.to_string());

        let sig = self.calculate_signature(&params, secret);
        params.insert("api_sig", sig);
        params.insert("format", "json".to_string());

        let res = self
            .client
            .post(&self.base_url)
            .form(&params)
            .send()
            .await
            .map_err(|e| ScrobbleError::Network(format!("Failed to connect to Last.fm: {}", e)))?;

        let json: serde_json::Value = res.json().await.map_err(|e| {
            ScrobbleError::Parse(format!("Failed to parse the Last.fm profile: {}", e))
        })?;

        if let Some(err_msg) = json.get("message").and_then(|m| m.as_str()) {
            return Err(ScrobbleError::Service(format!(
                "Invalid Last.fm session key: {}",
                err_msg
            )));
        }

        let user_name = json
            .get("user")
            .and_then(|u| u.get("name"))
            .and_then(|n| n.as_str())
            .unwrap_or("Last.fm user")
            .to_string();

        Ok(user_name)
    }

    /// Sends the "Now Playing" status (the track playing now) to the Last.fm profile.
    pub async fn update_now_playing(
        &self,
        session_key: &str,
        track_info: LastFmTrackInfo<'_>,
        auth: LastFmAuthOverride<'_>,
    ) -> Result<(), ScrobbleError> {
        let clean_sk = session_key.trim();
        if clean_sk.is_empty() {
            return Ok(());
        }

        let key = auth.api_key.unwrap_or(DEFAULT_LASTFM_API_KEY).trim();
        let secret = auth.api_secret.unwrap_or(DEFAULT_LASTFM_API_SECRET).trim();

        let mut params = BTreeMap::new();
        params.insert("api_key", key.to_string());
        params.insert("artist", track_info.artist.to_string());
        params.insert("method", "track.updateNowPlaying".to_string());
        params.insert("sk", clean_sk.to_string());
        params.insert("track", track_info.track.to_string());

        if let Some(alb) = track_info.album {
            if !alb.trim().is_empty() {
                params.insert("album", alb.to_string());
            }
        }

        let dur_str;
        if let Some(dur) = track_info.duration_sec {
            if dur > 0 {
                dur_str = dur.to_string();
                params.insert("duration", dur_str);
            }
        }

        let sig = self.calculate_signature(&params, secret);
        params.insert("api_sig", sig);
        params.insert("format", "json".to_string());

        let res = self
            .client
            .post(&self.base_url)
            .form(&params)
            .send()
            .await
            .map_err(|e| {
                ScrobbleError::Network(format!("Failed to send Now Playing to Last.fm: {}", e))
            })?;

        if !res.status().is_success() {
            let status = res.status();
            let text = res.text().await.unwrap_or_default();
            warn!("Last.fm Now Playing error ({}): {}", status, text);
            return Err(ScrobbleError::Service(format!(
                "Last.fm returned HTTP error {}: {}",
                status, text
            )));
        }

        debug!(
            "Sent the Now Playing status to Last.fm: {} - {}",
            track_info.artist, track_info.track
        );
        Ok(())
    }

    /// Sends a scrobble (a finished play of a track) to Last.fm.
    pub async fn scrobble(
        &self,
        session_key: &str,
        track_info: LastFmTrackInfo<'_>,
        timestamp: u64,
        auth: LastFmAuthOverride<'_>,
    ) -> Result<(), ScrobbleError> {
        let clean_sk = session_key.trim();
        if clean_sk.is_empty() {
            return Ok(());
        }

        let key = auth.api_key.unwrap_or(DEFAULT_LASTFM_API_KEY).trim();
        let secret = auth.api_secret.unwrap_or(DEFAULT_LASTFM_API_SECRET).trim();

        let mut params = BTreeMap::new();
        params.insert("api_key", key.to_string());
        params.insert("artist[0]", track_info.artist.to_string());
        params.insert("method", "track.scrobble".to_string());
        params.insert("sk", clean_sk.to_string());
        params.insert("timestamp[0]", timestamp.to_string());
        params.insert("track[0]", track_info.track.to_string());

        if let Some(alb) = track_info.album {
            if !alb.trim().is_empty() {
                params.insert("album[0]", alb.to_string());
            }
        }

        let dur_str;
        if let Some(dur) = track_info.duration_sec {
            if dur > 0 {
                dur_str = dur.to_string();
                params.insert("duration[0]", dur_str);
            }
        }

        let sig = self.calculate_signature(&params, secret);
        params.insert("api_sig", sig);
        params.insert("format", "json".to_string());

        let res = self
            .client
            .post(&self.base_url)
            .form(&params)
            .send()
            .await
            .map_err(|e| {
                ScrobbleError::Network(format!("Failed to send the scrobble to Last.fm: {}", e))
            })?;

        if !res.status().is_success() {
            let status = res.status();
            let text = res.text().await.unwrap_or_default();
            error!("Last.fm scrobble error ({}): {}", status, text);
            return Err(ScrobbleError::Service(format!(
                "Last.fm returned HTTP error {}: {}",
                status, text
            )));
        }

        info!(
            "Scrobble submitted to Last.fm: {} - {}",
            track_info.artist, track_info.track
        );
        Ok(())
    }
}
