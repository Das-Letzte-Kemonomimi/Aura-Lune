use domain::cue::CueSheet;
use domain::m3u::{M3uEntry, M3uPlaylist};
use std::path::Path;

#[test]
fn test_cue_parser_full_album_with_pregap() {
    let cue_text = r#"
REM GENRE "Progressive Rock"
REM DATE 2024
PERFORMER "Aura Band"
TITLE "Celestial Horizons"
FILE "album.flac" WAVE
  TRACK 01 AUDIO
    TITLE "Dawn Overture"
    PERFORMER "Aura Band"
    INDEX 01 00:00:00
  TRACK 02 AUDIO
    TITLE "Solar Flares"
    PERFORMER "Guest Guitarist"
    INDEX 00 03:45:00
    INDEX 01 03:48:50
  TRACK 03 AUDIO
    TITLE "Lunar Solitude"
    INDEX 01 07:12:00
"#;

    let cue = CueSheet::parse(cue_text).expect("CUE sheet should parse successfully");
    assert_eq!(cue.file_path, "album.flac");
    assert_eq!(cue.album_title.as_deref(), Some("Celestial Horizons"));
    assert_eq!(cue.album_artist.as_deref(), Some("Aura Band"));
    assert_eq!(cue.genre.as_deref(), Some("Progressive Rock"));
    assert_eq!(cue.date.as_deref(), Some("2024"));
    assert_eq!(cue.tracks.len(), 3);

    // Track 1
    assert_eq!(cue.tracks[0].number, 1);
    assert_eq!(cue.tracks[0].title, "Dawn Overture");
    assert_eq!(cue.tracks[0].performer.as_deref(), Some("Aura Band"));
    assert_eq!(cue.tracks[0].start_offset_ms, 0);

    // Track 2 with INDEX 00 pregap and INDEX 01
    assert_eq!(cue.tracks[1].number, 2);
    assert_eq!(cue.tracks[1].title, "Solar Flares");
    assert_eq!(cue.tracks[1].performer.as_deref(), Some("Guest Guitarist"));
    // 03:48.50 -> 3*60*1000 + 48*1000 + 50*(1000/75) = 180000 + 48000 + 666 = 228666 ms
    assert!(cue.tracks[1].start_offset_ms > 228000);

    // Duration calculation of track 1: next_start - cur_start
    assert!(cue.tracks[0].duration_ms.is_some());
    assert_eq!(
        cue.tracks[0].duration_ms.unwrap(),
        cue.tracks[1].start_offset_ms
    );

    // Track 3
    assert_eq!(cue.tracks[2].number, 3);
    assert_eq!(cue.tracks[2].title, "Lunar Solitude");
    assert_eq!(
        cue.tracks[2].end_offset_ms, None,
        "Last track has unknown end until file duration is known"
    );
}

#[test]
fn test_cue_parser_malformed_returns_error() {
    let empty_cue = "REM GENRE Ambient\nREM DATE 2020\n";
    let res = CueSheet::parse(empty_cue);
    assert!(
        res.is_err(),
        "Empty CUE without TRACK entries must return error"
    );
}

