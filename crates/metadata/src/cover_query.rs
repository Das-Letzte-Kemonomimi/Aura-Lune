//! Pure helpers for cover art lookups: text normalization, artist splitting,
//! query relaxation and context-aware candidate scoring. No I/O, so everything is unit-testable.
//!
//! The lookup order is always album first, then artist, and it relaxes step by step
//! while guarding against short-prefix and same-name artist false positives.

use crate::{clean_album_title, clean_artist_name};

/// Minimum [`match_score`] for callers that pick a cover on an explicit user request
/// (Discord Rich Presence fallback, single-album manual auto-fetch). A mismatch is worse than none.
pub const AUTO_ACCEPT_SCORE: u8 = 75;

/// Stricter [`match_score`] required for unattended background cover fetching across the library.
pub const BACKGROUND_AUTO_ACCEPT_SCORE: u8 = 90;

/// Additional metadata describing an album being matched, used to disambiguate same-name artists
/// and homonymous album titles (e.g. `ELISA` anime vs `Elisa`, `ef` anime vs Swedish band `ef`).
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct AlbumLookupContext {
    pub year: Option<i64>,
    pub track_count: Option<usize>,
    pub sample_tracks: Vec<String>,
    pub release_mbid: Option<String>,
}

/// Candidate release metadata used when scoring against [`AlbumLookupContext`].
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct CandidateContext<'a> {
    pub title: &'a str,
    pub artist: &'a str,
    pub year: Option<i64>,
    pub track_count: Option<usize>,
    pub release_mbid: Option<&'a str>,
}

/// Artist names that carry no information for matching.
const NEUTRAL_ARTISTS: &[&str] = &["unknown artist", "various artists", "various", "va", ""];

/// Words stripped from query substrings when checking whether a short variant is distinctive.
const GENERIC_PREFIX_TOKENS: &[&str] = &[
    "op",
    "ed",
    "ed2",
    "ed3",
    "single",
    "theme",
    "ending",
    "opening",
    "original",
    "soundtrack",
    "ost",
    "disc",
];

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

