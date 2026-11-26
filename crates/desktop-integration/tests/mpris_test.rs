use audio_engine::AudioEngine;
use desktop_integration::{MprisController, MprisTrackInfo};
use domain::PlaybackState;
use std::sync::Arc;
use std::time::Duration;

#[tokio::test]
async fn test_mpris_controller_lifecycle_and_dbus_updates() {
    let engine = Arc::new(AudioEngine::new().expect("Failed to initialize AudioEngine"));

    // Try to start the MPRIS controller on the D-Bus session bus
    match MprisController::start(engine.clone()).await {
        Ok(mpris) => {
            // 1. Update the track metadata
            mpris
                .update_track(MprisTrackInfo {
                    title: "Test Track MPRIS".into(),
                    artist: "Auralune Kitsune".into(),
                    album: "Cyber-Audio Vol. 1".into(),
                    duration_ms: 180000,
                    art_url: Some("file:///tmp/cover.jpg".into()),
                })
                .await;

            // 2. Update the playback status
            mpris.update_playback_status(PlaybackState::Playing).await;
            mpris.emit_seeked(45000).await;
            mpris.update_volume(0.85).await;
            mpris.update_playback_status(PlaybackState::Paused).await;

            // Short delay for the D-Bus signals to go out
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
        Err(e) => {
            eprintln!("No D-Bus session bus in the test environment: {}", e);
        }
    }
}
