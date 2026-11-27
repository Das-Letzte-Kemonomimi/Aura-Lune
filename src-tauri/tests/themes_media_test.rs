use auralune_desktop::commands::themes::{
    inline_background_ref_for_export, normalize_background_ref_for_storage, store_background_file,
};
use base64::Engine;

#[test]
fn stores_streams_and_inlines_wallpapers_for_portable_export() {
    let dir = std::env::temp_dir().join(format!("auralune_bg_test_{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();

    // Create a source PNG on disk and store it content-addressed.
    let src_png = dir.join("source.png");
    image::RgbImage::from_pixel(4, 4, image::Rgb([12, 34, 56]))
        .save(&src_png)
        .unwrap();
    let original_bytes = std::fs::read(&src_png).unwrap();

    let url1 = store_background_file(&dir, &src_png).expect("store background file");
    assert!(url1.starts_with("auralune-media://localhost/bg/"));
    assert!(url1.ends_with(".png"));

    // Storing identical content via data URI deduplicates to the exact same URL.
    let data_uri = format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(&original_bytes)
    );
    let url2 = normalize_background_ref_for_storage(&dir, Some(data_uri.clone()))
        .expect("normalize")
        .expect("some url");
    assert_eq!(url1, url2);

    // Export inlines the file back into the identical portable data URI.
    let exported = inline_background_ref_for_export(&dir, Some(&url1)).expect("exported uri");
    assert_eq!(exported, data_uri);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn rejects_unsupported_background_mime_or_svg() {
    let dir = std::env::temp_dir().join(format!("auralune_bg_reject_{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();

    let bad = normalize_background_ref_for_storage(
        &dir,
        Some("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=".to_string()),
    );
    assert!(bad.is_err());

    let _ = std::fs::remove_dir_all(&dir);
}
