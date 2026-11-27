use audio_engine::spectrum::{
    channel_display_bands, log_band_bin_ranges, log_pool_bands, normalize_db,
    stereo_display_spectrum, ANALYSER_BANDS, DEFAULT_SAMPLE_RATE, DISPLAY_BANDS, SPECTRUM_FLOOR_DB,
};

const BINS: usize = ANALYSER_BANDS as usize;
const RATE: u32 = DEFAULT_SAMPLE_RATE;

#[test]
fn test_normalize_db_maps_floor_to_zero_and_full_scale_to_one() {
    assert_eq!(
        normalize_db(&[SPECTRUM_FLOOR_DB, 0.0, -37.5]),
        vec![0.0, 1.0, 0.5]
    );
    assert_eq!(
        normalize_db(&[-200.0, 12.0]),
        vec![0.0, 1.0],
        "out-of-range values are clamped"
    );
}

#[test]
fn test_full_fft_is_pooled_to_16_bands_in_range() {
    let raw: Vec<f32> = (0..BINS).map(|i| i as f32 / (BINS - 1) as f32).collect();
    let bands = log_pool_bands(&raw, RATE);
    assert_eq!(bands.len(), DISPLAY_BANDS);
    assert!(bands.iter().all(|b| (0.0..=1.0).contains(b)));
    assert!(
        bands.windows(2).all(|w| w[1] >= w[0]),
        "rising input → rising bands"
    );
}

#[test]
fn test_band_ranges_are_ordered_non_empty_and_in_bounds() {
    for (bins, rate) in [
        (BINS, 44_100),
        (BINS, 48_000),
        (BINS, 96_000),
        (64, 44_100),
        (17, 8_000),
    ] {
        let ranges = log_band_bin_ranges(bins, rate);
        for &(s, e) in &ranges {
            assert!(
                s < e && e <= bins,
                "bins={bins} rate={rate} range=({s},{e})"
            );
        }
        assert!(
            ranges
                .windows(2)
                .all(|w| w[1].0 >= w[0].0 && w[1].1 >= w[0].1),
            "bins={bins} rate={rate}: ranges must move upwards"
        );
    }
}

#[test]
fn test_bass_is_resolved_into_several_bars() {
    // The old 64-band analyser put 0-344 Hz into a single bin. With 512 bands a
    // 100 Hz kick and a 250 Hz bass line must light different bars.
    let bin_hz = (RATE as f32 / 2.0) / BINS as f32;
    let tone = |hz: f32| {
        let mut raw = vec![0.0f32; BINS];
        raw[(hz / bin_hz) as usize] = 1.0;
        let bands = log_pool_bands(&raw, RATE);
        bands
            .iter()
            .enumerate()
            .max_by(|a, b| a.1.total_cmp(b.1))
            .map(|(i, _)| i)
            .unwrap()
    };
    let (kick, bass, mid, air) = (tone(100.0), tone(250.0), tone(1_000.0), tone(15_000.0));
    assert!(
        kick < bass && bass < mid && mid < air,
        "{kick} {bass} {mid} {air}"
    );
    assert!(
        bass <= 6,
        "250 Hz must sit in the lower half of the bars, got {bass}"
    );
}

#[test]
fn test_pooling_partial_spectra_never_panics() {
    for len in 16..80 {
        let raw = vec![0.5f32; len];
        assert_eq!(log_pool_bands(&raw, RATE).len(), DISPLAY_BANDS, "len={len}");
    }
    assert_eq!(
        log_pool_bands(&[0.3; 4], RATE),
        vec![0.3; 4],
        "short input unchanged"
    );
}

#[test]
fn test_stereo_channels_are_kept_apart() {
    let left = vec![0.0f32; BINS];
    let right = vec![SPECTRUM_FLOOR_DB; BINS];
    let spectrum = stereo_display_spectrum(&[left, right], &[], RATE).unwrap();
    assert_eq!(spectrum.len(), 2 * DISPLAY_BANDS);
    assert!(spectrum[..DISPLAY_BANDS].iter().all(|&b| b == 1.0));
    assert!(spectrum[DISPLAY_BANDS..].iter().all(|&b| b == 0.0));
}

#[test]
fn test_mono_and_flat_lists_are_duplicated_and_empty_is_none() {
    let flat = vec![-37.5f32; 16];
    let spectrum = stereo_display_spectrum(&[], &flat, RATE).unwrap();
    assert_eq!(spectrum.len(), 2 * DISPLAY_BANDS);
    assert_eq!(spectrum[..DISPLAY_BANDS], spectrum[DISPLAY_BANDS..]);
    assert_eq!(channel_display_bands(&flat, RATE).len(), DISPLAY_BANDS);
    assert_eq!(stereo_display_spectrum(&[], &[], RATE), None);
}
