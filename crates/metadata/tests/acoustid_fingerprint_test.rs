use metadata::AcoustidClient;
use std::path::Path;

#[test]
fn test_parse_acoustid_response() {
    let sample_json = serde_json::json!({
        "status": "ok",
        "results": [
            {
                "id": "8d2a117d-37a1-4b84-9840-94fe4050c923",
                "score": 0.969,
                "recordings": [
                    {
                        "id": "7152b32c-28a6-49f9-9c8c-137fbeedd02e",
                        "title": "Omnia Sol Temperat",
                        "artists": [{ "id": "1", "name": "In Extremo" }],
                        "releases": [
                            {
                                "id": "eb49df1b-b398-49b6-b1e6-cd55caf1d401",
                                "title": "Raue Spree 2005",
                                "date": { "year": 2006, "month": 2, "day": 10 },
                                "track_count": 24,
                                "mediums": [
                                    {
                                        "position": 1,
                                        "tracks": [{ "position": 8, "title": "Omnia Sol Temperat" }]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
    });

    let matches = AcoustidClient::parse_acoustid_response(&sample_json);
    assert_eq!(matches.len(), 1);
    let m = &matches[0];
    assert_eq!(m.title, "Omnia Sol Temperat");
    assert_eq!(m.artist, "In Extremo");
    assert_eq!(m.album.as_deref(), Some("Raue Spree 2005"));
    assert_eq!(m.year, Some(2006));
    assert_eq!(m.track_no, Some(8));
    assert_eq!(m.track_total, Some(24));
    assert_eq!(m.disc_no, Some(1));
    assert_eq!(m.score, 96);
}

#[tokio::test]
async fn test_generate_fingerprint_fixture() {
    if !AcoustidClient::is_fpcalc_available().await {
        eprintln!("fpcalc not installed, skipping test");
        return;
    }

    let fixture_path = Path::new("../../tests/fixtures/08. Omnia Sol Temperat.flac");
    if !fixture_path.exists() {
        eprintln!("Fixture not found at {:?}, skipping", fixture_path);
        return;
    }

    let res = AcoustidClient::generate_fingerprint(fixture_path).await;
    assert!(
        res.is_ok(),
        "generate_fingerprint should succeed on sample FLAC"
    );
    let (duration, fingerprint) = res.unwrap();
    assert!(duration > 200.0);
    assert!(!fingerprint.is_empty());
}
