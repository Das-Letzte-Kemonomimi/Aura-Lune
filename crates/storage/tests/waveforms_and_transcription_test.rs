mod common;

use common::{make_dummy_track, setup_test_db};

#[tokio::test]
async fn test_track_waveform_storage() {
    let db = setup_test_db().await;
    let track = make_dummy_track("/music/test_wave.flac", "Waveform Track", "Artist");
    let track_id = db.upsert_track(&track).await.unwrap();

    // 1. Initial check - should be None
    assert!(db.get_track_waveform(track_id).await.unwrap().is_none());

    // 2. Save waveform peaks
    let sample_peaks = vec![0.15f32, 0.45, 0.88, 0.95, 0.62, 0.33];
    let peaks_json = serde_json::to_string(&sample_peaks).unwrap();
    db.save_track_waveform(track_id, sample_peaks.len() as i64, &peaks_json)
        .await
        .unwrap();

    // 3. Retrieve and verify
    let fetched_json = db.get_track_waveform(track_id).await.unwrap().unwrap();
    let fetched_peaks: Vec<f32> = serde_json::from_str(&fetched_json).unwrap();
    assert_eq!(fetched_peaks.len(), 6);
    assert!((fetched_peaks[2] - 0.88).abs() < 1e-4);

    // 4. Overwrite (upsert)
    let updated_peaks = vec![0.5f32, 0.9f32];
    let updated_json = serde_json::to_string(&updated_peaks).unwrap();
    db.save_track_waveform(track_id, updated_peaks.len() as i64, &updated_json)
        .await
        .unwrap();

    let updated_fetched = db.get_track_waveform(track_id).await.unwrap().unwrap();
    let updated_result: Vec<f32> = serde_json::from_str(&updated_fetched).unwrap();
    assert_eq!(updated_result.len(), 2);
    assert_eq!(updated_result[0], 0.5);

    // 5. Versioned spectral waveform profile with bands and file mtime invalidation
    let bands_json = "[[0.8,0.4,0.1],[0.2,0.7,0.9]]";
    db.save_track_waveform_profile(
        track_id,
        2,
        "[0.4,0.95]",
        bands_json,
        "fft-v1",
        1_700_000_123,
    )
    .await
    .unwrap();

    let hit = db
        .get_track_waveform_profile(track_id, 2, "fft-v1", 1_700_000_123)
        .await
        .unwrap()
        .expect("matching version, count and mtime should hit");
    assert_eq!(hit.bands_json, bands_json);
    assert_eq!(hit.analyzer_version, "fft-v1");

    // Stale analyzer version, different sample count, or changed mtime must miss
    assert!(db
        .get_track_waveform_profile(track_id, 2, "fft-v2", 1_700_000_123)
        .await
        .unwrap()
        .is_none());
    assert!(db
        .get_track_waveform_profile(track_id, 160, "fft-v1", 1_700_000_123)
        .await
        .unwrap()
        .is_none());
    assert!(db
        .get_track_waveform_profile(track_id, 2, "fft-v1", 1_700_000_999)
        .await
        .unwrap()
        .is_none());
}

