use auralune_desktop::media_protocol::{
    album_cover_url, bump_album_cover_version, current_cover_url, parse_media_route, parse_range,
    track_cover_url, ByteRange, MediaRoute,
};

#[test]
fn parses_album_track_and_current_cover_routes() {
    assert_eq!(
        parse_media_route("auralune-media://localhost/cover/album/42?s=256&v=0123abcd"),
        Some(MediaRoute::AlbumCover {
            album_id: 42,
            size: 256,
        })
    );
    assert_eq!(
        parse_media_route("/cover/album/7?s=768"),
        Some(MediaRoute::AlbumCover {
            album_id: 7,
            size: 768,
        })
    );
    assert_eq!(
        parse_media_route("/cover/track/99"),
        Some(MediaRoute::TrackCover {
            track_id: 99,
            size: 256,
        })
    );
    assert_eq!(
        parse_media_route("auralune-media://localhost/cover/current?s=768&v=ff"),
        Some(MediaRoute::CurrentCover { size: 768 })
    );
}

#[test]
fn parses_valid_background_routes_and_rejects_traversal() {
    let sha = "a".repeat(64);
    assert_eq!(
        parse_media_route(&format!("auralune-media://localhost/bg/{sha}.mp4")),
        Some(MediaRoute::Background {
            file_name: format!("{sha}.mp4"),
        })
    );
    assert_eq!(
        parse_media_route("/bg/deadbeef.WEBM"),
        Some(MediaRoute::Background {
            file_name: "deadbeef.WEBM".to_string(),
        })
    );
    assert_eq!(parse_media_route("/bg/../etc/passwd"), None);
    assert_eq!(parse_media_route("/bg/foo.svg"), None);
    assert_eq!(parse_media_route("/bg/foo.bar.png"), None);
    assert_eq!(parse_media_route("/cover/album/0?s=256"), None);
    assert_eq!(parse_media_route("/cover/album/-5?s=256"), None);
    assert_eq!(parse_media_route("/cover/album/1?s=1024"), None);
}

#[test]
fn parses_http_byte_ranges() {
    assert_eq!(
        parse_range("bytes=0-1023", 4096),
        Some(ByteRange {
            start: 0,
            end: 1023
        })
    );
    assert_eq!(
        parse_range("bytes=1000-", 4096),
        Some(ByteRange {
            start: 1000,
            end: 4095,
        })
    );
    assert_eq!(
        parse_range("bytes=0-999999", 4096),
        Some(ByteRange {
            start: 0,
            end: 4095
        })
    );
    assert_eq!(
        parse_range("bytes=-512", 4096),
        Some(ByteRange {
            start: 3584,
            end: 4095,
        })
    );
    assert_eq!(parse_range("bytes=5000-", 4096), None);
    assert_eq!(parse_range("bytes=200-100", 4096), None);
    assert_eq!(parse_range("bytes=0-1,2-3", 4096), None);
    assert_eq!(parse_range("bytes=0-0", 0), None);
}

#[test]
fn url_builders_carry_ids_and_cache_bust_versions() {
    let url = album_cover_url(12, "/home/music/Album/cover.jpg");
    assert!(url.starts_with("auralune-media://localhost/cover/album/12?s=256&v="));
    assert!(!url.contains("/home/music"));

    let gen = bump_album_cover_version(12);
    let busted = album_cover_url(12, "/home/music/Album/cover.jpg");
    assert!(busted.ends_with(&format!("-{gen}")));
    assert_ne!(url, busted);

    assert_eq!(
        album_cover_url(12, "https://coverartarchive.org/release/1/front"),
        "https://coverartarchive.org/release/1/front"
    );
    assert_eq!(
        track_cover_url(55, "abc"),
        "auralune-media://localhost/cover/track/55?s=256&v=abc"
    );
    assert_eq!(
        current_cover_url("def"),
        "auralune-media://localhost/cover/current?s=256&v=def"
    );
}
