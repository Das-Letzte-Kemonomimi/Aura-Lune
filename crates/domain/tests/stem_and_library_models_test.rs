use domain::device::BluetoothCodec;
use domain::queue::{LoopMode, PlaybackQueue, QueueItem};
use domain::renamer::{format_pattern_for_track, sanitize_filename_part, RenamerTrackInfo};
use domain::stem_project::{
    default_stem_color, default_stem_label, linear_gain_to_slider, slider_to_db,
    slider_to_linear_gain,
};
use domain::theme::default_themes;
use domain::transcode::{ExportFormat, TimeRange};

fn sample_item(id: &str, title: &str) -> QueueItem {
    QueueItem {
        id: id.to_string(),
        track_id: None,
        uri: format!("file:///{}.flac", id),
        title: title.to_string(),
        artist: "Artist".to_string(),
        album: Some("Album".to_string()),
        duration_ms: 180000,
    }
}

#[test]
fn test_volume_mapping_keypoints() {
    assert_eq!(slider_to_linear_gain(0.0), 0.0);
    assert!(slider_to_db(0.0) <= -90.0);

    let gain_75 = slider_to_linear_gain(0.75);
    assert!((gain_75 - 1.0).abs() < 1e-5);
    assert!(slider_to_db(0.75).abs() < 1e-4);

    let gain_100 = slider_to_linear_gain(1.0);
    assert!((gain_100 - 2.0).abs() < 1e-5);
    assert!((slider_to_db(1.0) - 6.0206).abs() < 0.01);
}

#[test]
fn test_volume_mapping_monotonicity_and_roundtrip() {
    let mut prev_gain = -1.0;
    for i in 0..=100 {
        let slider = i as f32 / 100.0;
        let gain = slider_to_linear_gain(slider);
        assert!(
            gain >= prev_gain,
            "Monotonicity violated at slider {}",
            slider
        );
        prev_gain = gain;

        let recovered_slider = linear_gain_to_slider(gain);
        assert!(
            (recovered_slider - slider).abs() < 1e-4,
            "Roundtrip failed for slider {}: got {}",
            slider,
            recovered_slider
        );
    }
}

#[test]
fn test_default_stem_colors_and_labels() {
    assert_eq!(default_stem_color("lead_vocal"), "#f43f5e");
    assert_eq!(default_stem_color("kick"), "#ea580c");
    assert_eq!(default_stem_color("bass"), "#0ea5e9");
    assert_eq!(default_stem_color("piano"), "#8b5cf6");

    assert_eq!(default_stem_label("lead_vocal", true), "Wokal prowadzący");
    assert_eq!(default_stem_label("lead_vocal", false), "Lead Vocal");
    assert_eq!(default_stem_label("kick", true), "Stopa (Kick)");
    assert_eq!(default_stem_label("kick", false), "Kick Drum");
}

#[test]
fn test_queue_navigation_sequential_and_loop() {
    let mut queue = PlaybackQueue::new();
    queue.set_items(
        vec![
            sample_item("1", "Song A"),
            sample_item("2", "Song B"),
            sample_item("3", "Song C"),
        ],
        Some(0),
    );

    assert_eq!(queue.current_item().unwrap().title, "Song A");
    assert_eq!(queue.next().unwrap().title, "Song B");
    assert_eq!(queue.next().unwrap().title, "Song C");
    assert!(queue.next().is_none());

    queue.set_loop_mode(LoopMode::Queue);
    assert_eq!(queue.next().unwrap().title, "Song A");

    assert_eq!(queue.previous().unwrap().title, "Song C");
    assert_eq!(queue.previous().unwrap().title, "Song B");

    queue.set_loop_mode(LoopMode::Track);
    assert_eq!(queue.next().unwrap().title, "Song B");
    assert_eq!(queue.next().unwrap().title, "Song B");
}

#[test]
fn test_queue_add_next_and_remove() {
    let mut queue = PlaybackQueue::new();
    queue.set_items(
        vec![sample_item("1", "Song 1"), sample_item("2", "Song 2")],
        Some(0),
    );

    queue.add_next(sample_item("1.5", "Song Interlude"));
    assert_eq!(queue.items.len(), 3);
    assert_eq!(queue.items[1].title, "Song Interlude");

    let removed = queue.remove_item("1.5");
    assert_eq!(removed.unwrap().title, "Song Interlude");
    assert_eq!(queue.items.len(), 2);
}

