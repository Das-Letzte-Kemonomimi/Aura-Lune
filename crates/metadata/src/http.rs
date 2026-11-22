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

/// Klient HTTP z jednolitym User-Agentem, limitem połączenia i całego zapytania.
pub fn build_client(timeout: Duration) -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .connect_timeout(Duration::from_secs(5).min(timeout))
        .timeout(timeout)
        .build()
        .unwrap_or_default()
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
