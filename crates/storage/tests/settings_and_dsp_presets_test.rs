mod common;

use common::setup_test_db;

#[tokio::test]
async fn test_dsp_presets_crud() {
    let db = setup_test_db().await;

    let preset_id = db
        .save_dsp_preset("Nightcore", "SoundTouch", 3.0, 1.25, 1.0)
        .await
        .unwrap();
    assert!(preset_id > 0);

    let presets = db.list_dsp_presets().await.unwrap();
    assert_eq!(presets.len(), 1);
    assert_eq!(presets[0].name, "Nightcore");
    assert_eq!(presets[0].pitch_semitones, 3.0);
    assert_eq!(presets[0].tempo_ratio, 1.25);
    assert_eq!(presets[0].rate_ratio, 1.0);
}

#[tokio::test]
async fn test_custom_themes_and_app_settings() {
    let db = setup_test_db().await;

    // Default themes seeded by the migration
    let themes = db.list_themes().await.unwrap();
    assert_eq!(themes.len(), 7);
    let active = db.get_app_setting("active_theme_id").await.unwrap();
    assert_eq!(active, Some("cyber-kitsune".to_string()));

    let cyber = db.get_theme("cyber-kitsune").await.unwrap();
    assert!(cyber.is_some());
    let mut custom = cyber.unwrap();
    custom.id = "custom-synth".to_string();
    custom.name = "Custom Synth".to_string();
    custom.overlay_opacity = 0.65;
    custom.blur_radius = 16.0;
    db.save_theme(&custom).await.unwrap();

    let fetched_custom = db.get_theme("custom-synth").await.unwrap().unwrap();
    assert_eq!(fetched_custom.name, "Custom Synth");
    assert_eq!(fetched_custom.overlay_opacity, 0.65);
    assert_eq!(fetched_custom.blur_radius, 16.0);

    db.set_app_setting("active_theme_id", "custom-synth")
        .await
        .unwrap();
    assert_eq!(
        db.get_app_setting("active_theme_id").await.unwrap(),
        Some("custom-synth".to_string())
    );
}