#[test]
fn test_set_active_item_does_not_auto_add_unqueued_track() {
    let mut queue = PlaybackQueue::new();
    queue.set_items(
        vec![sample_item("1", "Song 1"), sample_item("2", "Song 2")],
        Some(0),
    );

    let unqueued = sample_item("99", "Unqueued Song");
    queue.set_active_item(unqueued);

    assert_eq!(queue.items.len(), 2);
    assert_eq!(queue.current_index, None);

    let existing = sample_item("2", "Song 2");
    queue.set_active_item(existing);

    assert_eq!(queue.items.len(), 2);
    assert_eq!(queue.current_index, Some(1));
    assert_eq!(queue.current_item().unwrap().title, "Song 2");
}

#[test]
fn test_sanitize_filename() {
    assert_eq!(sanitize_filename_part("AC/DC: Live?"), "AC_DC_ Live_");
    assert_eq!(sanitize_filename_part("   "), "Unknown");
    assert_eq!(sanitize_filename_part("YOASOBI"), "YOASOBI");
}

#[test]
fn test_format_pattern_for_track() {
    let pattern = "%track% - %artist% - %title%";
    let info = RenamerTrackInfo {
        title: "Sparkle",
        artist: "RADWIMPS",
        album_artist: Some("RADWIMPS"),
        album: Some("Your Name."),
        track_no: Some(8),
        disc_no: Some(1),
        ext: "flac",
    };
    let res = format_pattern_for_track(pattern, &info);
    assert_eq!(res, "08 - RADWIMPS - Sparkle.flac");
}

#[test]
fn test_format_pattern_with_extension_already() {
    let pattern = "%artist% - %title%.%ext%";
    let info = RenamerTrackInfo {
        title: "Idol",
        artist: "YOASOBI",
        album_artist: None,
        album: None,
        track_no: Some(1),
        disc_no: None,
        ext: "mp3",
    };
    let res = format_pattern_for_track(pattern, &info);
    assert_eq!(res, "YOASOBI - Idol.mp3");
}

#[test]
fn test_theme_validation() {
    let themes = default_themes();
    assert_eq!(themes.len(), 7);
    for t in themes {
        assert!(t.validate().is_ok());
    }

    let mut invalid_theme = default_themes()[0].clone();
    invalid_theme.overlay_opacity = 1.5;
    assert!(invalid_theme.validate().is_err());

    invalid_theme.overlay_opacity = 0.5;
    invalid_theme.blur_radius = 50.0;
    assert!(invalid_theme.validate().is_err());
}

#[test]
fn test_codec_parsing() {
    assert_eq!(
        BluetoothCodec::from_profile_name("a2dp-sink-ldac"),
        Some(BluetoothCodec::Ldac)
    );
    assert_eq!(
        BluetoothCodec::from_profile_name("a2dp-sink-aptx_hd"),
        Some(BluetoothCodec::AptxHd)
    );
    assert_eq!(
        BluetoothCodec::from_profile_name("a2dp-sink-aac"),
        Some(BluetoothCodec::Aac)
    );
    assert_eq!(
        BluetoothCodec::from_profile_name("a2dp-sink-sbc_xq"),
        Some(BluetoothCodec::SbcXq)
    );
    assert_eq!(
        BluetoothCodec::from_profile_name("a2dp-sink"),
        Some(BluetoothCodec::Sbc)
    );
    assert_eq!(BluetoothCodec::from_profile_name("headset-head-unit"), None);
}

#[test]
fn test_export_format_extension() {
    assert_eq!(ExportFormat::Opus { bitrate_kbps: 160 }.extension(), "opus");
    assert_eq!(
        ExportFormat::Flac {
            compression_level: 5
        }
        .extension(),
        "flac"
    );
    assert_eq!(ExportFormat::Wav.extension(), "wav");
}

#[test]
fn test_time_range_validation() {
    let valid = TimeRange::new(500, Some(1500));
    assert!(valid.is_ok());
    let range = valid.unwrap();
    assert!(range.is_active());
    assert_eq!(range.duration_ms(), Some(1000));

    let invalid = TimeRange::new(1500, Some(500));
    assert!(invalid.is_err());

    let equal = TimeRange::new(1000, Some(1000));
    assert!(equal.is_err());

    let start_only = TimeRange::new(1000, None);
    assert!(start_only.is_ok());
    let range_start = start_only.unwrap();
    assert!(range_start.is_active());
    assert_eq!(range_start.duration_ms(), None);

    let zero_unbounded = TimeRange::new(0, None);
    assert!(zero_unbounded.is_ok());
    assert!(!zero_unbounded.unwrap().is_active());
}

