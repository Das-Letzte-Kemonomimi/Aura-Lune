use audio_engine::uri::media_uri;
use audio_engine::{AudioEngine, DeviceManager, Transcoder};
use domain::transcode::{DspExportSettings, ExportFormat, TimeRange};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::thread::sleep;
use std::time::Duration;

static TEMP_SEQ: AtomicU64 = AtomicU64::new(1);

struct TempTestDir(PathBuf);

impl TempTestDir {
    fn new(prefix: &str) -> Self {
        let seq = TEMP_SEQ.fetch_add(1, Ordering::Relaxed);
        let dir =
            std::env::temp_dir().join(format!("auralune_{prefix}_{}_{}", std::process::id(), seq));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("Creating temp test directory");
        Self(dir)
    }

    fn child(&self, name: &str) -> PathBuf {
        self.0.join(name)
    }
}

impl Drop for TempTestDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn fixture_path(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("tests/fixtures")
        .join(name)
}

fn file_uri(path: &Path) -> String {
    let canonical = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    media_uri(&canonical.to_string_lossy())
}

#[test]
fn test_opus_playback_and_pitch_shift() {
    let fixture_opus = fixture_path("test_sine_440hz.opus");

    assert!(
        fixture_opus.exists(),
        "The Opus test file should exist: {:?}",
        fixture_opus
    );

    let engine = AudioEngine::new().expect("AudioEngine should initialise");
    let uri = file_uri(&fixture_opus);

    engine
        .load_uri(&uri)
        .expect("Loading the Opus file should succeed");
    engine.play().expect("Playing the Opus file should succeed");
    sleep(Duration::from_millis(150));

    // Pitch shift on the fly on an Opus file
    engine
        .set_pitch_semitones(5.0)
        .expect("Pitch shift on Opus should succeed");
    assert_eq!(engine.dsp_params().pitch_semitones, 5.0);

    engine.stop().expect("Stopping should succeed");
}

#[test]
fn test_transcoding_preserves_source_file_and_creates_valid_target() {
    let temp = TempTestDir::new("transcode");
    let input_wav = fixture_path("test_sine_440hz.wav");
    let output_transcoded_opus = temp.child("test_converted_output.opus");
    let output_transcoded_flac = temp.child("test_converted_output.flac");

    let input_size_before = fs::metadata(&input_wav)
        .expect("The source WAV file must exist")
        .len();

    // 1. Convert WAV -> Opus (192 kbps)
    Transcoder::transcode(
        &input_wav,
        &output_transcoded_opus,
        ExportFormat::Opus { bitrate_kbps: 192 },
    )
    .expect("Transcoding WAV -> Opus should succeed");

    // 2. Convert WAV -> FLAC
    Transcoder::transcode(
        &input_wav,
        &output_transcoded_flac,
        ExportFormat::Flac {
            compression_level: 5,
        },
    )
    .expect("Transcoding WAV -> FLAC should succeed");

    // 3. CHECK THE SAFETY RULE:
    // The source file still exists and its size has not changed
    assert!(input_wav.exists(), "The source WAV file MUST exist!");
    let input_size_after = fs::metadata(&input_wav).unwrap().len();
    assert_eq!(
        input_size_before, input_size_after,
        "The source file must not be modified!"
    );

    // 4. Check the output files
    assert!(
        output_transcoded_opus.exists(),
        "The Opus file must be created"
    );
    assert!(output_transcoded_opus.metadata().unwrap().len() > 1000);

    assert!(
        output_transcoded_flac.exists(),
        "The FLAC file must be created"
    );
    assert!(output_transcoded_flac.metadata().unwrap().len() > 1000);

    // 5. Check that the generated Opus file can be played by AudioEngine
    let engine = AudioEngine::new().unwrap();
    let uri = file_uri(&output_transcoded_opus);
    engine
        .load_uri(&uri)
        .expect("Loading the generated Opus should succeed");
    engine
        .play()
        .expect("Playing the generated Opus should succeed");
    sleep(Duration::from_millis(150));
    engine.stop().unwrap();
}

