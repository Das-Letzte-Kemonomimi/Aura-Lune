//! Shared HTTP settings for the metadata services: User-Agent, timeouts, retries
//! on transient server errors, and request rate limiting.

use std::time::{Duration, Instant};
use tokio::sync::Mutex;

/// User-Agent required by MusicBrainz / AcoustID / LRCLIB (name, version, contact).
pub const USER_AGENT: &str = concat!(
    "Auralune/",
    env!("CARGO_PKG_VERSION"),
    " ( https://github.com/Das-Letzte-Kemonomimi/Aura-Lune )"
);

/// Maximum number of attempts for one request (the first one + retries).
pub const MAX_ATTEMPTS: u32 = 3;
/// Longest `Retry-After` honoured, so the UI does not wait forever.
const MAX_RETRY_AFTER: Duration = Duration::from_secs(5);

/// Maximum number of redirects for one request.
const MAX_REDIRECTS: usize = 5;

/// HTTP client with a uniform User-Agent and connect and total request timeouts.
///
/// Redirects from a public host to `localhost` or a non-internet IP address are
/// rejected (protection against SSRF via redirect, see [`crate::net_guard`]).
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

/// Whether the URL points directly at `localhost` or a non-public IP address.
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

/// Whether the response means a transient problem worth retrying.
pub fn is_retryable_status(status: reqwest::StatusCode) -> bool {
    matches!(status.as_u16(), 429 | 502 | 503 | 504)
}

/// Delay before the next attempt: `Retry-After` (seconds, capped) or 0.5 s · 3^(n-1).
pub fn retry_delay(attempt: u32, retry_after: Option<&str>) -> Duration {
    if let Some(secs) = retry_after.and_then(|v| v.trim().parse::<u64>().ok()) {
        return Duration::from_secs(secs).min(MAX_RETRY_AFTER);
    }
    Duration::from_millis(500 * 3u64.pow(attempt.saturating_sub(1)))
}

/// Sends a request, retrying on network errors and 429/502/503/504 statuses.
/// Requests with a non-clonable body (a stream) are sent only once.
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
            "Retrying HTTP request (attempt {}) in {:?}",
            attempt + 1,
            delay
        );
        tokio::time::sleep(delay).await;
        attempt += 1;
    }
}

/// Minimum interval between consecutive requests to one service (e.g. MusicBrainz 1/s,
/// AcoustID 3/s). Shared by client clones.
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

    /// Waits until `min_interval` has passed since the previous request and reserves the current slot.
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
