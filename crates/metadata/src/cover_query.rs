//! Pure helpers for cover art lookups: text normalization, artist splitting,
//! query relaxation and candidate scoring. No I/O, so everything is unit-testable.
//!
//! The lookup order is always album first, then artist, and it relaxes step by step:
//! full artist string, primary artist only, shortened album titles, album only.

use crate::{clean_album_title, clean_artist_name};

/// Minimum [`match_score`] for callers that pick a cover without asking the user
/// (Discord Rich Presence, automatic album cover fetch). A mismatch is worse than no cover.
pub const AUTO_ACCEPT_SCORE: u8 = 75;

/// Artist names that carry no information for matching.
const NEUTRAL_ARTISTS: &[&str] = &["unknown artist", "various artists", "various", "va", ""];

/// One step of the query ladder.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CoverQuery {
    pub album: String,
    pub artist: Option<String>,
}

/// Folds a string into a comparable form: lowercase, no diacritics, `ß` as `ss`,
/// `&` as `and`, punctuation removed, German digraphs (`ae`, `oe`, `ue`) collapsed,
/// so `zurück` and `zurueck` give the same text.
pub fn normalize(input: &str) -> String {
    let mut folded = String::with_capacity(input.len());
    for c in input.chars() {
        match c {
            '&' => folded.push_str(" and "),
            'ß' => folded.push_str("ss"),
            'ä' | 'Ä' | 'á' | 'à' | 'â' | 'ã' | 'å' | 'Á' | 'À' | 'Â' | 'Ã' | 'Å' => {
                folded.push('a')
            }
            'ö' | 'Ö' | 'ó' | 'ò' | 'ô' | 'õ' | 'ø' | 'Ó' | 'Ò' | 'Ô' | 'Õ' | 'Ø' => {
                folded.push('o')
            }
            'ü' | 'Ü' | 'ú' | 'ù' | 'û' | 'Ú' | 'Ù' | 'Û' => folded.push('u'),
            'é' | 'è' | 'ê' | 'ë' | 'É' | 'È' | 'Ê' | 'Ë' => folded.push('e'),
            'í' | 'ì' | 'î' | 'ï' | 'Í' | 'Ì' | 'Î' | 'Ï' => folded.push('i'),
            'ñ' | 'Ñ' => folded.push('n'),
            'ç' | 'Ç' | 'ć' | 'č' | 'Č' => folded.push('c'),
            'ł' | 'Ł' => folded.push('l'),
            'ś' | 'š' | 'Ś' | 'Š' => folded.push('s'),
            'ź' | 'ż' | 'ž' | 'Ź' | 'Ż' | 'Ž' => folded.push('z'),
            'ń' => folded.push('n'),
            'ę' | 'Ę' => folded.push('e'),
            'ą' | 'Ą' => folded.push('a'),
            c if c.is_alphanumeric() => folded.extend(c.to_lowercase()),
            _ => folded.push(' '),
        }
    }
    folded
        .split_whitespace()
        .map(collapse_digraphs)
        .collect::<Vec<_>>()
        .join(" ")
}

fn collapse_digraphs(token: &str) -> String {
    token
        .replace("ae", "a")
        .replace("oe", "o")
        .replace("ue", "u")
}

fn tokens(normalized: &str) -> Vec<&str> {
    normalized.split_whitespace().collect()
}

/// Splits an artist credit into individual artists. The first entry is the primary artist.
/// A bare "and" is not a separator ("Simon and Garfunkel" is one act), but `&` is.
pub fn split_artists(artist: &str) -> Vec<String> {
    const SEPARATORS: &[&str] = &[
        " & ",
        ", ",
        "; ",
        " feat. ",
        " feat ",
        " ft. ",
        " ft ",
        " featuring ",
        " x ",
        " / ",
        " + ",
    ];

    let lower = artist.to_ascii_lowercase();
    let mut parts = Vec::new();
    let mut start = 0;
    let mut cursor = 0;
    while cursor < artist.len() {
        let hit = SEPARATORS
            .iter()
            .find(|sep| lower[cursor..].starts_with(**sep));
        match hit {
            Some(sep) => {
                parts.push(artist[start..cursor].trim());
                cursor += sep.len();
                start = cursor;
            }
            None => {
                cursor += artist[cursor..].chars().next().map_or(1, char::len_utf8);
            }
        }
    }
    parts.push(artist[start..].trim());

    let mut out: Vec<String> = Vec::new();
    for part in parts {
        if part.is_empty() || out.iter().any(|p| normalize(p) == normalize(part)) {
            continue;
        }
        out.push(part.to_string());
    }
    out
}

/// Album titles to try, longest first: the cleaned title, then the part before a subtitle
/// separator (`ef - a tale of memories.` gives `ef`).
pub fn album_variants(album: &str) -> Vec<String> {
    let cleaned = clean_album_title(album);
    let mut candidates = vec![cleaned.clone()];

    for separator in [" - ", " – ", ". ", ": ", " | "] {
        if let Some((head, _)) = cleaned.split_once(separator) {
            candidates.push(head.to_string());
        }
    }

    let mut out: Vec<String> = Vec::new();
    for candidate in candidates {
        let trimmed = candidate
            .trim_matches(|c: char| !c.is_alphanumeric())
            .to_string();
        let key = normalize(&trimmed);
        if key.chars().count() < 2 || out.iter().any(|v| normalize(v) == key) {
            continue;
        }
        out.push(trimmed);
    }
    if out.is_empty() {
        out.push(album.trim().to_string());
    }
    out
}

