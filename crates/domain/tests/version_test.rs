//! Semantic version comparison (`domain::version`).

use domain::version::{is_newer, Version};

#[test]
fn release_is_newer_than_its_dev_prerelease() {
    assert!(is_newer("1.1.6", "1.1.6-dev").unwrap());
    assert!(!is_newer("1.1.6-dev", "1.1.6").unwrap());
}

#[test]
fn numeric_components_are_compared_as_numbers() {
    assert!(is_newer("1.2.0", "1.1.10").unwrap());
    assert!(is_newer("v1.10.0", "1.9.9").unwrap());
    assert!(!is_newer("1.1.6", "1.1.6").unwrap());
}

#[test]
fn prerelease_identifiers_follow_semver_order() {
    assert!(is_newer("1.0.0-rc.2", "1.0.0-rc.1").unwrap());
    assert!(is_newer("1.0.0-rc.10", "1.0.0-rc.9").unwrap());
    assert!(is_newer("1.0.0-rc", "1.0.0-1").unwrap());
    assert!(is_newer("1.0.0-rc.1", "1.0.0-rc").unwrap());
}

#[test]
fn build_metadata_and_v_prefix_are_ignored() {
    assert_eq!(
        Version::parse("v1.2.3+abc").unwrap(),
        Version::parse("1.2.3").unwrap()
    );
}

#[test]
fn malformed_versions_are_rejected() {
    for bad in [
        "",
        "1.2",
        "1.2.3.4",
        "a.b.c",
        "1.2.3-",
        "1..3",
        "1.2.3-a..b",
    ] {
        assert!(Version::parse(bad).is_err(), "{bad:?} should be rejected");
    }
}
