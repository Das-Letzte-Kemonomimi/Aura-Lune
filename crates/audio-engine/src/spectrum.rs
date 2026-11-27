//! Turns GStreamer spectrum analyser (`spectrum`) data into visualisation bands.
//!
//! Pure functions (no GStreamer), tested in `tests/spectrum_test.rs`.

/// Lower bound of the visualisation's dynamic range (dBFS).
pub const SPECTRUM_FLOOR_DB: f32 = -75.0;
/// Number of bands per channel emitted to the UI.
pub const DISPLAY_BANDS: usize = 16;
/// Linear bands requested from the `spectrum` element (FFT size `2 * bands - 2` = 1022 points).
/// At 44.1 kHz each bin is ~43 Hz wide, so the lowest display bars get their own bins
/// (with 64 bands one bin covered 0-344 Hz and swallowed the whole bass range).
pub const ANALYSER_BANDS: u32 = 512;
/// Sample rate assumed when the analyser caps are not known yet.
pub const DEFAULT_SAMPLE_RATE: u32 = 44_100;
/// Lowest and highest edge (Hz) of the logarithmic display bands.
pub const DISPLAY_MIN_HZ: f32 = 30.0;
pub const DISPLAY_MAX_HZ: f32 = 20_000.0;

/// Normalises dBFS levels (`SPECTRUM_FLOOR_DB..=0`) to `0.0..=1.0`.
pub fn normalize_db(db: &[f32]) -> Vec<f32> {
    db.iter()
        .map(|&v| ((v - SPECTRUM_FLOOR_DB) / -SPECTRUM_FLOOR_DB).clamp(0.0, 1.0))
        .collect()
}

/// Half-open bin range `[start, end)` of every display band for `bins` linear bins
/// covering `0..sample_rate / 2`. Band edges are spaced logarithmically from
/// [`DISPLAY_MIN_HZ`] to [`DISPLAY_MAX_HZ`] (clamped to Nyquist); every band gets at least one bin.
pub fn log_band_bin_ranges(bins: usize, sample_rate: u32) -> [(usize, usize); DISPLAY_BANDS] {
    let mut ranges = [(0usize, 1usize); DISPLAY_BANDS];
    if bins == 0 {
        return ranges;
    }
    let nyquist = sample_rate.max(2) as f32 / 2.0;
    let bin_hz = nyquist / bins as f32;
    let max_hz = DISPLAY_MAX_HZ.min(nyquist);
    let min_hz = DISPLAY_MIN_HZ.min(max_hz * 0.5);
    let ratio = (max_hz / min_hz).powf(1.0 / DISPLAY_BANDS as f32);
    let mut lo = min_hz;
    for range in &mut ranges {
        let hi = lo * ratio;
        let start = ((lo / bin_hz).floor() as usize).min(bins - 1);
        let end = ((hi / bin_hz).ceil() as usize).clamp(start + 1, bins);
        *range = (start, end);
        lo = hi;
    }
    ranges
}

/// Groups linear FFT bins into [`DISPLAY_BANDS`] logarithmic perceptual bands
/// (30 Hz sub-bass up to 20 kHz air) using the analyser's real bin width.
/// Input shorter than [`DISPLAY_BANDS`] is returned unchanged.
pub fn log_pool_bands(raw: &[f32], sample_rate: u32) -> Vec<f32> {
    if raw.len() < DISPLAY_BANDS {
        return raw.to_vec();
    }
    log_band_bin_ranges(raw.len(), sample_rate)
        .iter()
        .map(|&(start, end)| {
            let slice = &raw[start..end];
            let max_val = slice.iter().copied().fold(0.0f32, f32::max);
            let avg_val = slice.iter().sum::<f32>() / slice.len() as f32;
            (max_val * 0.7 + avg_val * 0.3).clamp(0.0, 1.0)
        })
        .collect()
}

/// One channel's bands ready for display: dB normalisation, and for a full linear FFT
/// (more bins than display bands), logarithmic grouping into [`DISPLAY_BANDS`].
pub fn channel_display_bands(db: &[f32], sample_rate: u32) -> Vec<f32> {
    let normalized = normalize_db(db);
    if normalized.len() > DISPLAY_BANDS {
        log_pool_bands(&normalized, sample_rate)
    } else {
        normalized
    }
}

/// Builds a stereo spectrum (left channel bands, then right) from the analyser magnitudes.
///
/// - two or more channels → true stereo (L + R),
/// - one channel or a flat list → mono duplicated to both channels,
/// - no data → `None`.
pub fn stereo_display_spectrum(
    channel_mags: &[Vec<f32>],
    flat_db: &[f32],
    sample_rate: u32,
) -> Option<Vec<f32>> {
    if let [left, right, ..] = channel_mags {
        let mut spectrum = channel_display_bands(left, sample_rate);
        spectrum.extend(channel_display_bands(right, sample_rate));
        return Some(spectrum);
    }
    let mono = channel_mags.first().map(Vec::as_slice).unwrap_or(flat_db);
    if mono.is_empty() {
        return None;
    }
    let bands = channel_display_bands(mono, sample_rate);
    let mut spectrum = bands.clone();
    spectrum.extend(bands);
    Some(spectrum)
}
