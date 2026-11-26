use desktop_integration::{write_waybar_status_to_path, ControlIpcServer, WaybarStatus};
use std::fs;

#[test]
fn test_waybar_status_serialization_and_write() {
    let tmp_path = format!("/tmp/test_auralune_waybar_{}.json", std::process::id());
    let status = WaybarStatus {
        text: "Kitsune - Resonance".to_string(),
        alt: "playing".to_string(),
        tooltip: "Resonance\nKitsune\nNeo Tokyo Vibe\n44.1 kHz FLAC".to_string(),
        class: "playing".to_string(),
        percentage: 65,
        volume: 90,
        art_url: Some("/path/to/cover.png".to_string()),
        title: "Resonance".to_string(),
        artist: "Kitsune".to_string(),
        album: "Neo Tokyo Vibe".to_string(),
        state: "Playing".to_string(),
        position_ms: 120000,
        duration_ms: 184000,
    };

    let res = write_waybar_status_to_path(&status, &tmp_path);
    assert!(res.is_ok(), "Writing the status file succeeded");

    let read_back = fs::read_to_string(&tmp_path).expect("Read the status file");
    assert!(read_back.contains("\"text\": \"Kitsune - Resonance\""));
    assert!(read_back.contains("\"class\": \"playing\""));
    assert!(read_back.contains("\"percentage\": 65"));

    let _ = fs::remove_file(&tmp_path);
}

#[test]
fn test_control_ipc_command_parsing() {
    let engine = std::sync::Arc::new(audio_engine::AudioEngine::new().expect("AudioEngine init"));

    // Test ping
    let resp = ControlIpcServer::execute_command(&engine, "ping");
    assert_eq!(resp, "PONG: AURALUNE_IPC_OK");

    // Test volume up
    let resp = ControlIpcServer::execute_command(&engine, "vol_up");
    assert_eq!(resp, "OK: VOLUME_UP");

    // Test volume down
    let resp = ControlIpcServer::execute_command(&engine, "vol_down");
    assert_eq!(resp, "OK: VOLUME_DOWN");

    // Test stop
    let resp = ControlIpcServer::execute_command(&engine, "stop");
    assert_eq!(resp, "OK: STOP");

    // Test mute toggle
    let resp = ControlIpcServer::execute_command(&engine, "mute");
    assert!(resp.starts_with("OK:"));

    // Test seek variations
    let resp_seek_pos = ControlIpcServer::execute_command(&engine, "seek 15");
    assert_eq!(resp_seek_pos, "OK: SEEK");

    let resp_seek_neg = ControlIpcServer::execute_command(&engine, "seek -10");
    assert_eq!(resp_seek_neg, "OK: SEEK");

    let resp_seek_missing = ControlIpcServer::execute_command(&engine, "seek");
    assert_eq!(resp_seek_missing, "ERR: MISSING_SEEK_ARG");

    let resp_seek_invalid = ControlIpcServer::execute_command(&engine, "seek not_a_number");
    assert_eq!(resp_seek_invalid, "ERR: INVALID_SEEK_ARG");

    // Test volume boundaries via IPC
    for _ in 0..25 {
        ControlIpcServer::execute_command(&engine, "vol_up");
    }
    assert!(engine.volume() <= 1.0, "Volume should clamp at 1.0 via IPC");

    for _ in 0..25 {
        ControlIpcServer::execute_command(&engine, "vol_down");
    }
    assert!(engine.volume() >= 0.0, "Volume should clamp at 0.0 via IPC");

    // Test unknown command
    let resp = ControlIpcServer::execute_command(&engine, "unknown_cmd_xyz");
    assert!(resp.starts_with("ERR: UNKNOWN_COMMAND"));
}
