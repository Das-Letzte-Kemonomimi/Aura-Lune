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
