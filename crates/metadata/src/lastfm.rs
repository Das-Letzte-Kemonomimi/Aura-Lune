use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use tracing::{debug, error, info, warn};

/// Domyślny identyfikator klienta Auralune dla Last.fm 2.0 API.
/// Użytkowniczka może podać własny klucz i sekret w Ustawieniach zaawansowanych.
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
// Klient Last.fm 2.0 API
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
        let client = reqwest::Client::builder()
            .user_agent(format!(
                "Auralune/{} ( kitsune-player; https://github.com/Auralune/Auralune )",
                env!("CARGO_PKG_VERSION")
            ))
            .timeout(std::time::Duration::from_secs(12))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());

        Self {
            client,
            base_url: "https://ws.audioscrobbler.com/2.0/".to_string(),
        }
    }

    /// Oblicza podpis `api_sig` według reguł Last.fm:
    /// 1. Posortowanie parametrów alfabetycznie po kluczu (z pominięciem format i callback).
    /// 2. Konkatenacja klucz + wartość dla każdego parametru.
    /// 3. Dołączenie `api_secret` na końcu.
    /// 4. Wyliczenie skrótu MD5 w hex (małe litery).
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

    /// Pobiera nowy token autoryzacyjny `auth.getToken` do autoryzacji w przeglądarce.
    pub async fn get_auth_token(&self, api_key: Option<&str>) -> Result<String, String> {
        let key = api_key.unwrap_or(DEFAULT_LASTFM_API_KEY).trim();
        let url = format!(
            "{}/?method=auth.getToken&api_key={}&format=json",
            self.base_url, key
        );

        let res = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Błąd sieciowy przy pobieraniu tokenu Last.fm: {}", e))?;

        if !res.status().is_success() {
            return Err(format!(
                "Serwer Last.fm zwrócił błąd HTTP: {}",
                res.status()
            ));
        }

        let json: serde_json::Value = res
            .json()
            .await
            .map_err(|e| format!("Błąd parsowania odpowiedzi JSON Last.fm: {}", e))?;

        if let Some(err_msg) = json.get("message").and_then(|m| m.as_str()) {
            return Err(format!("Błąd Last.fm: {}", err_msg));
        }

        let token = json
            .get("token")
            .and_then(|t| t.as_str())
            .ok_or_else(|| "Brak pola 'token' w odpowiedzi Last.fm".to_string())?;

        Ok(token.to_string())
    }

    /// Wymienia autoryzowany przez użytkowniczkę token na trwały klucz sesji `session_key`.
    pub async fn fetch_session(
        &self,
        token: &str,
        api_key: Option<&str>,
        api_secret: Option<&str>,
    ) -> Result<LastFmSession, String> {
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
            .map_err(|e| format!("Błąd żądania pobrania sesji Last.fm: {}", e))?;

        let json: serde_json::Value = res
            .json()
            .await
            .map_err(|e| format!("Błąd parsowania JSON sesji Last.fm: {}", e))?;

        if let Some(err_msg) = json.get("message").and_then(|m| m.as_str()) {
            return Err(format!("Nie udało się uzyskać sesji Last.fm: {}", err_msg));
        }

        let session_obj = json
            .get("session")
            .ok_or_else(|| "Brak obiektu 'session' w odpowiedzi Last.fm".to_string())?;

        let username = session_obj
            .get("name")
            .and_then(|n| n.as_str())
            .ok_or_else(|| "Brak nazwy użytkownika w sesji".to_string())?
            .to_string();

        let session_key = session_obj
            .get("key")
            .and_then(|k| k.as_str())
            .ok_or_else(|| "Brak klucza sesji w odpowiedzi".to_string())?
            .to_string();

        Ok(LastFmSession {
            username,
            session_key,
        })
    }

    /// Weryfikuje klucz sesji poprzez zapytanie `user.getInfo`.
    pub async fn validate_session(
        &self,
        session_key: &str,
        api_key: Option<&str>,
        api_secret: Option<&str>,
    ) -> Result<String, String> {
        let clean_sk = session_key.trim();
        if clean_sk.is_empty() {
            return Err("Klucz sesji Last.fm nie może być pusty".to_string());
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
            .map_err(|e| format!("Błąd połączenia z Last.fm: {}", e))?;

        let json: serde_json::Value = res
            .json()
            .await
            .map_err(|e| format!("Błąd parsowania profilu Last.fm: {}", e))?;

        if let Some(err_msg) = json.get("message").and_then(|m| m.as_str()) {
            return Err(format!("Niepoprawny klucz sesji Last.fm: {}", err_msg));
        }

        let user_name = json
            .get("user")
            .and_then(|u| u.get("name"))
            .and_then(|n| n.as_str())
            .unwrap_or("Użytkowniczka Last.fm")
            .to_string();

        Ok(user_name)
    }

    /// Wysyła status "Now Playing" (aktualnie odtwarzany utwór) do profilu Last.fm.
    pub async fn update_now_playing(
        &self,
        session_key: &str,
        track_info: LastFmTrackInfo<'_>,
        auth: LastFmAuthOverride<'_>,
    ) -> Result<(), String> {
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
            .map_err(|e| format!("Błąd wysyłania Now Playing do Last.fm: {}", e))?;

        if !res.status().is_success() {
            let status = res.status();
            let text = res.text().await.unwrap_or_default();
            warn!("Last.fm Now Playing błąd ({}): {}", status, text);
            return Err(format!("Last.fm zwrócił błąd HTTP {}: {}", status, text));
        }

        debug!(
            "Wysłano status Now Playing do Last.fm: {} - {}",
            track_info.artist, track_info.track
        );
        Ok(())
    }

    /// Wysyła scrobble (ukończone odtworzenie utworu) do Last.fm.
    pub async fn scrobble(
        &self,
        session_key: &str,
        track_info: LastFmTrackInfo<'_>,
        timestamp: u64,
        auth: LastFmAuthOverride<'_>,
    ) -> Result<(), String> {
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
            .map_err(|e| format!("Błąd wysyłania scrobble do Last.fm: {}", e))?;

        if !res.status().is_success() {
            let status = res.status();
            let text = res.text().await.unwrap_or_default();
            error!("Last.fm scrobble błąd ({}): {}", status, text);
            return Err(format!("Last.fm zwrócił błąd HTTP {}: {}", status, text));
        }

        info!(
            "Zgłoszono scrobble do Last.fm: {} - {}",
            track_info.artist, track_info.track
        );
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_md5_rfc1321_vectors() {
        assert_eq!(md5_hex(b""), "d41d8cd98f00b204e9800998ecf8427e");
        assert_eq!(md5_hex(b"a"), "0cc175b9c0f1b6a831c399e269772661");
        assert_eq!(md5_hex(b"abc"), "900150983cd24fb0d6963f7d28e17f72");
        assert_eq!(
            md5_hex(b"message digest"),
            "f96b697d7cb7938d525a2f31aaf161d0"
        );
        assert_eq!(
            md5_hex(b"abcdefghijklmnopqrstuvwxyz"),
            "c3fcd3d76192e4007dfb496cca67e13b"
        );
    }

    #[test]
    fn test_lastfm_signature_calculation() {
        let client = LastFmClient::new();
        let mut params = BTreeMap::new();
        params.insert("method", "auth.getSession".to_string());
        params.insert("api_key", "test_key".to_string());
        params.insert("token", "test_token".to_string());
        params.insert("format", "json".to_string());

        let secret = "my_secret_key";
        let sig = client.calculate_signature(&params, secret);

        // Pre-hash string: "api_keytest_keymethodauth.getSessiontokentest_tokenmy_secret_key"
        let expected_pre_hash = "api_keytest_keymethodauth.getSessiontokentest_tokenmy_secret_key";
        let expected_sig = md5_hex(expected_pre_hash.as_bytes());

        assert_eq!(sig, expected_sig);
    }
}
