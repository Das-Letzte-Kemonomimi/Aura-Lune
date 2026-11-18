mod common;

use common::{make_dummy_track, setup_test_db};

#[tokio::test]
async fn test_stem_tracks_storage() {
    let db = setup_test_db().await;
    let track = make_dummy_track("/music/stem_track.flac", "Stem Track", "Artist");
    let track_id = db.upsert_track(&track).await.unwrap();

    let stem_data = domain::analysis::StemSeparationData {
        track_id,
        file_hash: "hash123".to_string(),
        model_name: "htdemucs_v4".to_string(),
        stems_dir: "/tmp/stems".to_string(),
        vocals_path: "/tmp/stems/vocals.flac".to_string(),
        drums_path: "/tmp/stems/drums.flac".to_string(),
        bass_path: "/tmp/stems/bass.flac".to_string(),
        other_path: "/tmp/stems/other.flac".to_string(),
        piano_path: None,
        guitar_path: None,
    };
    db.save_stem_tracks(&stem_data).await.unwrap();
    let fetched_stems = db.get_stem_tracks(track_id).await.unwrap();
    assert!(fetched_stems.is_some());
    let stems = fetched_stems.unwrap();
    assert_eq!(stems.vocals_path, "/tmp/stems/vocals.flac");
    assert_eq!(stems.drums_path, "/tmp/stems/drums.flac");

    db.delete_stem_tracks(track_id).await.unwrap();
    assert!(db.get_stem_tracks(track_id).await.unwrap().is_none());
}

#[tokio::test]
async fn test_stem_project_creation_and_channels() {
    let db = setup_test_db().await;
    let track = make_dummy_track("/music/project_track.flac", "Project Track", "Artist");
    let track_id = db.upsert_track(&track).await.unwrap();

    let sample_project = domain::StemProject {
        id: 0,
        track_id,
        track_hash: "hash123".to_string(),
        title: "Sparkle (Multitrack Project)".to_string(),
        artist: "RADWIMPS".to_string(),
        album: "Your Name.".to_string(),
        cover_uri: None,
        status: domain::StemProjectStatus::Ready,
        progress: 1.0,
        model_name: "htdemucs_6s".to_string(),
        disk_size_bytes: 120_000_000,
        channels: vec![
            domain::StemChannel {
                id: "lead_vocal".to_string(),
                name: "Lead Vocal".to_string(),
                parent_stem: Some("vocals".to_string()),
                file_path: "/tmp/stems/lead_vocal.flac".to_string(),
                color_hex: "#f43f5e".to_string(),
                quality_tier: domain::StemQualityTier::HighQuality,
                volume: 0.75,
                pan: 0.0,
                mute: false,
                solo: false,
            },
            domain::StemChannel {
                id: "kick".to_string(),
                name: "Kick Drum".to_string(),
                parent_stem: Some("drums".to_string()),
                file_path: "/tmp/stems/kick.flac".to_string(),
                color_hex: "#ea580c".to_string(),
                quality_tier: domain::StemQualityTier::HighQuality,
                volume: 0.75,
                pan: 0.0,
                mute: false,
                solo: false,
            },
        ],
        active_mix_name: Some("Default".to_string()),
        created_at: "2026-11-14T19:00:00Z".to_string(),
        updated_at: "2026-11-14T19:00:00Z".to_string(),
    };

    let proj_id = db.create_stem_project(&sample_project).await.unwrap();
    assert!(proj_id > 0);

    let fetched_proj = db.get_stem_project(proj_id).await.unwrap().unwrap();
    assert_eq!(fetched_proj.title, "Sparkle (Multitrack Project)");
    assert_eq!(fetched_proj.channels.len(), 2);
    assert_eq!(fetched_proj.channels[0].id, "lead_vocal");
    assert_eq!(fetched_proj.channels[0].volume, 0.75);

    let all_projects = db.list_stem_projects().await.unwrap();
    assert_eq!(all_projects.len(), 1);

    db.rename_stem_project(proj_id, "Sparkle (Acoustic Mix)")
        .await
        .unwrap();
    let renamed = db.get_stem_project(proj_id).await.unwrap().unwrap();
    assert_eq!(renamed.title, "Sparkle (Acoustic Mix)");
}

#[tokio::test]
async fn test_stem_project_mixes_and_active_mix() {
    let db = setup_test_db().await;
    let track = make_dummy_track("/music/mix_track.flac", "Mix Track", "Artist");
    let track_id = db.upsert_track(&track).await.unwrap();

    let sample_project = domain::StemProject {
        id: 0,
        track_id,
        track_hash: "hash123".to_string(),
        title: "Project".to_string(),
        artist: "Artist".to_string(),
        album: "Album".to_string(),
        cover_uri: None,
        status: domain::StemProjectStatus::Ready,
        progress: 1.0,
        model_name: "htdemucs".to_string(),
        disk_size_bytes: 10_000_000,
        channels: vec![],
        active_mix_name: None,
        created_at: "2026-11-14T19:00:00Z".to_string(),
        updated_at: "2026-11-14T19:00:00Z".to_string(),
    };
    let proj_id = db.create_stem_project(&sample_project).await.unwrap();

    let mut mix_settings = std::collections::HashMap::new();
    mix_settings.insert(
        "lead_vocal".to_string(),
        domain::ChannelMixSetting {
            volume: 0.85,
            pan: 0.0,
            mute: false,
            solo: false,
        },
    );
    let sample_mix = domain::StemProjectMix {
        id: None,
        project_id: proj_id,
        name: "Acapella Boost".to_string(),
        is_default: false,
        channels: mix_settings,
        master_volume: 1.0,
        updated_at: "2026-11-14T19:30:00Z".to_string(),
    };
    let mix_id = db.save_stem_project_mix(&sample_mix).await.unwrap();
    assert!(mix_id > 0);

    let mixes = db.get_stem_project_mixes(proj_id).await.unwrap();
    assert_eq!(mixes.len(), 1);
    assert_eq!(mixes[0].name, "Acapella Boost");
    assert_eq!(mixes[0].channels.get("lead_vocal").unwrap().volume, 0.85);

    db.set_active_stem_project_mix(proj_id, "Acapella Boost")
        .await
        .unwrap();
    let proj = db.get_stem_project(proj_id).await.unwrap().unwrap();
    assert_eq!(proj.active_mix_name, Some("Acapella Boost".to_string()));

    db.delete_stem_project_mix(mix_id).await.unwrap();
    assert!(db.get_stem_project_mixes(proj_id).await.unwrap().is_empty());

    db.delete_stem_project(proj_id).await.unwrap();
    assert!(db.get_stem_project(proj_id).await.unwrap().is_none());
}
