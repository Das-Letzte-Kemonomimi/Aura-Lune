use auralune_desktop::commands::dsp::get_equalizer_presets_internal;
use auralune_desktop::commands::library::{init_thumbnail_cache_dir, thumbnail_file};
use auralune_desktop::commands::metadata::LastFmScrobbleRequest;
use auralune_desktop::commands::playback::{
    extract_audio_paths_from_args, is_supported_audio, normalize_art_url, normalize_path_or_url,
};
use auralune_desktop::commands::stems::{list_model_packs_internal, StemProgressPayload};
use auralune_desktop::AppState;
use desktop_integration::{DiscordRpcStatus, DEFAULT_DISCORD_CLIENT_ID};

#[test]
fn test_app_state_is_send_sync() {
    fn assert_send_sync<T: Send + Sync>() {}
    assert_send_sync::<AppState>();
}

#[test]
fn test_default_discord_rpc_status_when_no_controller() {
    let status = DiscordRpcStatus {
        enabled: false,
        connected: false,
        client_id: DEFAULT_DISCORD_CLIENT_ID.to_string(),
        current_activity: None,
    };
    assert!(!status.enabled);
    assert!(!status.connected);
    assert!(!status.client_id.is_empty());
}

#[test]
fn test_equalizer_presets_not_empty() {
    let presets = get_equalizer_presets_internal();
    assert!(!presets.is_empty());
    assert!(presets.iter().any(|p| p.name.contains("Flat")));
}

#[test]
fn test_normalize_art_url_passes_https_and_drops_data_uris() {
    let http_url = "https://example.com/cover.jpg";
    assert_eq!(
        normalize_art_url(Some(http_url)),
        Some(http_url.to_string())
    );
    assert_eq!(
        normalize_art_url(Some("data:image/jpeg;base64,/9j/4AAQ")),
        None
    );
}

#[test]
fn test_thumbnail_file_downscales_local_images_by_edge() {
    let dir = std::env::temp_dir().join(format!("auralune_cover_thumb_{}", std::process::id()));
    let thumbs_dir = dir.join("thumbs");
    std::fs::create_dir_all(&thumbs_dir).unwrap();
    init_thumbnail_cache_dir(thumbs_dir);

    let path = dir.join("cover.png");
    image::RgbImage::from_pixel(1600, 1200, image::Rgb([200, 40, 120]))
        .save(&path)
        .unwrap();

    let small = thumbnail_file(&path, 256).expect("256px thumbnail");
    let small_img = image::open(&small).unwrap();
    assert_eq!((small_img.width(), small_img.height()), (256, 192));

    let large = thumbnail_file(&path, 768).expect("768px thumbnail");
    let large_img = image::open(&large).unwrap();
    assert_eq!((large_img.width(), large_img.height()), (768, 576));
    assert_ne!(small, large);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn test_lastfm_scrobble_request_serialization() {
    let req = LastFmScrobbleRequest {
        session_key: "abc_key".to_string(),
        artist: "Ado".to_string(),
        track: "Show".to_string(),
        album: Some("Zanmu".to_string()),
        duration_sec: Some(184),
        timestamp: Some(1700000000),
        api_key: None,
        api_secret: None,
    };
    let json = serde_json::to_string(&req).expect("Failed to serialize request");
    let deserialized: LastFmScrobbleRequest =
        serde_json::from_str(&json).expect("Failed to deserialize");
    assert_eq!(deserialized.artist, "Ado");
}

#[test]
fn test_lastfm_auth_url_result() {
    let auth = auralune_desktop::commands::metadata::LastFmAuthUrlResult {
        token: "tok123".to_string(),
        auth_url: "https://www.last.fm/api/auth/?api_key=xyz&token=tok123".to_string(),
    };
    assert!(auth.auth_url.contains("tok123"));
}

#[test]
fn test_is_supported_audio_formats() {
    assert!(is_supported_audio("song.mp3"));
    assert!(is_supported_audio("music/track.flac"));
    assert!(is_supported_audio("test.opus"));
    assert!(is_supported_audio("album/track.wav"));
    assert!(is_supported_audio("stream.ogg"));
    assert!(is_supported_audio("audio.m4a"));
    assert!(is_supported_audio("audio.aac"));
    assert!(is_supported_audio("audio.alac"));
    assert!(is_supported_audio("audio.aiff"));
    assert!(is_supported_audio("playlist.m3u"));
    assert!(is_supported_audio("playlist.m3u8"));
    assert!(is_supported_audio("sheet.cue"));
    assert!(!is_supported_audio("document.pdf"));
    assert!(!is_supported_audio("image.png"));
}

#[test]
fn test_normalize_path_or_url_http() {
    assert_eq!(
        normalize_path_or_url("https://stream.example.com/live.opus", None),
        Some("https://stream.example.com/live.opus".to_string())
    );
    assert_eq!(
        normalize_path_or_url("http://radio.anime.org/stream", None),
        Some("http://radio.anime.org/stream".to_string())
    );
    assert_eq!(normalize_path_or_url("   ", None), None);
}

#[test]
fn test_extract_audio_paths_from_args() {
    let args = vec![
        "auralune".to_string(),
        "--bazzite".to_string(),
        "-v".to_string(),
        "https://stream.anime.fm/live".to_string(),
    ];
    let extracted = extract_audio_paths_from_args(&args, None);
    assert_eq!(extracted.len(), 1);
    assert_eq!(extracted[0], "https://stream.anime.fm/live");
}

#[test]
fn test_list_model_packs_not_empty() {
    let packs = list_model_packs_internal();
    assert!(!packs.is_empty());
}

#[test]
fn test_stem_progress_payload_serialization() {
    let payload = StemProgressPayload {
        track_id: 10,
        progress: 0.5,
        message: "Extracting vocals".to_string(),
    };
    let serialized = serde_json::to_string(&payload).expect("Failed serialization");
    assert!(serialized.contains("Extracting vocals"));
    assert!(serialized.contains("10"));
}