#[test]
fn test_device_manager_discovers_cards_and_codecs() {
    let cards = match DeviceManager::list_cards() {
        Ok(c) => c,
        Err(e) => {
            println!(
                "Skipped the sound card query (no audio server/pactl in this environment): {}",
                e
            );
            return;
        }
    };

    // In a headless CI environment (e.g. GitHub Actions) there are no physical sound cards
    if cards.is_empty() {
        println!("No physical sound cards in this environment (e.g. a headless CI runner)");
        return;
    }

    for card in &cards {
        println!("Detected card: {} (BT: {})", card.name, card.is_bluetooth);
        if card.supports_pro_audio() {
            println!("  -> The card supports Pro Audio mode!");
        }
        if card.is_bluetooth {
            let codecs = card.available_bluetooth_codecs();
            println!("  -> Available Bluetooth codecs: {:?}", codecs);
        }
    }
}

#[test]
fn test_transcoding_with_dsp_nightcore_bounce() {
    let temp = TempTestDir::new("nightcore");
    let input_wav = fixture_path("test_sine_440hz.wav");
    let output_dsp_opus = temp.child("test_nightcore_output.opus");

    let dsp_settings = DspExportSettings {
        pitch_semitones: 3.0,
        tempo_ratio: 1.25,
        rate_ratio: 1.0,
        engine: Some("RubberBand".into()),
        reverb_level: 0.15,
        eq_bands: Some(vec![3.0, 2.0, 0.0, 0.0, 1.0, 2.0, 3.0, 2.0, 1.0, 0.0]),
    };

    Transcoder::transcode_with_dsp(
        &input_wav,
        &output_dsp_opus,
        ExportFormat::Opus { bitrate_kbps: 192 },
        Some(&dsp_settings),
        None,
    )
    .expect("Transcoding with DSP should succeed");

    assert!(
        output_dsp_opus.exists(),
        "The Opus output file with DSP must exist!"
    );
    assert!(
        fs::metadata(&output_dsp_opus).unwrap().len() > 100,
        "The generated file with DSP must not be empty"
    );

    // Play the generated file with DSP
    let engine = AudioEngine::new().unwrap();
    let uri = file_uri(&output_dsp_opus);
    engine.load_uri(&uri).unwrap();
    engine.play().unwrap();
    sleep(Duration::from_millis(150));
    engine.stop().unwrap();
}

#[test]
fn test_transcode_range_marker_a_to_b() {
    let temp = TempTestDir::new("range_ab");
    let input_wav = fixture_path("test_sine_440hz.wav");
    let output_range_wav = temp.child("test_range_marker_ab.wav");

    let range = TimeRange::new(500, Some(1500)).expect("Valid A-B range");

    Transcoder::transcode_range(&input_wav, &output_range_wav, ExportFormat::Wav, &range)
        .expect("Transcoding the A-B slice should succeed");

    assert!(output_range_wav.exists(), "The A-B slice file must exist");
    let size = fs::metadata(&output_range_wav).unwrap().len();
    assert!(size > 1000, "The slice file must contain audio data");

    // Check playback of the slice through AudioEngine
    let engine = AudioEngine::new().unwrap();
    let uri = file_uri(&output_range_wav);
    engine
        .load_uri(&uri)
        .expect("Loading the slice into the player");
    engine.play().expect("Playing the slice");
    sleep(Duration::from_millis(100));
    engine.stop().unwrap();
}

#[test]
fn test_transcode_range_with_dsp_nightcore() {
    let temp = TempTestDir::new("range_dsp");
    let input_wav = fixture_path("test_sine_440hz.wav");
    let output_range_opus = temp.child("test_range_dsp_ab.opus");

    let dsp_settings = DspExportSettings {
        pitch_semitones: 4.0,
        tempo_ratio: 1.3,
        rate_ratio: 1.0,
        engine: Some("RubberBand".into()),
        reverb_level: 0.1,
        eq_bands: None,
    };
    let range = TimeRange::new(200, Some(1200)).expect("Valid A-B range");

    Transcoder::transcode_with_dsp(
        &input_wav,
        &output_range_opus,
        ExportFormat::Opus { bitrate_kbps: 192 },
        Some(&dsp_settings),
        Some(&range),
    )
    .expect("Transcoding the slice with DSP should succeed");

    assert!(
        output_range_opus.exists(),
        "The slice file with DSP must exist"
    );
    let size = fs::metadata(&output_range_opus).unwrap().len();
    assert!(size > 100, "The slice file with DSP must not be empty");

    let engine = AudioEngine::new().unwrap();
    let uri = file_uri(&output_range_opus);
    engine.load_uri(&uri).expect("Loading the slice with DSP");
    engine.play().expect("Playing the slice with DSP");
    sleep(Duration::from_millis(100));
    let dur = engine.duration();
    println!(
        "test_transcode_range_with_dsp_nightcore duration: {:?}",
        dur
    );
    assert!(
        dur.is_some_and(|d| d.as_millis() >= 700 && d.as_millis() <= 850),
        "A 1000ms slice sped up 1.3x should last ~769ms, but lasted: {:?}",
        dur
    );
    engine.stop().unwrap();
}

