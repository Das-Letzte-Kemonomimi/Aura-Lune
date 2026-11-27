use super::write_file_if_changed;
use std::path::PathBuf;

fn temp_test_dir(name: &str) -> PathBuf {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let dir = std::env::temp_dir().join(format!(
        "auralune_themes_test_{name}_{}_{nanos}",
        std::process::id()
    ));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

#[test]
fn test_write_file_if_changed_skips_identical_contents() {
    let dir = temp_test_dir("skip_unchanged");
    let path = dir.join("icon.png");

    // 1. Missing file is written.
    assert!(write_file_if_changed(&path, b"PNG_DATA_V1").unwrap());
    assert_eq!(std::fs::read(&path).unwrap(), b"PNG_DATA_V1");

    // 2. Identical content is skipped (returns false).
    assert!(!write_file_if_changed(&path, b"PNG_DATA_V1").unwrap());

    // 3. Same length but changed bytes overwrites and returns true.
    assert!(write_file_if_changed(&path, b"PNG_DATA_V2").unwrap());
    assert_eq!(std::fs::read(&path).unwrap(), b"PNG_DATA_V2");

    // 4. Different length overwrites and returns true.
    assert!(write_file_if_changed(&path, b"PNG_DATA_LONGER").unwrap());
    assert_eq!(std::fs::read(&path).unwrap(), b"PNG_DATA_LONGER");

    let _ = std::fs::remove_dir_all(&dir);
}
