use audio_engine::AudioEngine;
use desktop_integration::{MprisController, MprisTrackInfo};
use domain::PlaybackState;
use std::sync::Arc;
use std::time::Duration;

#[tokio::test]
async fn test_mpris_controller_lifecycle_and_dbus_updates() {
    let engine = Arc::new(AudioEngine::new().expect("Failed to initialize AudioEngine"));

    // Próba uruchomienia kontrolera MPRIS na sesyjnej magistrali D-Bus
    match MprisController::start(engine.clone()).await {
        Ok(mpris) => {
            // 1. Aktualizacja metadanych utworu
            mpris
                .update_track(MprisTrackInfo {
                    title: "Test Track MPRIS".into(),
                    artist: "Auralune Kitsune".into(),
                    album: "Cyber-Audio Vol. 1".into(),
                    duration_ms: 180000,
                    art_url: Some("file:///tmp/cover.jpg".into()),
                })
                .await;

            // 2. Aktualizacja statusu odtwarzania
            mpris.update_playback_status(PlaybackState::Playing).await;
            mpris.emit_seeked(45000).await;
            mpris.update_volume(0.85).await;
            mpris.update_playback_status(PlaybackState::Paused).await;

            // Krótkie opóźnienie na rozesłanie sygnałów D-Bus
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
        Err(e) => {
            eprintln!(
                "Brak sesyjnej magistrali D-Bus w środowisku testowym: {}",
                e
            );
        }
    }
}
