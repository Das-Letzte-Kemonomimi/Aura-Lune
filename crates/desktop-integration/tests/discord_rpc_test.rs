use desktop_integration::{DiscordRpcController, DiscordTrackInfo, DEFAULT_DISCORD_CLIENT_ID};
use domain::PlaybackState;
use std::time::Duration;

#[tokio::test]
async fn test_discord_rpc_controller_lifecycle() {
    let controller = DiscordRpcController::start(None, true, None);

    // 1. Sprawdzenie stanu początkowego
    let initial_status = controller.get_status();
    assert!(initial_status.enabled);
    assert_eq!(initial_status.client_id, DEFAULT_DISCORD_CLIENT_ID);

    // 2. Wysłanie informacji o utworze
    controller.update_track(DiscordTrackInfo {
        title: "Kitsune Starlight".into(),
        artist: "Auralune Sound".into(),
        album: "Cyber Resonance".into(),
        duration_ms: 240000,
        art_url: Some("https://coverartarchive.org/release/123/front.jpg".into()),
    });

    // 3. Wysłanie stanu odtwarzania
    controller.update_playback_status(PlaybackState::Playing, 30000, 240000);
    controller.update_position(45000);

    // 4. Zmiana parametrów w locie
    controller.set_client_id("987654321098765432".into());
    controller.update_playback_status(PlaybackState::Paused, 45000, 240000);
    controller.clear_activity();

    // 5. Wyłączenie
    controller.set_enabled(false);
    tokio::time::sleep(Duration::from_millis(50)).await;

    let final_status = controller.get_status();
    assert!(!final_status.enabled);
    assert_eq!(final_status.client_id, "987654321098765432");
}
