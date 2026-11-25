use desktop_integration::runtime_dir::{ensure_private_dir, WAYBAR_STATUS_FILE};
use desktop_integration::{write_waybar_status_to_path, WaybarStatus};
use std::fs;
use std::os::unix::fs::{symlink, MetadataExt, PermissionsExt};
use std::path::PathBuf;

fn scratch(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "auralune_runtime_dir_test_{}_{}",
        name,
        std::process::id()
    ));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).expect("scratch dir");
    dir
}

#[test]
fn creates_private_directory_with_mode_0700() {
    let base = scratch("create");
    let dir = base.join("auralune");

    ensure_private_dir(&dir).expect("private dir");

    let meta = fs::symlink_metadata(&dir).unwrap();
    assert!(meta.is_dir());
    assert_eq!(meta.mode() & 0o777, 0o700);
    let _ = fs::remove_dir_all(&base);
}

#[test]
fn tightens_permissions_of_existing_directory() {
    let base = scratch("tighten");
    let dir = base.join("auralune");
    fs::create_dir(&dir).unwrap();
    fs::set_permissions(&dir, fs::Permissions::from_mode(0o755)).unwrap();

    ensure_private_dir(&dir).expect("private dir");

    assert_eq!(fs::metadata(&dir).unwrap().mode() & 0o777, 0o700);
    let _ = fs::remove_dir_all(&base);
}

#[test]
fn rejects_symlink_in_place_of_directory() {
    let base = scratch("symlink");
    let target = base.join("elsewhere");
    fs::create_dir(&target).unwrap();
    let dir = base.join("auralune");
    symlink(&target, &dir).unwrap();

    assert!(ensure_private_dir(&dir).is_err());
    let _ = fs::remove_dir_all(&base);
}

#[test]
fn waybar_status_file_is_private_and_replaces_stale_temp_symlink() {
    let base = scratch("waybar");
    let target = base.join(WAYBAR_STATUS_FILE);
    let victim = base.join("victim.txt");
    fs::write(&victim, "keep").unwrap();
    // Pozostawione dowiązanie w miejscu pliku tymczasowego nie może przekierować zapisu.
    let tmp = PathBuf::from(format!("{}.tmp.{}", target.display(), std::process::id()));
    symlink(&victim, &tmp).unwrap();

    write_waybar_status_to_path(&WaybarStatus::default(), &target).expect("write status");

    assert_eq!(fs::read_to_string(&victim).unwrap(), "keep");
    let meta = fs::symlink_metadata(&target).unwrap();
    assert!(meta.is_file());
    assert_eq!(meta.mode() & 0o777, 0o600);
    let _ = fs::remove_dir_all(&base);
}