#[test]
fn test_sanitize_filename_rejects_dot_navigation_and_caps_length() {
    assert_eq!(sanitize_filename_part(".."), "__");
    assert_eq!(sanitize_filename_part("."), "_");
    assert_eq!(sanitize_filename_part("..."), "___");
    assert_eq!(sanitize_filename_part("Mr. Children"), "Mr. Children");

    let long = "あ".repeat(200); // 600 bytes of UTF-8
    let out = sanitize_filename_part(&long);
    assert!(out.len() <= 200);
    assert!(
        out.chars().all(|c| c == 'あ'),
        "Truncation on a character boundary"
    );
}

#[test]
fn test_resolve_renamed_path_stays_inside_source_directory() {
    use domain::renamer::resolve_renamed_path;
    use std::path::PathBuf;

    let old = "/music/lib/song.flac";
    assert_eq!(
        resolve_renamed_path(old, "Artist/Album/01 - Title.flac").unwrap(),
        PathBuf::from("/music/lib/Artist/Album/01 - Title.flac")
    );
    assert!(
        resolve_renamed_path(old, "/etc/passwd").is_err(),
        "Absolute path"
    );
    assert!(
        resolve_renamed_path(old, "../escape.flac").is_err(),
        "A .. component"
    );
    assert!(resolve_renamed_path(old, "a/../../escape.flac").is_err());
    assert!(resolve_renamed_path(old, "").is_err());
    assert!(
        resolve_renamed_path(old, &format!("{}.flac", "x".repeat(300))).is_err(),
        "A component longer than 255 bytes"
    );
}

#[test]
fn test_tag_values_cannot_escape_via_pattern() {
    use domain::renamer::resolve_renamed_path;

    let info = RenamerTrackInfo {
        title: "..",
        artist: "../../etc",
        album_artist: None,
        album: Some(".."),
        track_no: Some(1),
        disc_no: None,
        ext: "flac",
    };
    let formatted = format_pattern_for_track("%artist%/%album%/%title%", &info);
    let resolved = resolve_renamed_path("/music/lib/song.flac", &formatted).unwrap();
    assert!(resolved.starts_with("/music/lib/"));
    assert!(!resolved.to_string_lossy().contains("/../"));
}

#[test]
fn test_validate_rename_target() {
    use domain::renamer::validate_rename_target;

    let old = "/music/lib/song.flac";
    assert!(validate_rename_target(old, "/music/lib/Artist/new.flac").is_ok());
    assert!(validate_rename_target(old, "/music/other/new.flac").is_err());
    assert!(validate_rename_target(old, "/music/lib/../other/new.flac").is_err());
    assert!(validate_rename_target(old, "/home/user/.bashrc").is_err());
}

#[test]
fn test_effective_channel_gain_respects_mute_solo_and_master() {
    use domain::{effective_channel_gain, StemChannel, StemQualityTier};
    let mut ch = StemChannel {
        id: "vocals".into(),
        name: "Vocals".into(),
        parent_stem: None,
        file_path: "/s/v.wav".into(),
        color_hex: "#fff".into(),
        quality_tier: StemQualityTier::default(),
        volume: 0.75, // 0 dB
        pan: 0.0,
        mute: false,
        solo: false,
    };

    let full = effective_channel_gain(&ch, false, 1.0);
    assert!(
        (full - 1.0).abs() < 0.05,
        "suwak 0.75 to 0 dB (≈1.0), jest {full}"
    );
    assert!(
        (effective_channel_gain(&ch, false, 0.5) - full / 2.0).abs() < 1e-6,
        "the master volume multiplies"
    );

    assert_eq!(
        effective_channel_gain(&ch, true, 1.0),
        0.0,
        "another channel is soloed"
    );
    ch.solo = true;
    assert!(
        effective_channel_gain(&ch, true, 1.0) > 0.0,
        "the soloed channel plays"
    );
    ch.mute = true;
    assert_eq!(
        effective_channel_gain(&ch, true, 1.0),
        0.0,
        "mute wygrywa z solo"
    );
}
