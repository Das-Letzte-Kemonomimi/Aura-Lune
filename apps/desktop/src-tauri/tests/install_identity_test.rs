use auralune_desktop::commands::themes::install_identity;

#[test]
fn dev_channel_is_detected_from_env() {
    let id = install_identity(Some("dev"), None);
    assert!(id.is_dev);
    assert_eq!(id.app_id, "auralune-dev");
}

#[test]
fn dev_channel_is_detected_from_appimage_path() {
    let id = install_identity(
        None,
        Some("/home/u/.local/share/auralune-dev/auralune-dev.AppImage"),
    );
    assert_eq!(id.app_id, "auralune-dev");
}

#[test]
fn stable_is_the_default() {
    let id = install_identity(
        None,
        Some("/home/u/.local/share/auralune/auralune.AppImage"),
    );
    assert!(!id.is_dev);
    assert_eq!(id.app_id, "auralune");
    assert_eq!(install_identity(Some("stable"), None).app_id, "auralune");
}
