use metadata::cover_query::{
    album_variants, artists_match, is_unknown_album, match_score, normalize, query_ladder,
    split_artists, CoverQuery,
};
use metadata::{MusicBrainzClient, AUTO_ACCEPT_SCORE};

const EF_ALBUM: &str = "ef - a tale of memories. ORIGINAL SOUNDTRACK -e";
const EF_ARTIST: &str = "TENMON & Eiichiro Yanagi";

#[test]
fn normalize_folds_german_spellings_together() {
    assert_eq!(
        normalize("Kein Blick zurück"),
        normalize("Kein Blick zurueck")
    );
    assert_eq!(normalize("Straße"), normalize("Strasse"));
    assert_eq!(normalize("Rock & Roll!"), "rock and roll");
}

#[test]
fn split_artists_keeps_primary_first() {
    assert_eq!(
        split_artists(EF_ARTIST),
        vec!["TENMON".to_string(), "Eiichiro Yanagi".to_string()]
    );
    assert_eq!(
        split_artists("Artist A feat. Artist B, Artist C"),
        vec!["Artist A", "Artist B", "Artist C"]
    );
}

#[test]
fn split_artists_does_not_break_a_single_act() {
    assert_eq!(
        split_artists("Simon and Garfunkel"),
        vec!["Simon and Garfunkel"]
    );
    assert_eq!(split_artists("In Extremo"), vec!["In Extremo"]);
}

#[test]
fn album_variants_cut_subtitles() {
    let variants = album_variants(EF_ALBUM);
    assert!(variants.contains(&"ef".to_string()), "{variants:?}");
    assert!(variants[0].starts_with("ef - a tale of memories"));
}

#[test]
fn ladder_goes_from_strict_to_album_only() {
    let ladder = query_ladder(EF_ALBUM, EF_ARTIST);
    assert_eq!(ladder[0].artist.as_deref(), Some(EF_ARTIST));
    assert_eq!(ladder[1].artist.as_deref(), Some("TENMON"));
    assert!(ladder.iter().any(|q| q.album == "ef" && q.artist.is_none()));
    let last: &CoverQuery = ladder.last().unwrap();
    assert!(last.artist.is_none());
}

#[test]
fn ladder_ignores_neutral_artists() {
    let ladder = query_ladder("Kein Blick zurueck", "Unknown Artist");
    assert!(ladder.iter().all(|q| q.artist.is_none()));
}

#[test]
fn exact_album_and_artist_is_accepted() {
    let score = match_score(
        "Kein Blick zurueck",
        "In Extremo",
        "Kein Blick zurück (Deluxe Edition)",
        "In Extremo",
    );
    assert!(score >= AUTO_ACCEPT_SCORE, "score {score}");
}

#[test]
fn same_title_by_another_artist_is_rejected() {
    let score = match_score("7", "In Extremo", "7", "Some Other Band");
    assert!(score < AUTO_ACCEPT_SCORE, "score {score}");
}

#[test]
fn same_artist_but_other_album_is_rejected() {
    let score = match_score(
        "Kein Blick zurueck",
        "In Extremo",
        "Sterneneisen",
        "In Extremo",
    );
    assert!(score < AUTO_ACCEPT_SCORE, "score {score}");
}

#[test]
fn soundtrack_title_matches_through_the_short_variant() {
    let score = match_score(
        EF_ALBUM,
        EF_ARTIST,
        "ef - a tale of memories. Original Soundtrack",
        "Tenmon",
    );
    assert!(score >= AUTO_ACCEPT_SCORE, "score {score}");
}

#[test]
fn unknown_artist_caps_the_score_below_perfect() {
    let score = match_score(
        "Sterneneisen",
        "Unknown Artist",
        "Sterneneisen",
        "In Extremo",
    );
    assert!((AUTO_ACCEPT_SCORE..=85).contains(&score), "score {score}");
}

#[test]
fn artists_match_any_credited_artist() {
    assert!(artists_match(EF_ARTIST, "Eiichiro Yanagi"));
    assert!(!artists_match(EF_ARTIST, "Someone Else"));
}

#[test]
fn unknown_album_placeholder_is_detected() {
    assert!(is_unknown_album("Unknown Album"));
    assert!(is_unknown_album("  "));
    assert!(!is_unknown_album("Sterneneisen"));
}

#[test]
fn musicbrainz_queries_relax_from_strict_to_free_text() {
    let queries = MusicBrainzClient::release_queries(EF_ALBUM, EF_ARTIST);
    assert!(queries[0].contains("artist:\"TENMON & Eiichiro Yanagi\""));
    assert!(queries[1].contains("artist:\"TENMON\""));
    assert!(queries.iter().any(|q| !q.contains("artist:")));
    assert!(MusicBrainzClient::release_queries("", "x").is_empty());
}
