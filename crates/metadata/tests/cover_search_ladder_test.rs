use metadata::CoverArtArchiveClient;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

/// Serves JSON bodies chosen from the request line until the test ends.
async fn spawn_mock(respond: fn(&str) -> String) -> String {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base_url = format!("http://{}", listener.local_addr().unwrap());
    tokio::spawn(async move {
        loop {
            let Ok((mut stream, _)) = listener.accept().await else {
                break;
            };
            tokio::spawn(async move {
                let mut buf = [0u8; 4096];
                let n = stream.read(&mut buf).await.unwrap_or(0);
                let request = String::from_utf8_lossy(&buf[..n]).to_string();
                let first_line = request.lines().next().unwrap_or("");
                let body = respond(first_line);
                let _ = stream
                    .write_all(
                        format!(
                            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                            body.len()
                        )
                        .as_bytes(),
                    )
                    .await;
            });
        }
    });
    base_url
}

fn ef_only_for_primary_artist(request_line: &str) -> String {
    let is_deezer = request_line.contains("/search/album");
    // The full artist string finds nothing; only the primary artist alone does.
    let finds_album = request_line.contains("TENMON") && !request_line.contains("Eiichiro");
    match (is_deezer, finds_album) {
        (true, true) => r#"{"data":[{"title":"ef - a tale of memories. Original Soundtrack","artist":{"name":"TENMON"},"cover_xl":"https://cdn.example/ef/1000x1000.jpg","cover_medium":"https://cdn.example/ef/250x250.jpg"}]}"#.to_string(),
        (true, false) => r#"{"data":[]}"#.to_string(),
        (false, _) => r#"{"results":[]}"#.to_string(),
    }
}

fn unrelated_album_for_everything(request_line: &str) -> String {
    if request_line.contains("/search/album") {
        r#"{"data":[{"title":"Totally Different Album","artist":{"name":"Other Band"},"cover_xl":"https://cdn.example/x/1000x1000.jpg","cover_medium":"https://cdn.example/x/250x250.jpg"}]}"#.to_string()
    } else {
        r#"{"results":[]}"#.to_string()
    }
}

fn client(base_url: &str, tag: &str) -> CoverArtArchiveClient {
    let dir = std::env::temp_dir().join(format!("auralune_test_cover_ladder_{tag}"));
    CoverArtArchiveClient::with_search_base_urls(dir, base_url, base_url)
}

#[tokio::test]
async fn ladder_falls_back_to_the_primary_artist() {
    let base_url = spawn_mock(ef_only_for_primary_artist).await;
    let client = client(&base_url, "primary");

    let candidates = client
        .search_cover_candidates(
            "ef - a tale of memories. ORIGINAL SOUNDTRACK",
            "TENMON & Eiichiro Yanagi",
        )
        .await;

    let best = candidates
        .first()
        .expect("the primary artist step must hit");
    assert_eq!(best.artist, "TENMON");
    assert!(best.match_score >= metadata::AUTO_ACCEPT_SCORE);
}

#[tokio::test]
async fn short_album_with_multi_artist_still_finds_the_cover() {
    let base_url = spawn_mock(ef_only_for_primary_artist).await;
    let client = client(&base_url, "short");

    let best = client
        .find_best_cover("ef", "TENMON & Eiichiro Yanagi", None, None)
        .await
        .expect("typing only `ef` must find the soundtrack");
    assert!(best.title.starts_with("ef - a tale of memories"));
}

#[tokio::test]
async fn picker_lists_a_wrong_result_but_auto_pick_rejects_it() {
    let base_url = spawn_mock(unrelated_album_for_everything).await;
    let client = client(&base_url, "wrong");

    let listed = client
        .search_cover_candidates("Kein Blick zurueck", "In Extremo")
        .await;
    assert_eq!(listed.len(), 1);
    assert!(listed[0].match_score < metadata::AUTO_ACCEPT_SCORE);

    let picked = client
        .find_best_cover("Kein Blick zurueck", "In Extremo", None, None)
        .await;
    assert!(
        picked.is_none(),
        "a mismatched cover must never be auto-picked"
    );
}
