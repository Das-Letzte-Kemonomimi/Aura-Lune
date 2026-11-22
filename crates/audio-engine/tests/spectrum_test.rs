use audio_engine::spectrum::{
    channel_display_bands, log_pool_to_16_bands, normalize_db, stereo_display_spectrum,
    DISPLAY_BANDS, SPECTRUM_FLOOR_DB,
};

#[test]
fn test_normalize_db_maps_floor_to_zero_and_full_scale_to_one() {
    assert_eq!(
        normalize_db(&[SPECTRUM_FLOOR_DB, 0.0, -37.5]),
        vec![0.0, 1.0, 0.5]
    );
    assert_eq!(
        normalize_db(&[-200.0, 12.0]),
        vec![0.0, 1.0],
        "wartości poza zakresem są przycinane"
    );
}

#[test]
fn test_full_fft_is_pooled_to_16_bands_in_range() {
    let raw: Vec<f32> = (0..64).map(|i| i as f32 / 63.0).collect();
    let bands = log_pool_to_16_bands(&raw);
    assert_eq!(bands.len(), DISPLAY_BANDS);
    assert!(bands.iter().all(|b| (0.0..=1.0).contains(b)));
    assert!(
        bands.windows(2).all(|w| w[1] >= w[0]),
        "rosnące wejście → rosnące pasma"
    );
}

#[test]
fn test_pooling_partial_spectra_never_panics() {
    // Wejście 16–63 pasm wychodziło wcześniej poza zakres przy grupowaniu.
    for len in 16..64 {
        let raw = vec![0.5f32; len];
        assert_eq!(log_pool_to_16_bands(&raw).len(), DISPLAY_BANDS, "len={len}");
    }
    assert_eq!(
        log_pool_to_16_bands(&[0.3; 4]),
        vec![0.3; 4],
        "krótkie wejście bez zmian"
    );
}

#[test]
fn test_stereo_spectrum_from_two_channels_keeps_left_then_right() {
    let left = vec![0.0f32; 64];
    let right = vec![SPECTRUM_FLOOR_DB; 64];
    let spectrum = stereo_display_spectrum(&[left, right], &[]).unwrap();
    assert_eq!(spectrum.len(), 2 * DISPLAY_BANDS);
    assert!(spectrum[..DISPLAY_BANDS].iter().all(|&b| b == 1.0));
    assert!(spectrum[DISPLAY_BANDS..].iter().all(|&b| b == 0.0));
}

#[test]
fn test_mono_spectrum_is_duplicated_and_empty_input_yields_none() {
    let flat = vec![-37.5f32; 64];
    let spectrum = stereo_display_spectrum(&[], &flat).unwrap();
    assert_eq!(spectrum.len(), 2 * DISPLAY_BANDS);
    assert_eq!(spectrum[..DISPLAY_BANDS], spectrum[DISPLAY_BANDS..]);
    assert_eq!(channel_display_bands(&flat).len(), DISPLAY_BANDS);
    assert_eq!(stereo_display_spectrum(&[], &[]), None);
}
