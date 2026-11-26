//! Decoding for analysis (`DecodeSession`) and the streaming waveform.

use audio_engine::{
    decode_snippet_for_analysis, decode_stereo_for_stems, extract_track_waveform_peaks,
    write_wav_file, WaveformAccumulator,
};
use std::time::{Duration, Instant};

fn temp_path(name: &str, ext: &str) -> std::path::PathBuf {
    std::env::temp_dir().join(format!("auralune_{}_{}.{}", name, std::process::id(), ext))
}

/// 1 s of silence, then 1 s of a 440 Hz tone (44.1 kHz stereo). With `inverted_right` the right channel has
/// inverted phase (checks channel separation; in a mono mix such a signal cancels out).
fn tone_wav(name: &str, inverted_right: bool) -> std::path::PathBuf {
    let sr = 44_100u32;
    let mut interleaved = vec![0.0f32; sr as usize * 2];
    for i in 0..sr as usize {
        let s = 0.8 * (i as f32 * 440.0 * std::f32::consts::TAU / sr as f32).sin();
        interleaved.extend([s, if inverted_right { -s } else { s }]);
    }
    let path = temp_path(name, "wav");
    write_wav_file(&path, &interleaved, sr, 2).expect("writing the WAV");
    path
}

#[test]
fn test_corrupt_file_fails_fast_instead_of_hanging() {
    let path = temp_path("corrupt", "flac");
    std::fs::write(&path, b"this is not an audio file, just text").unwrap();
    let start = Instant::now();
    let result = decode_snippet_for_analysis(path.to_str().unwrap(), 10.0);
    assert!(result.is_err(), "a corrupt file must return an error");
    assert!(
        start.elapsed() < Duration::from_secs(5),
        "decoding must not hang: {:?}",
        start.elapsed()
    );
    assert!(extract_track_waveform_peaks(path.to_str().unwrap(), 32).is_err());
    let _ = std::fs::remove_file(path);
}

#[test]
fn test_missing_file_is_an_error() {
    let path = temp_path("does_not_exist", "wav");
    assert!(decode_stereo_for_stems(path.to_str().unwrap(), 5.0).is_err());
}

#[test]
fn test_mono_snippet_respects_requested_length() {
    let path = tone_wav("snippet_len", false);
    let samples = decode_snippet_for_analysis(path.to_str().unwrap(), 0.5).unwrap();
    assert_eq!(samples.len(), 11_025, "0.5 s at 22 050 Hz");
    let _ = std::fs::remove_file(path);
}

#[test]
fn test_stereo_decode_keeps_channels_separate() {
    let path = tone_wav("stereo_split", true);
    let (left, right, rate) = decode_stereo_for_stems(path.to_str().unwrap(), 60.0).unwrap();
    assert_eq!(rate, 44_100);
    assert_eq!(left.len(), right.len());
    assert!((left.len() as i64 - 88_200).abs() < 2_000, "{}", left.len());
    // The right channel is the inverted phase of the left in the tone part.
    let tail = left.len() - 10_000;
    let corr: f32 = left[tail..]
        .iter()
        .zip(&right[tail..])
        .map(|(l, r)| l * r)
        .sum();
    assert!(corr < 0.0, "channels swapped or mixed");
    let _ = std::fs::remove_file(path);
}

#[test]
fn test_waveform_of_real_file_shows_quiet_start_and_loud_end() {
    let path = tone_wav("waveform_real", false);
    let peaks = extract_track_waveform_peaks(path.to_str().unwrap(), 20).unwrap();
    assert_eq!(peaks.len(), 20);
    assert!(peaks[..9].iter().all(|&p| p <= 0.06), "{peaks:?}");
    assert!(peaks[11..].iter().all(|&p| p > 0.9), "{peaks:?}");
    let _ = std::fs::remove_file(path);
}

#[test]
fn test_accumulator_covers_inputs_longer_than_the_old_20m_sample_cap() {
    // About 40 min at 11 025 Hz (26.5 M samples): silence, with signal in the last quarter.
    let total = 26_460_000usize;
    let mut acc = WaveformAccumulator::new();
    let quiet = vec![0.0f32; 1_000_000];
    let loud = vec![0.5f32; 1_000_000];
    let mut pushed = 0;
    while pushed < total {
        let chunk = if pushed >= total * 3 / 4 {
            &loud
        } else {
            &quiet
        };
        let n = chunk.len().min(total - pushed);
        acc.push(&chunk[..n]);
        pushed += n;
    }
    let peaks = acc.finish(8);
    assert_eq!(peaks.len(), 8);
    assert!(peaks[..5].iter().all(|&p| p <= 0.06), "{peaks:?}");
    assert_eq!(
        peaks[7], 1.0,
        "the end of the track must not be cut off: {peaks:?}"
    );
}

#[test]
fn test_accumulator_with_more_buckets_than_blocks_pads_with_floor() {
    let mut acc = WaveformAccumulator::new();
    acc.push(&[0.5; 300]);
    let peaks = acc.finish(10);
    assert_eq!(peaks.len(), 10);
    assert!(peaks.iter().all(|&p| (0.05..=1.0).contains(&p)));
    assert!(peaks.contains(&1.0));
}
