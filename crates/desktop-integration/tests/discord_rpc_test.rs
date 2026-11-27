use desktop_integration::{
    next_reconnect_backoff, DiscordRpcController, DiscordTrackInfo, DEFAULT_DISCORD_CLIENT_ID,
};
use domain::PlaybackState;
use std::time::Duration;

#[test]
fn test_discord_reconnect_backoff_schedule() {
    let expected_ms = [1500, 3000, 6000, 12000, 24000, 48000, 60000, 60000, 60000];
    for (attempt, &ms) in expected_ms.iter().enumerate() {
        assert_eq!(
            next_reconnect_backoff(attempt as u32),
            Duration::from_millis(ms),
            "attempt {attempt}"
        );
    }
}

#[tokio::test]
async fn test_discord_rpc_controller_lifecycle() {
    let controller = DiscordRpcController::start(None, true, None);

    // 1. Check the initial state
    let initial_status = controller.get_status();
    assert!(initial_status.enabled);
    assert_eq!(initial_status.client_id, DEFAULT_DISCORD_CLIENT_ID);

    // 2. Send the track information
    controller.update_track(DiscordTrackInfo {
        title: "Kitsune Starlight".into(),
        artist: "Auralune Sound".into(),
        album: "Cyber Resonance".into(),
        duration_ms: 240000,
        art_url: Some("https://coverartarchive.org/release/123/front.jpg".into()),
    });

    // 3. Send the playback state
    controller.update_playback_status(PlaybackState::Playing, 30000, 240000);
    controller.update_position(45000);

    // 4. Change the parameters on the fly
    controller.set_client_id("987654321098765432".into());
    controller.update_playback_status(PlaybackState::Paused, 45000, 240000);
    controller.clear_activity();

    // 5. Turn it off
    controller.set_enabled(false);
    tokio::time::sleep(Duration::from_millis(50)).await;

    let final_status = controller.get_status();
    assert!(!final_status.enabled);
    assert_eq!(final_status.client_id, "987654321098765432");
}

#[test]
fn test_discord_rpc_build_activity_payload_structure_and_timestamps() {
    let track = DiscordTrackInfo {
        title: "Ich Kenne Alles".into(),
        artist: "In Extremo".into(),
        album: "Verehrt Und Angespien".into(),
        duration_ms: 187000, // 3:07
        art_url: Some("https://example.com/cover.jpg".into()),
    };

    let now_unix = 1700000000u64;
    let pos_ms = 42000u64; // 0:42 elapsed
    let dur_ms = 187000u64; // 3:07 total duration

    // 1. Activity while playing (Playing)
    let act_playing = desktop_integration::build_activity_payload(
        &track,
        PlaybackState::Playing,
        pos_ms,
        dur_ms,
        now_unix,
    );

    // Line 1: title
    assert_eq!(act_playing["details"], "Ich Kenne Alles");
    // Line 2: artist (does NOT repeat the album!)
    assert_eq!(act_playing["state"], "In Extremo");
    // Line 3: album
    assert_eq!(act_playing["assets"]["large_text"], "Verehrt Und Angespien");
    assert_eq!(
        act_playing["assets"]["large_image"],
        "https://example.com/cover.jpg"
    );
    assert_eq!(act_playing["type"], 2);

    // Progress bar: both start and end in UNIX seconds
    let ts = &act_playing["timestamps"];
    let start = ts["start"].as_u64().expect("start timestamp must be u64");
    let end = ts["end"].as_u64().expect("end timestamp must be u64");

    // elapsed_secs = 42, start = now - 42 = 1700000000 - 42 = 1699999958
    assert_eq!(start, now_unix - 42);
    // duration_secs = 187, end = start + 187 = 1699999958 + 187 = 1700000145
    assert_eq!(end, start + 187);

    // 2. Activity while paused (Paused)
    let act_paused = desktop_integration::build_activity_payload(
        &track,
        PlaybackState::Paused,
        pos_ms,
        dur_ms,
        now_unix,
    );
    // While paused the progress bar should not count time on Discord
    assert!(act_paused.get("timestamps").is_none());
}
