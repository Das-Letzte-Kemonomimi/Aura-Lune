use metadata::cover_query::{
    album_variants, artists_match, is_ambiguity_prone, is_unknown_album, match_score,
    match_score_with_context, normalize, query_ladder, split_artists, AlbumLookupContext,
    CandidateContext, CoverQuery,
};
use metadata::{
    clean_artist_name, MusicBrainzClient, AUTO_ACCEPT_SCORE, BACKGROUND_AUTO_ACCEPT_SCORE,
};

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
fn ladder_goes_from_strict_to_album_only_without_bare_short_prefix() {
    let ladder = query_ladder(EF_ALBUM, EF_ARTIST);
    assert_eq!(ladder[0].artist.as_deref(), Some(EF_ARTIST));
    assert_eq!(ladder[1].artist.as_deref(), Some("TENMON"));
    // Derived 2-letter "ef" from a long title is tried with the artist, never artist-less.
    assert!(ladder.iter().any(|q| q.album == "ef" && q.artist.is_some()));
    assert!(!ladder.iter().any(|q| q.album == "ef" && q.artist.is_none()));
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

#[test]
fn swedish_post_rock_ef_is_rejected_for_ef_ost_even_with_neutral_artist() {
    let long_ost = "ef - a tale of memories. ORIGINAL SOUNDTRACK -espressivo-";
    assert!(match_score(long_ost, "TENMON & Eiichiro Yanagi", "ef", "ef") < AUTO_ACCEPT_SCORE);
    assert!(match_score(long_ost, "Unknown Artist", "ef", "ef") < AUTO_ACCEPT_SCORE);
}

#[test]
fn homonymous_artists_are_not_confused_by_substring_match() {
    assert!(!artists_match(
        "ELISA",
        "VANITY VAULT STUDIO by Elisa G. Music Artist"
    ));
    assert!(!artists_match("ELISA", "Elisa Toffoli"));
    assert!(artists_match(
        "Shindou Kei (cv: Okada Junko)",
        "Kei Shindou & Junko Okada"
    ));
    assert!(artists_match(
        "Tenmon & Eiichirou Yanagi",
        "TENMON & Eiichiro Yanagi"
    ));
}

#[test]
fn clean_artist_name_strips_quoted_cv_credits() {
    assert_eq!(
        clean_artist_name("Yuko Amamiya \"cv. Yumiko Nakajima\""),
        "Yuko Amamiya"
    );
    assert_eq!(
        clean_artist_name("Miyako & Kei & Chihiro \"cv. Hiroko T. & Junko O.\""),
        "Miyako & Kei & Chihiro"
    );
}

#[test]
fn euphoric_field_suffix_matches_elisa_single_high_confidence() {
    let score = match_score(
        "ef - a tale of memories. OP Single - euphoric field",
        "ELISA",
        "euphoric field",
        "ELISA",
    );
    assert!(score >= BACKGROUND_AUTO_ACCEPT_SCORE, "score {score}");
}

#[test]
fn context_disambiguates_same_title_and_same_name_artist_albums() {
    let ctx = AlbumLookupContext {
        year: Some(2008),
        track_count: Some(31),
        sample_tracks: vec!["Less than 45sec.".into()],
        release_mbid: None,
    };
    let wrong_classical = CandidateContext {
        title: "Espressivo",
        artist: "村治佳織",
        year: Some(2005),
        track_count: Some(15),
        release_mbid: None,
    };
    let right_ost = CandidateContext {
        title: "ef – a tale of memories. ORIGINAL SOUNDTRACK 〜espressivo〜",
        artist: "TENMON & Eiichiro Yanagi & minori",
        year: Some(2008),
        track_count: Some(31),
        release_mbid: Some("d38b402a-ee1b-427a-b10c-b8127596d59c"),
    };
    let bad = match_score_with_context(
        "ef - a tale of memories. ORIGINAL SOUNDTRACK -espressivo-",
        "TENMON & Eiichiro Yanagi",
        &ctx,
        &wrong_classical,
    );
    let good = match_score_with_context(
        "ef - a tale of memories. ORIGINAL SOUNDTRACK -espressivo-",
        "TENMON & Eiichiro Yanagi",
        &ctx,
        &right_ost,
    );
    assert!(bad < 50, "wrong score should be very low: {bad}");
    assert!(good >= BACKGROUND_AUTO_ACCEPT_SCORE, "right score {good}");
    assert!(is_ambiguity_prone("ef", "ELISA"));
}

const FELICE_ALBUM: &str = "ef - a tale of melodies. ORIGINAL SOUNDTRACK 2 -felice-";
const FELICE_MBID: &str = "a12cd2ef-4689-4520-92ed-48181765d453";

fn felice_release() -> CandidateContext<'static> {
    CandidateContext {
        title: "ef – a tale of melodies. ORIGINAL SOUNDTRACK 2 〜felice〜",
        artist: "TENMON & Eiichiro Yanagi / minori",
        year: Some(2009),
        track_count: Some(35),
        release_mbid: Some(FELICE_MBID),
    }
}

#[test]
fn guest_vocalist_artist_tag_is_not_enough_to_auto_accept_on_its_own() {
    // `ELISA` sang three tracks of the OST; the release is credited to TENMON & Eiichiro Yanagi.
    // A partial album (3 of 35 tracks) must not score as a confident match by title alone.
    let partial = AlbumLookupContext {
        year: Some(2009),
        track_count: Some(3),
        ..Default::default()
    };
    let score = match_score_with_context(FELICE_ALBUM, "ELISA", &partial, &felice_release());
    assert!(score < AUTO_ACCEPT_SCORE, "score {score}");
}

#[test]
fn whole_release_context_accepts_the_release_despite_a_guest_artist() {
    // The storage layer folds split sibling albums back together: 29 + 1 + 3 + 2 = 35 tracks.
    let whole = AlbumLookupContext {
        year: Some(2009),
        track_count: Some(35),
        ..Default::default()
    };
    let score = match_score_with_context(FELICE_ALBUM, "ELISA", &whole, &felice_release());
    assert!(score >= AUTO_ACCEPT_SCORE, "score {score}");
}

#[test]
fn inherited_release_mbid_pins_the_release_whatever_the_artist_tag_says() {
    let inherited = AlbumLookupContext {
        year: Some(2009),
        track_count: Some(3),
        release_mbid: Some(FELICE_MBID.to_string()),
        ..Default::default()
    };
    let score = match_score_with_context(FELICE_ALBUM, "ELISA", &inherited, &felice_release());
    assert_eq!(score, 100);
}

#[test]
fn musicbrainz_tries_the_bare_title_before_shortened_artist_variants() {
    let queries = MusicBrainzClient::release_queries(FELICE_ALBUM, "ELISA");
    let bare_title = queries
        .iter()
        .position(|q| !q.contains("artist:") && q.contains("felice"))
        .expect("an artist-less title query exists");
    let first_variant = queries
        .iter()
        .position(|q| q.contains("release:\"ef\" AND artist:"))
        .expect("the short `ef` variant is still tried with the artist");
    assert!(
        bare_title < first_variant,
        "bare title at {bare_title}, short variant at {first_variant}: {queries:?}"
    );
}