#[test]
fn test_transcode_range_invalid_order_rejected() {
    let temp = TempTestDir::new("invalid_range");
    let input_wav = fixture_path("test_sine_440hz.wav");
    let output_wav = temp.child("test_invalid_range.wav");

    let invalid_range = TimeRange {
        start_ms: 1500,
        end_ms: Some(500),
    };

    let result =
        Transcoder::transcode_range(&input_wav, &output_wav, ExportFormat::Wav, &invalid_range);

    assert!(
        result.is_err(),
        "The transcoder must reject an invalid time range"
    );
}

#[test]
fn test_transcode_range_with_file_uri_prefix() {
    let temp = TempTestDir::new("uri_range");
    let input_wav = fixture_path("test_sine_440hz.wav");
    let output_wav = temp.child("test_uri_range.wav");

    let uri_string = file_uri(&input_wav);
    let range = TimeRange::new(300, Some(900)).unwrap();

    Transcoder::transcode_range(uri_string, &output_wav, ExportFormat::Wav, &range)
        .expect("Transcoding from a file:// path should succeed");

    assert!(output_wav.exists());
}

#[test]
fn test_transcode_flac_range() {
    let input_flac = fixture_path("08. Omnia Sol Temperat.flac");
    if !input_flac.exists() {
        return;
    }
    let temp = TempTestDir::new("flac_range");
    let output_opus = temp.child("test_flac_range.opus");

    let range = TimeRange::new(1000, Some(4000)).unwrap();
    let res = Transcoder::transcode_with_dsp(
        &input_flac,
        &output_opus,
        ExportFormat::Opus { bitrate_kbps: 192 },
        None,
        Some(&range),
    );
    assert!(res.is_ok());
    let engine = AudioEngine::new().unwrap();
    let uri = file_uri(&output_opus);
    engine.load_uri(&uri).expect("Loading the slice");
    engine.play().expect("Playing the slice");
    std::thread::sleep(Duration::from_millis(50));
    let dur = engine.duration();
    println!("Exported range duration: {:?}", dur);
    engine.stop().unwrap();
}

#[test]
fn test_transcode_slowed_rubberband() {
    let temp = TempTestDir::new("slowed_rb");
    let input_wav = fixture_path("test_sine_440hz.wav");
    let output_slowed_wav = temp.child("test_slowed_rubberband.wav");

    let dsp_settings = DspExportSettings {
        pitch_semitones: 2.0,
        tempo_ratio: 0.55,
        rate_ratio: 1.0,
        engine: Some("RubberBand".into()),
        reverb_level: 0.0,
        eq_bands: None,
    };

    Transcoder::transcode_with_dsp(
        &input_wav,
        &output_slowed_wav,
        ExportFormat::Wav,
        Some(&dsp_settings),
        None,
    )
    .expect("Slowed transcoding with RubberBand should succeed");

    assert!(output_slowed_wav.exists());
    assert!(fs::metadata(&output_slowed_wav).unwrap().len() > 100);
}

