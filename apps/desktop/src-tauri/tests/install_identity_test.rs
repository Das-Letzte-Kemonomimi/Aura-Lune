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

mod install_kind {
    use auralune_desktop::updater::{classify_install, effective_channel, InstallKind};
    use std::path::Path;

    const HOME: &str = "/home/u";

    #[test]
    fn appimage_from_install_sh_is_managed_when_writable() {
        for path in [
            "/home/u/.local/share/auralune/auralune.AppImage",
            "/home/u/.local/share/auralune-dev/auralune-dev.AppImage",
        ] {
            assert_eq!(
                classify_install(Some(path), Some(Path::new(HOME)), true, false),
                InstallKind::AppImageManaged,
                "{path}"
            );
        }
    }

    #[test]
    fn read_only_or_foreign_appimage_is_not_self_updatable() {
        let managed = "/home/u/.local/share/auralune/auralune.AppImage";
        assert_eq!(
            classify_install(Some(managed), Some(Path::new(HOME)), false, false),
            InstallKind::AppImageOther
        );
        for path in [
            "/home/u/Downloads/Auralune.AppImage",
            "/home/u/.local/share/auralune/sub/auralune.AppImage",
            "/home/other/.local/share/auralune/auralune.AppImage",
            "/opt/auralune/auralune.AppImage",
        ] {
            assert_eq!(
                classify_install(Some(path), Some(Path::new(HOME)), true, false),
                InstallKind::AppImageOther,
                "{path}"
            );
        }
        assert_eq!(
            classify_install(Some(managed), None, true, false),
            InstallKind::AppImageOther
        );
    }

    #[test]
    fn without_appimage_the_build_profile_decides() {
        assert_eq!(
            classify_install(None, Some(Path::new(HOME)), true, false),
            InstallKind::System
        );
        assert_eq!(
            classify_install(Some(""), Some(Path::new(HOME)), true, true),
            InstallKind::DevServer
        );
    }

    #[test]
    fn dev_install_or_dev_build_selects_the_dev_channel() {
        assert_eq!(effective_channel(true, "stable"), "dev");
        assert_eq!(effective_channel(false, "dev"), "dev");
        assert_eq!(effective_channel(false, "stable"), "stable");
    }
}