/// Album titles to try, from most specific to relaxed:
/// 1. Cleaned title (keeping main words intact)
/// 2. Meaningful suffixes after separators (e.g. `ef - ... OP Single - euphoric field` -> `euphoric field`)
/// 3. Prefixes before subtitle separators (`ef - a tale of memories`, skipping ultra-short fragments from multi-word titles unless helpful with artist)
pub fn album_variants(album: &str) -> Vec<String> {
    let cleaned = clean_album_title(album);
    let mut candidates = vec![cleaned.clone()];

    // Collect suffixes first from the last separator (`- euphoric field`, `-espressivo-`), since
    // Japanese OST/single tags often put the franchise prefix first and actual release title last.
    for separator in [" - ", " – ", " — ", ": "] {
        if let Some((_, tail)) = cleaned.rsplit_once(separator) {
            let trimmed_tail = tail.trim_matches(|c: char| !c.is_alphanumeric());
            if normalize(trimmed_tail).chars().count() >= 4 {
                candidates.push(trimmed_tail.to_string());
            }
        }
    }

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

fn is_short_derived_variant(variant: &str, full_norm: &str) -> bool {
    let v_norm = normalize(variant);
    let v_tokens = tokens(&v_norm);
    let f_tokens = tokens(full_norm);
    f_tokens.len() >= 3
        && (v_norm.chars().count() <= 3 || (v_tokens.len() == 1 && v_norm.chars().count() <= 4))
}

/// Builds the relaxation ladder for a lookup. Earlier entries are stricter.
/// Derived ultra-short fragments (like 2-char franchise prefixes `ef` from long titles)
/// are only queried with an artist constraint, never artist-less.
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
    let head = variants.first().map(String::as_str).unwrap_or_default();
    let head_norm = normalize(head);

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

    push(head, full_artist.as_deref());
    push(head, primary.as_deref());
    for variant in variants.iter().skip(1) {
        push(variant, primary.as_deref());
    }
    push(head, None);
    for variant in variants.iter().skip(1) {
        if !is_short_derived_variant(variant, &head_norm) {
            push(variant, None);
        }
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

/// Conservative romanization folding for >= 6-char tokens (e.g. `eiichirou` == `eiichiro`,
/// `yuukyuu` == `yukyu`), applied only when direct normalized strings differ.
fn fold_romanization(norm: &str) -> String {
    norm.split_whitespace()
        .map(|tok| {
            if tok.len() >= 6 {
                tok.replace("ou", "o").replace("uu", "u")
            } else {
                tok.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// Matches two single artist names cleanly without arbitrary substring matching inside longer names
/// (so `"ELISA"` does NOT match `"Elisa Toffoli"` or `"Elisa G. Music Artist"`).
fn single_artist_equals(wanted: &str, candidate: &str) -> bool {
    if wanted.is_empty() || candidate.is_empty() {
        return false;
    }
    if wanted == candidate {
        return true;
    }
    if fold_romanization(wanted) == fold_romanization(candidate) {
        return true;
    }
    // Two-word Japanese/Eastern name-order flip: `"shindou kei"` == `"kei shindou"`.
    let wt: Vec<&str> = wanted.split_whitespace().collect();
    let ct: Vec<&str> = candidate.split_whitespace().collect();
    wt.len() == 2
        && ct.len() == 2
        && wt[0] == ct[1]
        && wt[1] == ct[0]
        && wt.iter().all(|t| t.len() >= 3)
}

fn artist_matches(wanted: &[String], candidate: &str) -> bool {
    let candidate_parts: Vec<String> = split_artists(candidate)
        .iter()
        .map(|a| normalize(a))
        .collect();
    let candidate_full = normalize(candidate);
    wanted
        .iter()
        .map(|a| normalize(a))
        .filter(|w| !w.is_empty())
        .any(|w| {
            single_artist_equals(&w, &candidate_full)
                || candidate_parts
                    .iter()
                    .any(|cp| single_artist_equals(&w, cp))
        })
}

fn strip_generic_tokens(norm: &str) -> String {
    norm.split_whitespace()
        .filter(|t| !GENERIC_PREFIX_TOKENS.contains(t))
        .collect::<Vec<_>>()
        .join(" ")
}

fn compute_title_score(album: &str, cand_title: &str) -> u32 {
    let cand_clean = clean_album_title(cand_title);
    let wanted_clean = clean_album_title(album);
    let direct_clean = strip_generic_tokens(&normalize(&wanted_clean));
    let cand_stripped = strip_generic_tokens(&normalize(&cand_clean));

    let base_max = title_similarity(album, cand_title)
        .max(title_similarity(&wanted_clean, &cand_clean))
        .max(title_similarity(&wanted_clean, cand_title))
        .max(if direct_clean.chars().count() >= 4 {
            title_similarity(&direct_clean, &cand_stripped)
        } else {
            0
        });

    let full_norm = normalize(&wanted_clean);
    let full_token_count = tokens(&full_norm).len().max(1);
    let variant_max = album_variants(album)
        .into_iter()
        .filter(|variant| !is_short_derived_variant(variant, &full_norm))
        .map(|variant| {
            let sim =
                title_similarity(&variant, &cand_clean).max(title_similarity(&variant, cand_title));
            let v_tokens = tokens(&normalize(&variant)).len().max(1);
            if v_tokens < full_token_count {
                // Shortened suffix/prefix variants cap slightly below an exact full-title match.
                sim.min(95)
            } else {
                sim
            }
        })
        .max()
        .unwrap_or(0);

    base_max.max(variant_max)
}

/// Scores how well a candidate (title + artist) matches what we are looking for, 0-100.
/// The title weighs more than the artist. A wrong artist caps an exact title below
/// [`AUTO_ACCEPT_SCORE`], and an unknown wanted artist caps the score at 85.
pub fn match_score(album: &str, artist: &str, cand_title: &str, cand_artist: &str) -> u8 {
    let title = compute_title_score(album, cand_title);
    let cleaned_artist = clean_artist_name(artist);
    let wanted_artists = split_artists(&cleaned_artist);
    let score = if is_neutral_artist(&cleaned_artist) {
        title * 85 / 100
    } else if artist_matches(&wanted_artists, cand_artist) {
        (title * 65 + 100 * 35) / 100
    } else {
        title * 65 / 100
    };
    score.min(100) as u8
}

/// Context-aware match score: combines text matching with release year and track-count checks
/// so two artists sharing the same name (or homonymous album titles) are disambiguated cleanly.
pub fn match_score_with_context(
    album: &str,
    artist: &str,
    ctx: &AlbumLookupContext,
    cand: &CandidateContext<'_>,
) -> u8 {
    if let (Some(wanted_mbid), Some(cand_mbid)) = (
        ctx.release_mbid.as_deref().filter(|m| !m.trim().is_empty()),
        cand.release_mbid.filter(|m| !m.trim().is_empty()),
    ) {
        if wanted_mbid.eq_ignore_ascii_case(cand_mbid) {
            return 100;
        }
    }

    let mut score = i32::from(match_score(album, artist, cand.title, cand.artist));

    if let (Some(wy), Some(cy)) = (ctx.year, cand.year) {
        let diff = (wy - cy).abs();
        if diff <= 1 {
            score += 6;
        } else if diff >= 4 {
            score -= 22;
        }
    }

    if let (Some(wt), Some(ct)) = (
        ctx.track_count.filter(|&t| t >= 2),
        cand.track_count.filter(|&t| t >= 1),
    ) {
        let diff = wt.abs_diff(ct);
        let max_t = wt.max(ct);
        let min_t = wt.min(ct);
        if diff == 0 || (wt >= 5 && diff <= 1) {
            score += 8;
        } else if diff >= 8 || (diff > 2 && max_t >= min_t * 2) {
            score -= 25;
        }
    }

    score.clamp(0, 100) as u8
}

/// True when the query metadata alone is prone to homonym/short-name collisions
/// (neutral artist, ultra-short artist/album name like `ef`, or single-word artist).
pub fn is_ambiguity_prone(album: &str, artist: &str) -> bool {
    let cleaned_artist = clean_artist_name(artist);
    if is_neutral_artist(&cleaned_artist) {
        return true;
    }
    let norm_artist = normalize(&cleaned_artist);
    let artist_words = tokens(&norm_artist);
    if artist_words.len() == 1 && norm_artist.chars().count() <= 5 {
        return true;
    }
    let norm_album = normalize(&clean_album_title(album));
    tokens(&norm_album).len() == 1 && norm_album.chars().count() <= 4
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