#[test]
fn test_transcode_different_ranges_with_rubberband_slowed() {
    let input_flac = fixture_path("08. Omnia Sol Temperat.flac");
    if !input_flac.exists() {
        return;
    }

    let temp = TempTestDir::new("ranges_rb");
    let out1 = temp.child("test_range1.opus");
    let out2 = temp.child("test_range2.opus");

    let dsp_settings = DspExportSettings {
        pitch_semitones: -3.0,
        tempo_ratio: 0.55,
        rate_ratio: 1.0,
        engine: Some("RubberBand".into()),
        reverb_level: 0.15,
        eq_bands: None,
    };

    // Range 1: 219336ms to 228354ms (9.018 seconds of source)
    let range1 = TimeRange::new(219336, Some(228354)).unwrap();
    Transcoder::transcode_with_dsp(
        &input_flac,
        &out1,
        ExportFormat::Opus { bitrate_kbps: 192 },
        Some(&dsp_settings),
        Some(&range1),
    )
    .expect("Transcoding range 1");

    // Range 2: 22449ms to 40690ms (18.241 seconds of source)
    let range2 = TimeRange::new(22449, Some(40690)).unwrap();
    Transcoder::transcode_with_dsp(
        &input_flac,
        &out2,
        ExportFormat::Opus { bitrate_kbps: 192 },
        Some(&dsp_settings),
        Some(&range2),
    )
    .expect("Transcoding range 2");

    assert!(out1.exists(), "File 1 must exist");
    assert!(out2.exists(), "File 2 must exist");

    let size1 = fs::metadata(&out1).unwrap().len();
    let size2 = fs::metadata(&out2).unwrap().len();
    println!("File sizes: out1 (9s) = {}, out2 (18s) = {}", size1, size2);

    // Range 2 is twice as long as range 1, so out2 must be clearly larger than out1
    assert!(
        size2 > (size1 * 15 / 10),
        "The range 2 file (18s) must be clearly larger than the range 1 file (9s)! size1={}, size2={}",
        size1,
        size2
    );
}

/// Exports `range` of the 440 Hz fixture as WAV with the given DSP tempo/rate and returns the
/// duration of the written file in milliseconds (WAV: 44-byte header, then PCM data).
fn export_wav_with_tempo(range: &TimeRange, tempo: f64, rate: f64, name: &str) -> f64 {
    let temp = TempTestDir::new(name);
    let input_wav = fixture_path("test_sine_440hz.wav");
    let output = temp.child("out.wav");
    let dsp = DspExportSettings {
        pitch_semitones: 0.0,
        tempo_ratio: tempo,
        rate_ratio: rate,
        engine: Some("RubberBand".into()),
        reverb_level: 0.0,
        eq_bands: None,
    };
    Transcoder::transcode_with_dsp(
        &input_wav,
        &output,
        ExportFormat::Wav,
        Some(&dsp),
        Some(range),
    )
    .expect("Transcoding should succeed");
    wav_duration_ms(&output)
}

/// Minimal WAV duration reader: parses the `fmt ` chunk for byte rate and the `data` chunk size.
fn wav_duration_ms(path: &Path) -> f64 {
    let bytes = fs::read(path).expect("Reading the exported WAV");
    let mut pos = 12;
    let mut byte_rate = 0u32;
    while pos + 8 <= bytes.len() {
        let id = &bytes[pos..pos + 4];
        let size = u32::from_le_bytes(bytes[pos + 4..pos + 8].try_into().unwrap()) as usize;
        if id == b"fmt " {
            byte_rate = u32::from_le_bytes(bytes[pos + 16..pos + 20].try_into().unwrap());
        } else if id == b"data" {
            let len = size.min(bytes.len() - pos - 8);
            return len as f64 * 1000.0 / byte_rate as f64;
        }
        pos += 8 + size + (size & 1);
    }
    panic!("No data chunk in the exported WAV");
}

#[test]
fn test_range_export_with_slow_tempo_keeps_whole_source_range() {
    let range = TimeRange::new(500, Some(1500)).unwrap();
    let ms = export_wav_with_tempo(&range, 0.5, 1.0, "range_slow");
    assert!(
        (1850.0..=2150.0).contains(&ms),
        "A 1000 ms range at tempo 0.5x must last ~2000 ms, got {ms:.0} ms"
    );
}

#[test]
fn test_range_export_with_fast_tempo_and_rate_scales_duration() {
    let range = TimeRange::new(500, Some(2500)).unwrap();
    let ms = export_wav_with_tempo(&range, 1.25, 1.2, "range_fast");
    let expected = 2000.0 / (1.25 * 1.2);
    assert!(
        (expected - 150.0..=expected + 150.0).contains(&ms),
        "A 2000 ms range at 1.25x tempo * 1.2x rate must last ~{expected:.0} ms, got {ms:.0} ms"
    );
}