#[tokio::test]
async fn test_track_chords_and_overrides() {
    let db = setup_test_db().await;
    let track = make_dummy_track("/music/chords_track.flac", "Chords Track", "Artist");
    let track_id = db.upsert_track(&track).await.unwrap();

    db.save_track_chords(&storage::NewTrackChords {
        track_id,
        file_hash: "hash123",
        analyzer_version: "1.0.0",
        beat_grid_json: r#"[{"time_ms":0,"beat_number":1,"is_downbeat":true}]"#,
        chords_json: r#"[{"start_ms":0,"end_ms":2000,"chord":"C","confidence":0.95}]"#,
        bpm: Some(128.5),
        musical_key: Some("A min"),
        camelot: Some("8A"),
    })
    .await
    .unwrap();

    let cached = db
        .get_track_chords(track_id, "1.0.0")
        .await
        .unwrap()
        .unwrap();
    assert!(cached.beat_grid_json.contains("beat_number"));
    assert!(cached.chords_json.contains("\"chord\":\"C\""));
    assert!(cached.user_overrides_json.is_none());
    assert_eq!(cached.file_hash, "hash123");
    assert_eq!(cached.analyzer_version, "1.0.0");
    assert_eq!(cached.bpm, Some(128.5));
    assert_eq!(cached.musical_key.as_deref(), Some("A min"));
    assert_eq!(cached.camelot.as_deref(), Some("8A"));

    db.save_chord_overrides(
        track_id,
        r#"[{"start_ms":0,"end_ms":2000,"chord":"Cmaj7"}]"#,
    )
    .await
    .unwrap();
    let chords2 = db
        .get_track_chords(track_id, "1.0.0")
        .await
        .unwrap()
        .unwrap();
    assert_eq!(
        chords2.user_overrides_json,
        Some(r#"[{"start_ms":0,"end_ms":2000,"chord":"Cmaj7"}]"#.to_string())
    );
}

#[tokio::test]
async fn test_track_chords_ignore_stale_version_and_keep_one_row() {
    let db = setup_test_db().await;
    let track = make_dummy_track("/music/stale_chords.flac", "Stale", "Artist");
    let track_id = db.upsert_track(&track).await.unwrap();
    let save = |version: &str, chords: &str| {
        let db = db.clone();
        let version = version.to_string();
        let chords = chords.to_string();
        async move {
            db.save_track_chords(&storage::NewTrackChords {
                track_id,
                file_hash: "h",
                analyzer_version: &version,
                beat_grid_json: "[]",
                chords_json: &chords,
                bpm: None,
                musical_key: None,
                camelot: None,
            })
            .await
            .unwrap();
        }
    };

    save("1.0.0", r#"[{"chord":"old"}]"#).await;
    assert!(db
        .get_track_chords(track_id, "2.0.0")
        .await
        .unwrap()
        .is_none());

    save("2.0.0", r#"[{"chord":"new"}]"#).await;
    assert!(db
        .get_track_chords(track_id, "1.0.0")
        .await
        .unwrap()
        .is_none());
    let current = db
        .get_track_chords(track_id, "2.0.0")
        .await
        .unwrap()
        .unwrap();
    assert!(current.chords_json.contains("new"));

    db.save_chord_overrides(track_id, "[]").await.unwrap();
    let again = db
        .get_track_chords(track_id, "2.0.0")
        .await
        .unwrap()
        .unwrap();
    assert_eq!(again.user_overrides_json.as_deref(), Some("[]"));
}

#[tokio::test]
async fn test_track_transcription() {
    let db = setup_test_db().await;
    let track = make_dummy_track("/music/trans_track.flac", "Trans Track", "Artist");
    let track_id = db.upsert_track(&track).await.unwrap();

    db.save_track_transcription(
        track_id,
        "hash123",
        "1.0.0",
        r#"[{"onset_ms":100,"duration_ms":500,"midi_pitch":60,"velocity":80}]"#,
        Some(96.0),
    )
    .await
    .unwrap();
    let trans = db
        .get_track_transcription(track_id, "1.0.0")
        .await
        .unwrap()
        .unwrap();
    assert!(trans.notes_json.contains("\"midi_pitch\":60"));
    assert_eq!(trans.bpm, Some(96.0));
    assert_eq!(trans.file_hash, "hash123");
}

#[tokio::test]
async fn test_transcription_cache_ignores_other_versions_and_keeps_one_row() {
    let db = setup_test_db().await;
    let track = make_dummy_track("/music/trans_ver.flac", "Trans Ver", "Artist");
    let track_id = db.upsert_track(&track).await.unwrap();

    db.save_track_transcription(track_id, "h1", "1.0.0", "[]", Some(100.0))
        .await
        .unwrap();
    assert!(db
        .get_track_transcription(track_id, "2.0.0")
        .await
        .unwrap()
        .is_none());

    db.save_track_transcription(track_id, "h2", "2.0.0", "[]", Some(110.0))
        .await
        .unwrap();
    assert!(
        db.get_track_transcription(track_id, "1.0.0")
            .await
            .unwrap()
            .is_none(),
        "the old entry should be removed when the new version is stored"
    );
    let current = db
        .get_track_transcription(track_id, "2.0.0")
        .await
        .unwrap()
        .unwrap();
    assert_eq!(current.file_hash, "h2");
}

#[tokio::test]
async fn test_ai_models_registry() {
    let db = setup_test_db().await;

    let model_info = domain::analysis::AiModelInfo {
        id: "htdemucs_v4".to_string(),
        name: "HTDemucs v4".to_string(),
        task_type: domain::analysis::AiTaskType::StemSeparation,
        file_path: "/models/htdemucs.onnx".to_string(),
        file_size: 80_000_000,
        sha256: "abc123sha256".to_string(),
        license: "MIT".to_string(),
        download_url: Some("https://example.com/htdemucs.onnx".to_string()),
        description: "4-Stem separation model".to_string(),
        is_installed: true,
    };
    db.register_ai_model(&model_info).await.unwrap();
    let models = db.list_ai_models().await.unwrap();
    assert_eq!(models.len(), 1);
    assert_eq!(models[0].name, "HTDemucs v4");

    let fetched_model = db.get_ai_model("htdemucs_v4").await.unwrap();
    assert!(fetched_model.is_some());
    assert_eq!(fetched_model.unwrap().sha256, "abc123sha256");

    db.delete_ai_model("htdemucs_v4").await.unwrap();
    assert!(db.get_ai_model("htdemucs_v4").await.unwrap().is_none());
}
