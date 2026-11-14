use audio_engine::analysis::{
    analyze_track_key_bpm, detect_bpm_from_samples, detect_key_from_samples, parse_musical_key,
    CHROMATIC_NOTES,
};
use std::f64::consts::PI;
use std::path::PathBuf;

#[test]
fn test_parse_musical_key() {
    // Camelot Minor
    assert_eq!(parse_musical_key("8A"), Some((9, true))); // Am
    assert_eq!(parse_musical_key("11A"), Some((6, true))); // F#m

    // Camelot Major
    assert_eq!(parse_musical_key("8B"), Some((0, false))); // C Maj
    assert_eq!(parse_musical_key("11B"), Some((9, false))); // A Maj

    // Standard notation
    assert_eq!(parse_musical_key("Am"), Some((9, true)));
    assert_eq!(parse_musical_key("A min"), Some((9, true)));
    assert_eq!(parse_musical_key("C"), Some((0, false)));
    assert_eq!(parse_musical_key("C Maj"), Some((0, false)));
    assert_eq!(parse_musical_key("F#m"), Some((6, true)));
    assert_eq!(parse_musical_key("G#"), Some((8, false)));
}

#[test]
fn test_detect_key_from_sine_440hz() {
    // Generuj 1 sekundę fali 440 Hz (dźwięk A, pitch class 9)
    let sample_rate = 22050.0;
    let n = 22050;
    let mut samples = Vec::with_capacity(n);
    for i in 0..n {
        let t = i as f64 / sample_rate;
        samples.push((2.0 * PI * 440.0 * t).sin() as f32);
    }

    let (key_idx, _) = detect_key_from_samples(&samples, sample_rate);
    assert_eq!(
        CHROMATIC_NOTES[key_idx], "A",
        "Dźwięk 440 Hz powinien zostać wykryty jako tonacja A"
    );
}

#[test]
fn test_detect_bpm_synthetic_clicks() {
    // Generuj impulsy perkusyjne co 0.5 sekundy (120 BPM)
    let sample_rate = 22050.0;
    let n = (sample_rate * 6.0) as usize; // 6 sekund
    let mut samples = vec![0.0f32; n];

    let interval = (sample_rate * 0.5) as usize; // 120 BPM
    for i in (0..n).step_by(interval) {
        // Dodaj krótki impuls (click)
        for k in 0..100.min(n - i) {
            samples[i + k] = 0.8;
        }
    }

    let bpm = detect_bpm_from_samples(&samples, sample_rate);
    assert!(
        (bpm - 120.0).abs() < 2.5,
        "Wykryte tempo {} powinno być bliskie 120 BPM",
        bpm
    );
}

#[test]
fn test_analyze_track_key_bpm_fixture() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let root = manifest_dir.parent().unwrap().parent().unwrap();
    let wav_path = root.join("tests/fixtures/test_sine_440hz.wav");

    if wav_path.exists() {
        let res = analyze_track_key_bpm(wav_path.to_str().unwrap());
        assert!(res.is_ok(), "Analiza pliku WAV powinna się udać: {:?}", res);
        let info = res.unwrap();
        assert!(info.bpm >= 40.0 && info.bpm <= 280.0);
        assert_eq!(info.base_key_index, 9, "440Hz to nuta A (indeks 9)");
    }
}

#[test]
fn test_omnia_sol_temperat() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let root = manifest_dir.parent().unwrap().parent().unwrap();
    let flac_path = root.join("tests/fixtures/08. Omnia Sol Temperat.flac");

    if flac_path.exists() {
        let res = analyze_track_key_bpm(flac_path.to_str().unwrap()).unwrap();
        println!("Wynik Omnia Sol Temperat: {:?}", res);
        assert_eq!(res.key_name, "A m", "Omnia Sol Temperat jest w Am");
        assert_eq!(res.camelot, "8A", "Am to kod Camelot 8A");
        assert!(
            res.bpm >= 135.0 && res.bpm <= 150.0,
            "BPM około 143-144: got {}",
            res.bpm
        );
    }
}

#[test]
fn test_skrzydla_biale() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let root = manifest_dir.parent().unwrap().parent().unwrap();
    let flac_path = root.join("tests/fixtures/Skrzydła Białe.flac");

    if flac_path.exists() {
        let res = analyze_track_key_bpm(flac_path.to_str().unwrap()).unwrap();
        println!("Wynik Skrzydła Białe: {:?}", res);
        assert!(!res.key_name.is_empty());
        assert!(!res.camelot.is_empty());
        assert!(res.bpm > 0.0);
    }
}

#[test]
fn test_analyze_track_replaygain_flac() {
    use audio_engine::analysis::analyze_track_replaygain;
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let root = manifest_dir.parent().unwrap().parent().unwrap();
    let flac_path = root.join("tests/fixtures/Skrzydła Białe.flac");

    if flac_path.exists() {
        let res = analyze_track_replaygain(flac_path.to_str().unwrap()).unwrap();
        println!("Wynik ReplayGain Skrzydła Białe: {:?}", res);
        // Spodziewany track_gain około -5.2 dB, peak ~0.98, ref 89.0
        assert!(
            res.track_gain_db < 0.0,
            "Utwór głośny powinien mieć ujemny gain"
        );
        assert!(
            res.track_peak > 0.5 && res.track_peak <= 1.2,
            "Prawidłowy peak"
        );
        assert_eq!(
            res.reference_level_db, 89.0,
            "Domyślny reference level EBU R128 to 89 dB SPL"
        );
    }
}

