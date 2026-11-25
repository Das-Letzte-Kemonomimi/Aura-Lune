use metadata::net_guard::{ensure_public_https_url, is_public_ip};
use std::net::IpAddr;

fn ip(s: &str) -> IpAddr {
    s.parse().unwrap()
}

#[test]
fn public_addresses_are_allowed() {
    for a in ["1.1.1.1", "142.250.74.14", "2606:4700:4700::1111"] {
        assert!(is_public_ip(ip(a)), "{a} powinien być publiczny");
    }
}

#[test]
fn local_and_reserved_addresses_are_rejected() {
    for a in [
        "127.0.0.1",
        "10.0.0.5",
        "172.16.3.4",
        "192.168.1.1",
        "169.254.169.254",
        "100.64.0.1",
        "0.0.0.0",
        "255.255.255.255",
        "224.0.0.1",
        "::1",
        "::",
        "fc00::1",
        "fe80::1",
        "::ffff:127.0.0.1",
        "::ffff:192.168.0.1",
    ] {
        assert!(
            !is_public_ip(ip(a)),
            "{a} nie może być traktowany jako publiczny"
        );
    }
}

#[tokio::test]
async fn non_https_and_local_urls_are_rejected() {
    for url in [
        "http://coverartarchive.org/release/x/front",
        "file:///etc/passwd",
        "https://127.0.0.1/cover.jpg",
        "https://localhost/cover.jpg",
        "https://[::1]/cover.jpg",
        "not a url",
    ] {
        assert!(
            ensure_public_https_url(url).await.is_err(),
            "{url} powinien zostać odrzucony"
        );
    }
}
