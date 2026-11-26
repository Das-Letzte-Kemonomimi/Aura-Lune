use domain::paths::{check_write_target, has_allowed_extension, is_safe_file_token};
use std::path::Path;

const HOME: &str = "/home/kitsune";

fn ok(p: &str) -> bool {
    let app_data = Path::new("/home/kitsune/.local/share/com.auralune.player");
    check_write_target(Path::new(p), Some(Path::new(HOME)), &[app_data]).is_ok()
}

#[test]
fn test_normal_user_locations_are_writable() {
    assert!(ok("/home/kitsune/Music/export.flac"));
    assert!(ok("/home/kitsune/Desktop/playlist.m3u8"));
    assert!(ok("/mnt/nas/music/a.flac"));
    assert!(ok("/media/usb/a.flac"));
    assert!(ok("/run/media/kitsune/USB/a.flac"), "removable media");
    assert!(ok("/tmp/auralune-render.wav"));
}

#[test]
fn test_app_data_dir_is_allowed_even_though_hidden() {
    assert!(ok(
        "/home/kitsune/.local/share/com.auralune.player/models/htdemucs.onnx"
    ));
}

#[test]
fn test_hidden_home_entries_and_system_dirs_are_rejected() {
    for p in [
        "/home/kitsune/.bashrc",
        "/home/kitsune/.ssh/authorized_keys",
        "/home/kitsune/.config/autostart/evil.desktop",
        "/home/kitsune/.local/share/applications/evil.desktop",
        "/etc/passwd",
        "/usr/bin/sh",
        "/var/spool/cron/kitsune",
        "/run/user/1000/evil",
        "/root/x",
    ] {
        assert!(!ok(p), "{p} must be forbidden");
    }
}

#[test]
fn test_relative_and_parent_paths_are_rejected() {
    assert!(!ok("Music/a.flac"));
    assert!(!ok("/home/kitsune/Music/../.bashrc"));
}

#[test]
fn test_extension_and_token_helpers() {
    assert!(has_allowed_extension(
        Path::new("/a/B.PNG"),
        &["png", "jpg"]
    ));
    assert!(!has_allowed_extension(Path::new("/a/id_rsa"), &["png"]));
    assert!(is_safe_file_token("b1a9c0e9-d987-4042-ae91-78d6a3267d69"));
    assert!(!is_safe_file_token("../../etc/x"));
    assert!(!is_safe_file_token(""));
}

#[test]
fn test_library_database_is_never_writable_even_in_app_data_dir() {
    for p in [
        "/home/kitsune/.local/share/com.auralune.player/auralune_library.db",
        "/home/kitsune/.local/share/com.auralune.player/auralune_library.db-wal",
        "/home/kitsune/.local/share/com.auralune.player/auralune_library.db-shm",
        "/home/kitsune/Music/auralune_library.db",
    ] {
        assert!(!ok(p), "the library database must be protected: {p}");
    }
}