#[test]
fn test_chord_templates_generation() {
    use audio_engine::analysis::generate_chord_templates;
    let defs = generate_chord_templates();
    assert_eq!(defs.len(), 12 * 9 + 1, "Powinno być 109 definicji akordów");

    let c_maj = defs.iter().find(|d| d.symbol == "C").unwrap();
    assert_eq!(c_maj.root_idx, 0);
    assert_eq!(c_maj.quality, "maj");
    assert!(c_maj.template[0] > 0.0); // C
    assert!(c_maj.template[4] > 0.0); // E
    assert!(c_maj.template[7] > 0.0); // G

    let a_min = defs.iter().find(|d| d.symbol == "Am").unwrap();
    assert_eq!(a_min.root_idx, 9);
    assert_eq!(a_min.quality, "min");
    assert!(a_min.template[9] > 0.0); // A
    assert!(a_min.template[0] > 0.0); // C
    assert!(a_min.template[4] > 0.0); // E
}

#[test]
fn test_extract_chroma_synthetic_c_major() {
    use audio_engine::analysis::extract_chroma_frame;
    // Syntetyczny akord C-dur: C4 (261.63 Hz), E4 (329.63 Hz), G4 (392.00 Hz)
    let sample_rate = 22050.0;
    let n = 2048;
    let mut samples = Vec::with_capacity(n);
    for i in 0..n {
        let t = i as f64 / sample_rate;
        let s = (2.0 * PI * 261.63 * t).sin()
            + (2.0 * PI * 329.63 * t).sin()
            + (2.0 * PI * 392.00 * t).sin();
        samples.push(s as f32);
    }

    let chroma = extract_chroma_frame(&samples, sample_rate);
    // Sprawdź czy składowe C (0), E (4), G (7) dominują
    assert!(
        chroma[0] > 0.2,
        "Nuta C (indeks 0) powinna mieć wysoką energię: {}",
        chroma[0]
    );
    assert!(
        chroma[4] > 0.2,
        "Nuta E (indeks 4) powinna mieć wysoką energię: {}",
        chroma[4]
    );
    assert!(
        chroma[7] > 0.2,
        "Nuta G (indeks 7) powinna mieć wysoką energię: {}",
        chroma[7]
    );
}

#[test]
fn test_transpose_chord() {
    use audio_engine::analysis::transpose_chord;

    assert_eq!(transpose_chord("C", 2), "D");
    assert_eq!(transpose_chord("Am", 2), "Bm");
    assert_eq!(transpose_chord("F#7", 1), "G7");
    assert_eq!(transpose_chord("Bb", 2), "C");
    assert_eq!(transpose_chord("C/G", 2), "D/A");
    assert_eq!(transpose_chord("N", 4), "N");
    assert_eq!(transpose_chord("G", -2), "F");
}

#[test]
fn test_export_chords_formats() {
    use audio_engine::analysis::{export_chords_to_chordpro, export_chords_to_text};
    use domain::analysis::{BeatPoint, ChordSegment, TrackChordsData};

    let data = TrackChordsData {
        track_id: 1,
        file_hash: "testhash".to_string(),
        bpm: 120.0,
        key: "C Maj".to_string(),
        camelot: "8B".to_string(),
        beat_grid: vec![
            BeatPoint {
                time_ms: 0,
                beat_number: 1,
                is_downbeat: true,
            },
            BeatPoint {
                time_ms: 500,
                beat_number: 2,
                is_downbeat: false,
            },
            BeatPoint {
                time_ms: 1000,
                beat_number: 3,
                is_downbeat: false,
            },
            BeatPoint {
                time_ms: 1500,
                beat_number: 4,
                is_downbeat: false,
            },
            BeatPoint {
                time_ms: 2000,
                beat_number: 1,
                is_downbeat: true,
            },
            BeatPoint {
                time_ms: 2500,
                beat_number: 2,
                is_downbeat: false,
            },
            BeatPoint {
                time_ms: 3000,
                beat_number: 3,
                is_downbeat: false,
            },
            BeatPoint {
                time_ms: 3500,
                beat_number: 4,
                is_downbeat: false,
            },
        ],
        chords: vec![
            ChordSegment {
                start_ms: 0,
                end_ms: 2000,
                chord: "C".to_string(),
                root_note: "C".to_string(),
                quality: "maj".to_string(),
                bass_note: None,
                confidence: 0.95,
                beat: 1,
                bar: 1,
            },
            ChordSegment {
                start_ms: 2000,
                end_ms: 4000,
                chord: "Am".to_string(),
                root_note: "A".to_string(),
                quality: "min".to_string(),
                bass_note: None,
                confidence: 0.92,
                beat: 1,
                bar: 2,
            },
        ],
        analyzer_version: "1.0.8-classic".to_string(),
    };

    let chordpro = export_chords_to_chordpro(&data, "Test Song", "Test Artist");
    assert!(chordpro.contains("{title: Test Song}"));
    assert!(chordpro.contains("{key: C Maj}"));
    assert!(chordpro.contains("| [C]"));
    assert!(chordpro.contains("| [Am]"));

    let text = export_chords_to_text(&data);
    assert!(text.contains("Klucz: C Maj"));
    assert!(text.contains("| C"));
    assert!(text.contains("| Am"));
}