/// Builds the relaxation ladder for a lookup. Earlier entries are stricter.
pub fn query_ladder(album: &str, artist: &str) -> Vec<CoverQuery> {
    let variants = album_variants(album);
    let full_artist = clean_artist_name(artist);
    let full_artist = if is_neutral_artist(&full_artist) {
        None
    } else {
        Some(full_artist)
    };
    let primary = full_artist
        .as_deref()
        .and_then(|a| split_artists(a).into_iter().next());

    let mut ladder: Vec<CoverQuery> = Vec::new();
    let mut push = |album: &str, artist: Option<&str>| {
        let query = CoverQuery {
            album: album.to_string(),
            artist: artist.map(str::to_string),
        };
        let key = |q: &CoverQuery| {
            (
                normalize(&q.album),
                q.artist.as_deref().map(normalize).unwrap_or_default(),
            )
        };
        if (query.album.is_empty() && query.artist.is_none())
            || ladder.iter().any(|q| key(q) == key(&query))
        {
            return;
        }
        ladder.push(query);
    };

    let head = variants.first().map(String::as_str).unwrap_or_default();
    push(head, full_artist.as_deref());
    push(head, primary.as_deref());
    for variant in variants.iter().skip(1) {
        push(variant, primary.as_deref());
    }
    push(head, None);
    for variant in variants.iter().skip(1) {
        push(variant, None);
    }
    ladder
}

/// Similarity (0-100) between one wanted album title and a candidate title.
fn title_similarity(wanted: &str, candidate: &str) -> u32 {
    let wanted = normalize(wanted);
    let candidate = normalize(candidate);
    if wanted.is_empty() || candidate.is_empty() {
        return 0;
    }
    if wanted == candidate {
        return 100;
    }

    let wanted_tokens = tokens(&wanted);
    let candidate_tokens = tokens(&candidate);
    let (short, long) = if wanted_tokens.len() <= candidate_tokens.len() {
        (&wanted_tokens, &candidate_tokens)
    } else {
        (&candidate_tokens, &wanted_tokens)
    };

    if long.starts_with(short) {
        // A title that continues the other one ("ef" / "ef a tale of memories").
        let ratio = (short.len() * 100 / long.len()) as u32;
        return (60 + ratio * 40 / 100).min(95);
    }

    let shared = short.iter().filter(|t| long.contains(t)).count();
    let union = short.len() + long.len() - shared;
    (shared * 100 / union.max(1)) as u32
}

fn artist_matches(wanted: &[String], candidate: &str) -> bool {
    let candidate_parts: Vec<String> = split_artists(candidate)
        .iter()
        .map(|a| normalize(a))
        .collect();
    let candidate_full = normalize(candidate);
    wanted.iter().map(|a| normalize(a)).any(|w| {
        !w.is_empty()
            && (w == candidate_full
                || candidate_parts.contains(&w)
                || contains_at_token_boundary(&candidate_full, &w))
    })
}

fn contains_at_token_boundary(haystack: &str, needle: &str) -> bool {
    format!(" {haystack} ").contains(&format!(" {needle} "))
}

/// Scores how well a candidate (title + artist) matches what we are looking for, 0-100.
/// The title weighs more than the artist. A wrong artist caps an exact title below
/// [`AUTO_ACCEPT_SCORE`], and an unknown wanted artist caps the score at 85.
pub fn match_score(album: &str, artist: &str, cand_title: &str, cand_artist: &str) -> u8 {
    let cand_clean = clean_album_title(cand_title);
    let title = album_variants(album)
        .iter()
        .chain(std::iter::once(&album.to_string()))
        .map(|variant| {
            title_similarity(variant, &cand_clean).max(title_similarity(variant, cand_title))
        })
        .max()
        .unwrap_or(0);

    let wanted_artists = split_artists(&clean_artist_name(artist));
    let score = if is_neutral_artist(artist) {
        title * 85 / 100
    } else if artist_matches(&wanted_artists, cand_artist) {
        (title * 65 + 100 * 35) / 100
    } else {
        title * 65 / 100
    };
    score.min(100) as u8
}

/// Whether the artist tag says nothing useful ("Unknown Artist", "Various Artists", empty).
pub fn is_neutral_artist(artist: &str) -> bool {
    NEUTRAL_ARTISTS.contains(&normalize(artist).as_str())
}

/// Whether the album tag says nothing useful.
pub fn is_unknown_album(album: &str) -> bool {
    matches!(normalize(album).as_str(), "" | "unknown album")
}

/// Whether a candidate's artist credit contains any of the wanted artists.
pub fn artists_match(wanted: &str, candidate: &str) -> bool {
    artist_matches(&split_artists(&clean_artist_name(wanted)), candidate)
}
