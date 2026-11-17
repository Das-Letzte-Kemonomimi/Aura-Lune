use super::*;
use domain::PlaybackState;
use std::fs;

#[test]
fn test_build_activity_payload_playing_with_timestamps() {
    let track = DiscordTrackInfo {
        title: "Kitsune Dream".to_string(),
        artist: "Auralune".to_string(),
        album: "Lofi Beats".to_string(),
        duration_ms: 180_000,
        art_url: Some("https://example.com/cover.jpg".to_string()),
    };

    let payload = build_activity_payload(&track, PlaybackState::Playing, 30_000, 180_000, 1_700_000_000);

    assert_eq!(payload["name"], "Auralune");
    assert_eq!(payload["type"], 2);
    assert_eq!(payload["details"], "Kitsune Dream");
    assert_eq!(payload["state"], "Auralune");
    assert_eq!(payload["assets"]["large_image"], "https://example.com/cover.jpg");
    assert_eq!(payload["assets"]["large_text"], "Lofi Beats");

    let ts = &payload["timestamps"];
    assert!(ts.is_object());
    assert_eq!(ts["start"], 1_700_000_000 - 30);
    assert_eq!(ts["end"], 1_700_000_000 - 30 + 180);
}

#[test]
fn test_build_activity_payload_paused_omits_timestamps() {
    let track = DiscordTrackInfo {
        title: "Paused Track".to_string(),
        artist: "".to_string(),
        album: "".to_string(),
        duration_ms: 200_000,
        art_url: None,
    };

    let payload = build_activity_payload(&track, PlaybackState::Paused, 10_000, 200_000, 1_700_000_000);

    assert_eq!(payload["details"], "Paused Track");
    assert_eq!(payload["state"], "Auralune"); // fallback
    assert_eq!(payload["assets"]["large_text"], "Auralune Player"); // fallback
    assert!(payload.get("timestamps").is_none());
}

#[test]
fn test_build_activity_payload_truncates_long_strings() {
    let long_title = "A".repeat(200);
    let track = DiscordTrackInfo {
        title: long_title,
        artist: "Artist".to_string(),
        album: "Album".to_string(),
        duration_ms: 100_000,
        art_url: None,
    };

    let payload = build_activity_payload(&track, PlaybackState::Playing, 0, 100_000, 1_700_000_000);
    let details = payload["details"].as_str().unwrap();
    assert!(details.len() <= 135);
    assert!(details.ends_with('…'));
}

#[test]
fn test_waybar_status_atomic_write_and_cleanup() {
    let temp_dir = std::env::temp_dir();
    let test_path = temp_dir.join(format!("auralune_waybar_test_{}.json", std::process::id()));
    let test_path_str = test_path.to_str().unwrap();

    let status = WaybarStatus {
        text: "Test Artist - Test Song".to_string(),
        alt: "playing".to_string(),
        tooltip: "Tooltip details".to_string(),
        class: "playing".to_string(),
        percentage: 45,
        volume: 85,
        art_url: None,
        title: "Test Song".to_string(),
        artist: "Test Artist".to_string(),
        album: "Test Album".to_string(),
        state: "Playing".to_string(),
        position_ms: 45_000,
        duration_ms: 100_000,
    };

    // Write status
    let res = write_waybar_status_to_path(&status, test_path_str);
    assert!(res.is_ok());
    assert!(test_path.exists());

    // Read and verify deserialization
    let content = fs::read_to_string(&test_path).expect("Failed to read test file");
    let deserialized: WaybarStatus = serde_json::from_str(&content).expect("Failed to deserialize");
    assert_eq!(deserialized.title, "Test Song");
    assert_eq!(deserialized.percentage, 45);
    assert_eq!(deserialized.volume, 85);

    // Clean up
    let _ = fs::remove_file(&test_path);
}
