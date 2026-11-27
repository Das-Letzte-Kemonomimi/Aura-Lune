//! Request retries, delays and the rate limiter (`metadata::http`).

use metadata::http::{
    build_client, is_retryable_status, retry_delay, send_with_retry, RateLimiter, USER_AGENT,
};
use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

/// Local server that answers with the given statuses in turn; returns the address and a request counter.
fn serve_statuses(
    statuses: Vec<u16>,
) -> (String, Arc<AtomicUsize>, Arc<std::sync::Mutex<Vec<String>>>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = format!("http://{}/test", listener.local_addr().unwrap());
    let hits = Arc::new(AtomicUsize::new(0));
    let agents = Arc::new(std::sync::Mutex::new(Vec::new()));
    let (h, a) = (hits.clone(), agents.clone());
    std::thread::spawn(move || {
        for status in statuses {
            let Ok((mut stream, _)) = listener.accept() else {
                return;
            };
            let mut buf = [0u8; 4096];
            let n = stream.read(&mut buf).unwrap_or(0);
            let req = String::from_utf8_lossy(&buf[..n]).to_string();
            if let Some(ua) = req
                .lines()
                .find(|l| l.to_ascii_lowercase().starts_with("user-agent:"))
            {
                a.lock().unwrap().push(ua[11..].trim().to_string());
            }
            h.fetch_add(1, Ordering::SeqCst);
            let body = "ok";
            let extra = if status == 503 {
                "Retry-After: 0\r\n"
            } else {
                ""
            };
            let _ = write!(
                stream,
                "HTTP/1.1 {status} X\r\n{extra}Content-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
        }
    });
    (addr, hits, agents)
}

#[tokio::test]
async fn test_retries_transient_503_then_succeeds() {
    let (url, hits, agents) = serve_statuses(vec![503, 503, 200]);
    let client = build_client(Duration::from_secs(5));
    let resp = send_with_retry(client.get(&url)).await.unwrap();
    assert_eq!(resp.status(), 200);
    assert_eq!(hits.load(Ordering::SeqCst), 3);
    assert!(agents.lock().unwrap().iter().all(|ua| ua == USER_AGENT));
}

#[tokio::test]
async fn test_does_not_retry_client_errors() {
    let (url, hits, _) = serve_statuses(vec![404, 200]);
    let resp = send_with_retry(build_client(Duration::from_secs(5)).get(&url))
        .await
        .unwrap();
    assert_eq!(resp.status(), 404);
    assert_eq!(hits.load(Ordering::SeqCst), 1);
}

#[tokio::test]
async fn test_gives_up_after_max_attempts() {
    let (url, hits, _) = serve_statuses(vec![503, 503, 503, 200]);
    let resp = send_with_retry(build_client(Duration::from_secs(5)).get(&url))
        .await
        .unwrap();
    assert_eq!(
        resp.status(),
        503,
        "after 3 attempts the last response is returned"
    );
    assert_eq!(hits.load(Ordering::SeqCst), 3);
}

#[test]
fn test_retry_policy() {
    assert!(is_retryable_status(reqwest::StatusCode::TOO_MANY_REQUESTS));
    assert!(is_retryable_status(
        reqwest::StatusCode::SERVICE_UNAVAILABLE
    ));
    assert!(!is_retryable_status(reqwest::StatusCode::NOT_FOUND));
    assert!(!is_retryable_status(
        reqwest::StatusCode::INTERNAL_SERVER_ERROR
    ));
    assert_eq!(retry_delay(1, None), Duration::from_millis(500));
    assert_eq!(retry_delay(2, None), Duration::from_millis(1500));
    assert_eq!(retry_delay(1, Some("2")), Duration::from_secs(2));
    assert_eq!(
        retry_delay(1, Some("3600")),
        Duration::from_secs(5),
        "Retry-After ograniczone"
    );
    assert_eq!(
        retry_delay(1, Some("Wed, 21 Oct 2026")),
        Duration::from_millis(500)
    );
}

#[test]
fn test_user_agent_names_version_and_contact() {
    assert!(USER_AGENT.starts_with(&format!("Auralune/{} ", env!("CARGO_PKG_VERSION"))));
    assert!(USER_AGENT.contains("github.com"));
}

#[tokio::test]
async fn test_rate_limiter_spaces_requests() {
    let limiter = RateLimiter::new(Duration::from_millis(100));
    let start = Instant::now();
    for _ in 0..4 {
        limiter.wait().await;
    }
    assert!(
        start.elapsed() >= Duration::from_millis(300),
        "{:?}",
        start.elapsed()
    );
}
