//! Semantic version comparison (`X.Y.Z[-pre]`) used by the updater.
//!
//! Rules as in SemVer 2.0: a version with a `-pre` suffix is lower than the release without it
//! (`1.1.6-dev < 1.1.6`), numeric identifiers compare numerically, and numeric ones are
//! lower than alphanumeric ones. Build metadata (`+abc`) is ignored.

use crate::DomainError;
use std::cmp::Ordering;

/// A parsed semantic version.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Version {
    pub major: u64,
    pub minor: u64,
    pub patch: u64,
    /// Suffix identifiers (`dev.1` → `["dev", "1"]`); empty for a stable release.
    pub pre: Vec<String>,
}

impl Version {
    /// Parsuje `1.2.3`, `v1.2.3`, `1.2.3-dev` i `1.2.3-rc.1+build`.
    pub fn parse(input: &str) -> Result<Self, DomainError> {
        let invalid = || DomainError::Validation(format!("Invalid version number: {input:?}"));
        let trimmed = input.trim();
        let trimmed = trimmed.strip_prefix('v').unwrap_or(trimmed);
        let without_build = trimmed.split('+').next().unwrap_or("");
        let (core, pre) = match without_build.split_once('-') {
            Some((core, pre)) => (core, Some(pre)),
            None => (without_build, None),
        };
        let mut numbers = core.split('.');
        let mut next_number = || -> Result<u64, DomainError> {
            numbers
                .next()
                .filter(|s| !s.is_empty() && s.bytes().all(|b| b.is_ascii_digit()))
                .and_then(|s| s.parse().ok())
                .ok_or_else(invalid)
        };
        let (major, minor, patch) = (next_number()?, next_number()?, next_number()?);
        if numbers.next().is_some() {
            return Err(invalid());
        }
        let pre = match pre {
            None => Vec::new(),
            Some("") => return Err(invalid()),
            Some(p) => p.split('.').map(str::to_string).collect(),
        };
        if pre.iter().any(|id| id.is_empty()) {
            return Err(invalid());
        }
        Ok(Self {
            major,
            minor,
            patch,
            pre,
        })
    }

    /// Whether this is a pre-release (e.g. `1.1.6-dev`).
    pub fn is_prerelease(&self) -> bool {
        !self.pre.is_empty()
    }
}

fn compare_identifiers(a: &str, b: &str) -> Ordering {
    match (a.parse::<u64>(), b.parse::<u64>()) {
        (Ok(x), Ok(y)) => x.cmp(&y),
        (Ok(_), Err(_)) => Ordering::Less,
        (Err(_), Ok(_)) => Ordering::Greater,
        (Err(_), Err(_)) => a.cmp(b),
    }
}

impl Ord for Version {
    fn cmp(&self, other: &Self) -> Ordering {
        let core =
            (self.major, self.minor, self.patch).cmp(&(other.major, other.minor, other.patch));
        if core != Ordering::Equal {
            return core;
        }
        match (self.pre.is_empty(), other.pre.is_empty()) {
            (true, true) => Ordering::Equal,
            (true, false) => Ordering::Greater,
            (false, true) => Ordering::Less,
            (false, false) => {
                for (a, b) in self.pre.iter().zip(&other.pre) {
                    let ord = compare_identifiers(a, b);
                    if ord != Ordering::Equal {
                        return ord;
                    }
                }
                self.pre.len().cmp(&other.pre.len())
            }
        }
    }
}

impl PartialOrd for Version {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

/// Whether `candidate` is a newer version than `current`.
pub fn is_newer(candidate: &str, current: &str) -> Result<bool, DomainError> {
    Ok(Version::parse(candidate)? > Version::parse(current)?)
}
