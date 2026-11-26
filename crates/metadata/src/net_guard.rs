//! SSRF protection for URLs supplied by the UI (e.g. a manually chosen cover).
//!
//! The address must use `https` and point at a public host: every IP address the name
//! resolves to is checked, so the request cannot reach `localhost`, the LAN
//! or cloud metadata services (`169.254.169.254`).

use crate::MetadataError;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

/// Whether the IP address is publicly routable (not loopback, LAN, link-local, CGNAT, multicast…).
pub fn is_public_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => is_public_ipv4(v4),
        IpAddr::V6(v6) => match v6.to_ipv4_mapped() {
            Some(v4) => is_public_ipv4(v4),
            None => is_public_ipv6(v6),
        },
    }
}

fn is_public_ipv4(ip: Ipv4Addr) -> bool {
    let [a, b, ..] = ip.octets();
    let cgnat = a == 100 && (64..128).contains(&b);
    let benchmarking = a == 198 && (b == 18 || b == 19);
    !(ip.is_private()
        || ip.is_loopback()
        || ip.is_link_local()
        || ip.is_unspecified()
        || ip.is_broadcast()
        || ip.is_multicast()
        || ip.is_documentation()
        || cgnat
        || benchmarking
        || a == 0
        || a >= 240)
}

fn is_public_ipv6(ip: Ipv6Addr) -> bool {
    let first = ip.segments()[0];
    let unique_local = first & 0xfe00 == 0xfc00;
    let link_local = first & 0xffc0 == 0xfe80;
    let documentation = first == 0x2001 && ip.segments()[1] == 0x0db8;
    !(ip.is_loopback()
        || ip.is_unspecified()
        || ip.is_multicast()
        || unique_local
        || link_local
        || documentation)
}

/// Checks that `url` is `https://` to a public host (after DNS resolution).
pub async fn ensure_public_https_url(url: &str) -> Result<(), MetadataError> {
    let parsed = reqwest::Url::parse(url)
        .map_err(|e| MetadataError::Query(format!("Invalid URL {url}: {e}")))?;
    if parsed.scheme() != "https" {
        return Err(MetadataError::Query(format!(
            "Only https addresses are allowed: {url}"
        )));
    }
    let host = parsed
        .host_str()
        .ok_or_else(|| MetadataError::Query(format!("No host in the URL {url}")))?;
    let port = parsed.port_or_known_default().unwrap_or(443);
    let addrs: Vec<_> = tokio::net::lookup_host((host.trim_matches(['[', ']']), port))
        .await
        .map_err(|e| MetadataError::Query(format!("Cannot resolve host {host}: {e}")))?
        .collect();
    if addrs.is_empty() || addrs.iter().any(|a| !is_public_ip(a.ip())) {
        return Err(MetadataError::Query(format!(
            "Address {host} points to a local network, download refused"
        )));
    }
    Ok(())
}