#[test]
fn test_m3u_extended_parsing_and_export_roundtrip() {
    let m3u_content = r#"#EXTM3U
#EXTINF:180,Artist One - Song Alpha
track1.flac
#EXTINF:240,Artist Two - Song Beta
subfolder\track2.mp3
#EXTINF:-1,Live Radio Stream
https://stream.example.com/live
"#;

    let base = Path::new("/home/user/music");
    let playlist =
        M3uPlaylist::parse(m3u_content, "Favorite Mix", Some(base)).expect("M3U should parse");

    assert_eq!(playlist.name, "Favorite Mix");
    assert_eq!(playlist.entries.len(), 3);

    // Entry 1: relative path resolved with base
    assert_eq!(playlist.entries[0].title.as_deref(), Some("Song Alpha"));
    assert_eq!(playlist.entries[0].artist.as_deref(), Some("Artist One"));
    assert_eq!(playlist.entries[0].duration_seconds, Some(180));
    assert_eq!(
        playlist.entries[0].path_or_uri,
        "/home/user/music/track1.flac"
    );

    // Entry 2: Windows backslash normalized
    assert_eq!(playlist.entries[1].title.as_deref(), Some("Song Beta"));
    assert!(playlist.entries[1]
        .path_or_uri
        .contains("subfolder/track2.mp3"));

    // Entry 3: HTTP Stream (not prepended with base path)
    assert_eq!(
        playlist.entries[2].path_or_uri,
        "https://stream.example.com/live"
    );
    assert_eq!(
        playlist.entries[2].title.as_deref(),
        Some("Live Radio Stream")
    );
    assert_eq!(playlist.entries[2].duration_seconds, Some(-1));

    // Export round-trip
    let entries = vec![M3uEntry {
        path_or_uri: "/music/track1.flac".to_string(),
        title: Some("Song Alpha".to_string()),
        artist: Some("Artist One".to_string()),
        duration_seconds: Some(180),
    }];
    let exported = M3uPlaylist::export_to_m3u8("My Mix", &entries, None, false);
    assert!(exported.starts_with("#EXTM3U\n"));
    assert!(exported.contains("#PLAYLIST:My Mix\n"));
    assert!(exported.contains("#EXTINF:180,Artist One - Song Alpha\n"));
    assert!(exported.contains("/music/track1.flac\n"));
}

#[test]
fn test_parse_cue_sheet_additional() {
    let sample_cue = r#"
REM GENRE Anime
REM DATE 2023
PERFORMER "Yuki Kajiura"
TITLE "FictionJunction OST"
FILE "FictionJunction.flac" WAVE
  TRACK 01 AUDIO
    TITLE "Prologue ~ The Beginning"
    PERFORMER "FictionJunction"
    INDEX 01 00:00:00
  TRACK 02 AUDIO
    TITLE "Swordland Symphonic"
    PERFORMER "FictionJunction"
    INDEX 00 02:40:15
    INDEX 01 02:42:00
  TRACK 03 AUDIO
    TITLE "Lapis Lazuli (Ending Theme)"
    PERFORMER "Eir Aoi"
    INDEX 01 06:15:37
"#;

    let sheet = CueSheet::parse(sample_cue).expect("Parsing the CUE should succeed");
    assert_eq!(sheet.file_path, "FictionJunction.flac");
    assert_eq!(sheet.album_title.as_deref(), Some("FictionJunction OST"));
    assert_eq!(sheet.tracks.len(), 3);
    assert_eq!(sheet.tracks[0].duration_ms, Some(162000));
}

#[test]
fn test_parse_m3u_simple_absolute() {
    let content = r#"#EXTM3U
#EXTINF:215,Das Letzte Kemonomimi - Skrzydła Białe
/home/mimi/Music/skrzydla_biale.flac
#EXTINF:180,Artist Name - Song Title
/home/mimi/Music/song2.mp3
"#;
    let playlist = M3uPlaylist::parse(content, "Test List", None).unwrap();
    assert_eq!(playlist.name, "Test List");
    assert_eq!(playlist.entries.len(), 2);
    assert_eq!(playlist.entries[0].title.as_deref(), Some("Skrzydła Białe"));
    assert_eq!(playlist.entries[0].duration_seconds, Some(215));
}

#[test]
fn test_cue_without_tracks_is_a_parse_error() {
    use domain::{CueSheet, DomainError};
    let err = CueSheet::parse("TITLE \"Pusty album\"\n").unwrap_err();
    assert!(matches!(err, DomainError::Parse(_)), "{err:?}");
}

#[test]
fn test_invalid_theme_is_a_validation_error() {
    use domain::DomainError;
    let mut theme = domain::default_themes().remove(0);
    theme.name = "  ".into();
    assert!(matches!(theme.validate(), Err(DomainError::Validation(_))));
}
