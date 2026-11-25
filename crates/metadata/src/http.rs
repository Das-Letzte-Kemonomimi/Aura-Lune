//! Wspólne ustawienia HTTP dla usług metadanych: User-Agent, limity czasu, ponawianie
//! przy chwilowych błędach serwera oraz ograniczanie częstotliwości zapytań.

use std::time::{Duration, Instant};
use tokio::sync::Mutex;

/// User-Agent wymagany przez MusicBrainz / AcoustID / LRCLIB (nazwa, wersja, kontakt).
pub const USER_AGENT: &str = concat!(
    "Auralune/",
    env!("CARGO_PKG_VERSION"),
    " ( https://github.com/Das-Letzte-Kemonomimi/Aura-Lune )"
);

/// Maksymalna liczba prób jednego zapytania (pierwsza + ponowienia).
pub const MAX_ATTEMPTS: u32 = 3;
/// Najdłuższe respektowane `Retry-After`, aby interfejs nie czekał w nieskończoność.
const MAX_RETRY_AFTER: Duration = Duration::from_secs(5);

/// Maksymalna liczba przekierowań jednego zapytania.
const MAX_REDIRECTS: usize = 5;

/// Klient HTTP z jednolitym User-Agentem, limitem połączenia i całego zapytania.
///
/// Przekierowania z publicznego hosta na `localhost` lub adres IP spoza internetu są
/// odrzucane (ochrona przed SSRF przez przekierowanie, zob. [`crate::net_guard`]).
pub fn build_client(timeout: Duration) -> reqwest::Client {
    let redirect_policy = reqwest::redirect::Policy::custom(|attempt| {
        if attempt.previous().len() >= MAX_REDIRECTS {
            return attempt.error("too many redirects");
        }
        let from_public = attempt
            .previous()
            .first()
            .is_some_and(|first| !is_local_target(first));
        if from_public && is_local_target(attempt.url()) {
            return attempt.error("redirect to a local address is not allowed");
        }
        attempt.follow()
    });
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .connect_timeout(Duration::from_secs(5).min(timeout))
        .timeout(timeout)
        .redirect(redirect_policy)
        .build()
        .unwrap_or_default()
}

/// Czy URL wskazuje bezpośrednio na `localhost` albo niepubliczny adres IP.
fn is_local_target(url: &reqwest::Url) -> bool {
    let Some(host) = url.host_str() else {
        return true;
    };
    let host = host.trim_matches(['[', ']']);
    match host.parse::<std::net::IpAddr>() {
        Ok(ip) => !crate::net_guard::is_public_ip(ip),
        Err(_) => {
            let lower = host.to_ascii_lowercase();
            lower == "localhost" || lower.ends_with(".localhost")
        }
    }
}

/// Czy odpowiedź oznacza chwilowy problem, który warto ponowić.
pub fn is_retryable_status(status: reqwest::StatusCode) -> bool {
    matches!(status.as_u16(), 429 | 502 | 503 | 504)
}

/// Odstęp przed kolejną próbą: `Retry-After` (sekundy, z limitem) albo 0,5 s · 3^(n-1).
pub fn retry_delay(attempt: u32, retry_after: Option<&str>) -> Duration {
    if let Some(secs) = retry_after.and_then(|v| v.trim().parse::<u64>().ok()) {
        return Duration::from_secs(secs).min(MAX_RETRY_AFTER);
    }
    Duration::from_millis(500 * 3u64.pow(attempt.saturating_sub(1)))
}

/// Wysyła zapytanie, ponawiając je przy błędach sieci i statusach 429/502/503/504.
/// Zapytania z niekopiowalnym ciałem (strumień) są wysyłane jednokrotnie.
pub async fn send_with_retry(
    request: reqwest::RequestBuilder,
) -> Result<reqwest::Response, reqwest::Error> {
    let mut attempt = 1;
    loop {
        let Some(next) = request.try_clone() else {
            return request.send().await;
        };
        let result = next.send().await;
        let delay = match &result {
            Ok(resp) if attempt < MAX_ATTEMPTS && is_retryable_status(resp.status()) => {
                retry_delay(
                    attempt,
                    resp.headers()
                        .get(reqwest::header::RETRY_AFTER)
                        .and_then(|v| v.to_str().ok()),
                )
            }
            Err(e) if attempt < MAX_ATTEMPTS && (e.is_connect() || e.is_timeout()) => {
                retry_delay(attempt, None)
            }
            _ => return result,
        };
        tracing::debug!(
            "Ponawianie zapytania HTTP (próba {}) za {:?}",
            attempt + 1,
            delay
        );
        tokio::time::sleep(delay).await;
        attempt += 1;
    }
}

/// Minimalny odstęp między kolejnymi zapytaniami do jednej usługi (np. MusicBrainz 1/s,
/// AcoustID 3/s). Współdzielony przez klony klienta.
#[derive(Debug)]
pub struct RateLimiter {
    min_interval: Duration,
    last: Mutex<Option<Instant>>,
}

impl RateLimiter {
    pub fn new(min_interval: Duration) -> Self {
        Self {
            min_interval,
            last: Mutex::new(None),
        }
    }

    /// Czeka, aż od poprzedniego zapytania minie `min_interval`, i rezerwuje bieżący slot.
    pub async fn wait(&self) {
        let mut last = self.last.lock().await;
        if let Some(t) = *last {
            let elapsed = t.elapsed();
            if elapsed < self.min_interval {
                tokio::time::sleep(self.min_interval - elapsed).await;
            }
        }
        *last = Some(Instant::now());
    }
}
