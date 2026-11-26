use metadata::{
    clean_album_title, clean_artist_name, urlencoding, CoverArtArchiveClient, MusicBrainzClient,
};

#[test]
fn test_parse_release_candidates() {
    let sample_json = serde_json::json!({
        "releases": [
            {
                "id": "c3d4e5f6-7890-4123-8abc-def123456789",
                "title": "Your Name.",
                "artist-credit": [{ "name": "RADWIMPS" }],
                "date": "2016-08-24",
                "country": "JP",
                "track-count": 27,
                "score": 100
            },
            {
                "id": "11223344-5566-7788-9900-aabbccddeeff",
                "title": "Your Name. (Deluxe Edition)",
                "artist-credit": [{ "name": "RADWIMPS" }],
                "date": "2017-04-14",
                "country": "US",
                "track-count": 30,
                "score": 85
            }
        ]
    });

    let candidates = MusicBrainzClient::parse_release_candidates(&sample_json);
    assert_eq!(candidates.len(), 2);
    assert_eq!(candidates[0].mbid, "c3d4e5f6-7890-4123-8abc-def123456789");
    assert_eq!(candidates[0].score, 100);
    assert_eq!(candidates[0].track_count, Some(27));
    assert_eq!(candidates[0].artist, "RADWIMPS");
    assert_eq!(candidates[1].score, 85);
}

#[test]
fn test_url_encoding() {
    let encoded = urlencoding::encode("release:\"Your Name.\" AND artist:\"RADWIMPS\"");
    assert!(encoded.contains("%22Your%20Name.%22"));
    assert!(encoded.contains("AND"));
    assert!(encoded.contains("%22RADWIMPS%22"));
}

#[tokio::test]
async fn test_cover_art_archive_cache_hit() {
    let temp_dir = std::env::temp_dir().join("auralune_test_cover_cache");
    let covers_dir = temp_dir.join("covers");
    tokio::fs::create_dir_all(&covers_dir).await.unwrap();

    let fake_mbid = "test-mbid-1234";
    let fake_cover = covers_dir.join(format!("{}.jpg", fake_mbid));
    tokio::fs::write(&fake_cover, b"FAKE_JPEG_IMAGE_DATA")
        .await
        .unwrap();

    let client = CoverArtArchiveClient::new(&temp_dir);
    let path = client.fetch_and_cache_cover(fake_mbid).await.unwrap();

    assert_eq!(path, fake_cover);
    assert!(path.exists());

    let _ = tokio::fs::remove_dir_all(&temp_dir).await;
}

#[test]
fn test_clean_album_title() {
    assert_eq!(clean_album_title("7 (2015 Remastered)"), "7");
    assert_eq!(
        clean_album_title("Master of Puppets [Remastered]"),
        "Master of Puppets"
    );
    assert_eq!(
        clean_album_title("OK Computer (Collector's Edition) [Disc 1]"),
        "OK Computer"
    );
    assert_eq!(
        clean_album_title("Hybrid Theory (Deluxe Edition)"),
        "Hybrid Theory"
    );
    assert_eq!(clean_album_title("7"), "7");
    assert_eq!(clean_album_title("( )"), "( )");
}

#[test]
fn test_clean_album_title_matches_whole_words_only() {
    assert_eq!(clean_album_title("Ghost Stories"), "Ghost Stories");
    assert_eq!(clean_album_title("Lost Highway"), "Lost Highway");
    assert_eq!(
        clean_album_title("Lost in Translation OST"),
        "Lost in Translation"
    );
    assert_eq!(clean_album_title("Discovery CD 1"), "Discovery");
    assert_eq!(
        clean_album_title("Abbey Road Remastered Deluxe Edition"),
        "Abbey Road"
    );
}

#[test]
fn test_clean_album_title_handles_case_folding_that_changes_length() {
    // "İ".to_lowercase() has more bytes than "İ", which used to cause a panic when slicing.
    assert_eq!(clean_album_title("İstanbul Remastered"), "İstanbul");
    assert_eq!(clean_album_title("STRAẞE Deluxe"), "STRAẞE");
}

#[test]
fn test_clean_artist_name() {
    assert_eq!(clean_artist_name("In Extremo (Live)"), "In Extremo");
    assert_eq!(clean_artist_name("Linkin Park"), "Linkin Park");
}

#[tokio::test]
async fn test_search_cover_candidates_in_extremo_local_mock() {
    use std::io::{Read, Write};
    use std::net::TcpListener;

    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let base_url = format!("http://{}", listener.local_addr().unwrap());

    let handle = std::thread::spawn(move || {
        // Up to 5 concurrent/fallback requests (Deezer adv/gen + iTunes q1/q2/fallback)
        for _ in 0..5 {
            let Ok((mut stream, _)) = listener.accept() else {
                break;
            };
            let _ = stream.set_read_timeout(Some(std::time::Duration::from_millis(500)));
            let mut buf = [0u8; 4096];
            let n = stream.read(&mut buf).unwrap_or(0);
            let req = String::from_utf8_lossy(&buf[..n]);
            let first_line = req.lines().next().unwrap_or("");
            let body = if first_line.contains("/search/album") {
                r#"{"data":[{"title":"7","artist":{"name":"In Extremo"},"cover_xl":"https://cdn-images.dzcdn.net/images/cover/abc/1000x1000-000000-80-0-0.jpg","cover_medium":"https://cdn-images.dzcdn.net/images/cover/abc/250x250-000000-80-0-0.jpg"}]}"#
            } else {
                r#"{"results":[{"collectionName":"7","artistName":"In Extremo","artworkUrl100":"https://is1-ssl.mzstatic.com/image/thumb/Music/v4/100x100bb.jpg"}]}"#
            };
            let _ = write!(
                stream,
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
        }
    });

    let temp_dir = std::env::temp_dir().join("auralune_test_cover_candidates");
    let client = CoverArtArchiveClient::with_search_base_urls(&temp_dir, &base_url, &base_url);
    let candidates = client
        .search_cover_candidates("7 (2015 Remastered)", "In Extremo")
        .await;
    drop(client);
    let _ = handle.join();

    assert!(
        !candidates.is_empty(),
        "Cover candidates for '7' In Extremo should be found!"
    );
    let first = &candidates[0];
    assert_eq!(first.title, "7");
    assert_eq!(first.artist, "In Extremo");
    assert!(first.full_url.contains("1000x1000") || first.full_url.contains("1200x1200"));
}
