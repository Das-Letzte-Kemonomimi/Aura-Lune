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
        analyzer_version: "1.1.0-classic".to_string(),
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

#[test]
fn test_detect_notes_and_midi_export() {
    use audio_engine::analysis::{
        detect_notes_from_samples, export_transcription_to_midi, midi_pitch_to_name,
    };
    use domain::analysis::DetectedNote;

    // 1. Sprawdzenie konwersji numerów MIDI
    assert_eq!(midi_pitch_to_name(60), "C4");
    assert_eq!(midi_pitch_to_name(69), "A4");
    assert_eq!(midi_pitch_to_name(72), "C5");

    // 2. Syntetyczna próba dźwięku: 500ms 440 Hz (A4 = 69) oraz 500ms 523.25 Hz (C5 = 72)
    let sample_rate = 44100.0;
    let n = sample_rate as usize; // 1 sekunda
    let mut samples = Vec::with_capacity(n);
    for i in 0..n {
        let t = i as f64 / sample_rate;
        if i < n / 2 {
            samples.push((2.0 * PI * 440.0 * t).sin() as f32);
        } else {
            samples.push((2.0 * PI * 523.25 * t).sin() as f32);
        }
    }

    let detected = detect_notes_from_samples(&samples, sample_rate, Some("vocals"));
    assert!(
        !detected.is_empty(),
        "Powinny zostać wykryte syntetyczne nuty"
    );

    let has_a4 = detected.iter().any(|n| n.midi_pitch == 69);
    let has_c5 = detected.iter().any(|n| n.midi_pitch == 72);
    assert!(has_a4, "Powinna zostać wykryta nuta A4 (69)");
    assert!(has_c5, "Powinna zostać wykryta nuta C5 (72)");

    // 3. Sprawdzenie eksportu do MIDI
    let notes = vec![
        DetectedNote {
            onset_ms: 0,
            duration_ms: 500,
            midi_pitch: 69,
            pitch_name: "A4".to_string(),
            cents_offset: 0,
            velocity: 100,
            stem: Some("lead".to_string()),
        },
        DetectedNote {
            onset_ms: 500,
            duration_ms: 500,
            midi_pitch: 72,
            pitch_name: "C5".to_string(),
            cents_offset: 0,
            velocity: 95,
            stem: Some("lead".to_string()),
        },
    ];

    let midi_bytes = export_transcription_to_midi(&notes, 120.0);
    assert!(midi_bytes.starts_with(b"MThd"), "Nagłówek SMF MThd");
    assert!(midi_bytes.windows(4).any(|w| w == b"MTrk"), "Ścieżka MTrk");
    // Weryfikacja zdarzenia End of Track (FF 2F 00)
    assert!(midi_bytes.windows(3).any(|w| w == [0xFF, 0x2F, 0x00]));
}

#[test]
fn test_stem_separation_lifecycle_and_reconstruction() {
    use audio_engine::StemSeparator;
    use domain::analysis::StemMixerState;
    use std::path::Path;

    let fixture_path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("tests/fixtures/test_sine_440hz.wav");

    assert!(
        fixture_path.exists(),
        "Plik test_sine_440hz.wav musi istnieć"
    );

    // 1. Wykonaj separację stemów
    let separation = StemSeparator::separate_track(
        &fixture_path,
        999,
        "htdemucs_v4",
        Some(Box::new(|p, msg| {
            assert!((0.0..=1.0).contains(&p));
            assert!(!msg.is_empty());
        })),
    )
    .expect("Separacja stemów powinna zakończyć się sukcesem");

    assert_eq!(separation.track_id, 999);
    assert_eq!(separation.model_name, "htdemucs_v4");
    assert!(Path::new(&separation.vocals_path).exists());
    assert!(Path::new(&separation.drums_path).exists());
    assert!(Path::new(&separation.bass_path).exists());
    assert!(Path::new(&separation.other_path).exists());

    // 2. Drugie wywołanie powinno być natychmiastowym cache-hit
    let cached = StemSeparator::separate_track(&fixture_path, 999, "htdemucs_v4", None)
        .expect("Cache hit powinien działać");
    assert_eq!(cached.file_hash, separation.file_hash);

    // 3. Weryfikacja StemMixerState
    let mut state = StemMixerState {
        enabled: true,
        vocals_volume: 1.0,
        drums_volume: 0.8,
        bass_volume: 1.2,
        other_volume: 1.0,
        piano_volume: 1.0,
        guitar_volume: 1.0,
        vocals_mute: false,
        drums_mute: false,
        bass_mute: false,
        other_mute: false,
        piano_mute: false,
        guitar_mute: false,
        solo_stem: None,
        karaoke_mode: false,
    };

    assert!((state.get_effective_volume("vocals") - 1.0).abs() < 1e-5);
    assert!((state.get_effective_volume("drums") - 0.8).abs() < 1e-5);

    // Karaoke mode mutes vocals
    state.karaoke_mode = true;
    assert_eq!(state.get_effective_volume("vocals"), 0.0);
    assert!((state.get_effective_volume("drums") - 0.8).abs() < 1e-5);

    // Solo stem keeps only solo
    state.karaoke_mode = false;
    state.solo_stem = Some("bass".to_string());
    assert!((state.get_effective_volume("bass") - 1.2).abs() < 1e-5);
    assert_eq!(state.get_effective_volume("vocals"), 0.0);
    assert_eq!(state.get_effective_volume("drums"), 0.0);
}

#[test]
fn test_stem_mixer_pipeline_playback() {
    use audio_engine::{AudioEngine, StemSeparator};
    use domain::analysis::StemMixerState;
    use domain::PlaybackState;
    use std::path::Path;
    use std::thread;
    use std::time::Duration;

    let fixture_path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("tests/fixtures/test_sine_440hz.wav");

    let separation = StemSeparator::separate_track(&fixture_path, 999, "htdemucs_v4", None)
        .expect("Separacja powiodła się");

    let engine = AudioEngine::new().expect("Inicjalizacja AudioEngine");

    // 1. Ładowanie stemów do miksera
    engine
        .load_stems(&separation, StemMixerState::default(), None, None, false)
        .expect("Załadowanie stemów do audiomixera");

    // 2. Modyfikacja stanu miksera w locie
    let mixer_state = StemMixerState {
        enabled: true,
        vocals_volume: 0.5,
        karaoke_mode: true,
        ..Default::default()
    };
    engine
        .set_stem_mixer_state(mixer_state)
        .expect("Aktualizacja miksera");

    let current = engine.get_stem_mixer_state();
    assert!(current.karaoke_mode);
    assert_eq!(current.get_effective_volume("vocals"), 0.0);

    // 3. Odtwarzanie stemów
    engine.play().expect("Odtwarzanie stemów");
    thread::sleep(Duration::from_millis(100));

    // 4. Pauza
    engine.pause().expect("Pauza stemów");
    assert_eq!(engine.state(), PlaybackState::Paused);

    // 5. Powrót do standardowego pliku pojedynczego
    let uri = format!("file://{}", fixture_path.display());
    engine
        .load_uri(&uri)
        .expect("Załadowanie standardowego URI");
    assert_eq!(engine.state(), PlaybackState::Stopped);
}

#[test]
fn test_stem_project_cascaded_separation_and_reconstruction() {
    use audio_engine::StemSeparator;
    use domain::StemQualityTier;
    use std::path::Path;

    let fixture_path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("tests/fixtures/test_sine_440hz.wav");

    let requested_packs = vec![
        "pack_drum_pieces".to_string(),
        "pack_vocal_harmonies".to_string(),
        "pack_extended_6stem".to_string(),
        "pack_orchestral".to_string(),
    ];

    let channels = StemSeparator::separate_stem_project(
        &fixture_path,
        777,
        "hash_fixture_sine",
        &requested_packs,
        None,
    )
    .expect("Kaskadowa separacja powiodła się");

    // Powinno powstać co najmniej 14 szczegółowych stemów
    assert!(
        channels.len() >= 14,
        "Oczekiwano co najmniej 14 kanałów, otrzymano {}",
        channels.len()
    );

    // Sprawdzenie domyślnych wartości faderów (75% głośności per specyfikacja użytkownika)
    for ch in &channels {
        assert_eq!(
            ch.volume, 0.75,
            "Domyślna głośność kanału {} powinna wynosić 75% (0.75)",
            ch.id
        );
        assert_eq!(ch.pan, 0.0);
        assert!(!ch.mute);
        assert!(!ch.solo);
        assert!(
            Path::new(&ch.file_path).exists(),
            "Plik stemu {} nie istnieje",
            ch.file_path
        );
    }

    // Weryfikacja obecności kluczowych kanałów
    assert!(channels.iter().any(|c| c.id == "lead_vocal"));
    assert!(channels.iter().any(|c| c.id == "backing_vocals"));
    assert!(channels.iter().any(|c| c.id == "kick"));
    assert!(channels.iter().any(|c| c.id == "snare"));
    assert!(channels.iter().any(|c| c.id == "hihat"));
    assert!(channels.iter().any(|c| c.id == "cymbals"));
    assert!(channels.iter().any(|c| c.id == "toms"));
    assert!(channels.iter().any(|c| c.id == "percussion"));
    assert!(channels.iter().any(|c| c.id == "bass"));
    assert!(channels.iter().any(|c| c.id == "acoustic_guitar"));
    assert!(channels.iter().any(|c| c.id == "lead_guitar"));
    assert!(channels.iter().any(|c| c.id == "rhythm_guitar"));
    assert!(channels.iter().any(|c| c.id == "piano"));
    assert!(channels.iter().any(|c| c.id == "synth"));
    assert!(channels.iter().any(|c| c.id == "strings"));
    assert!(channels.iter().any(|c| c.id == "brass"));
    assert!(channels.iter().any(|c| c.id == "woodwinds"));
    assert!(channels.iter().any(|c| c.id == "other"));

    // Jakość
    let lead_voc = channels.iter().find(|c| c.id == "lead_vocal").unwrap();
    assert_eq!(lead_voc.quality_tier, StemQualityTier::HighQuality);
}

#[test]
fn test_stem_project_multitrack_pipeline_playback() {
    use audio_engine::{AudioEngine, StemSeparator};
    use domain::PlaybackState;
    use std::path::Path;
    use std::thread;
    use std::time::Duration;

    let fixture_path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("tests/fixtures/test_sine_440hz.wav");

    let requested_packs = vec![
        "pack_drum_pieces".to_string(),
        "pack_vocal_harmonies".to_string(),
    ];
    let channels = StemSeparator::separate_stem_project(
        &fixture_path,
        888,
        "hash_fixture_playback",
        &requested_packs,
        None,
    )
    .expect("Separacja dla playbacku");

    let engine = AudioEngine::new().expect("Inicjalizacja AudioEngine");

    // 1. Ładowanie multitracku projektu stemów
    engine
        .load_stem_project_channels(
            888,
            &channels,
            1.0,
            Some(format!("file://{}", fixture_path.display())),
            None,
            false,
        )
        .expect("Załadowanie multitracku stemów do potoku");

    assert!(engine.is_stems_active());
    assert_eq!(engine.active_stem_project_id(), Some(888));
    assert!(engine.original_track_uri().is_some());

    // Test przywracania oryginalnego utworu
    engine
        .restore_original_track()
        .expect("Przywrócenie oryginalnego utworu");
    assert!(!engine.is_stems_active());
    assert_eq!(engine.active_stem_project_id(), None);

    // Ponowne załadowanie dla testu miksu
    engine
        .load_stem_project_channels(
            888,
            &channels,
            1.0,
            Some(format!("file://{}", fixture_path.display())),
            None,
            false,
        )
        .expect("Załadowanie multitracku stemów do potoku");

    // 2. Modyfikacja miksu (np. Solo na lead_vocal, Mute na kick)
    let mut modified_channels = channels.clone();
    for ch in &mut modified_channels {
        if ch.id == "lead_vocal" {
            ch.solo = true;
            ch.volume = 0.85;
        }
        if ch.id == "kick" {
            ch.mute = true;
        }
    }

    engine
        .apply_stem_project_mix(&modified_channels, 0.95)
        .expect("Aplikacja miksu w czasie rzeczywistym");

    // 3. Playback
    engine.play().expect("Odtwarzanie multitracku");
    thread::sleep(Duration::from_millis(80));

    // 4. Pauza
    engine.pause().expect("Pauza multitracku");
    assert_eq!(engine.state(), PlaybackState::Paused);
}

#[test]
fn test_model_packs_catalog_integrity() {
    use audio_engine::{get_model_packs_catalog, list_available_model_packs};

    let packs = get_model_packs_catalog();
    assert_eq!(packs.len(), 6);

    let dsp_pack = packs.iter().find(|p| p.id == "pack_dsp_cascade").unwrap();
    assert!(dsp_pack.is_installed);
    assert_eq!(dsp_pack.total_size_bytes, 0);
    assert!(dsp_pack.unlocked_stems.len() >= 15);

    let list = list_available_model_packs();
    assert_eq!(list.len(), 6);
    let dsp_available = list.iter().find(|p| p.id == "pack_dsp_cascade").unwrap();
    assert!(dsp_available.is_installed);
}

#[test]
fn test_extract_track_waveform_peaks() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let fixture_path = manifest_dir
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("tests/fixtures/Skrzydła Białe.flac");

    assert!(fixture_path.exists(), "Plik fixture musi istnieć");

    let count = 160;
    let peaks = audio_engine::extract_track_waveform_peaks(fixture_path.to_str().unwrap(), count)
        .expect("Ekstrakcja szczytów fali powinna się powieść");

    assert_eq!(
        peaks.len(),
        count,
        "Liczba punktów szczytowych powinna wynosić 160"
    );

    // Wszystkie punkty powinny być w przedziale [0.05, 1.0]
    for &p in &peaks {
        assert!(
            (0.05..=1.0).contains(&p),
            "Punkt fali {} poza zakresem [0.05, 1.0]",
            p
        );
    }

    // Najwyższy punkt powinien osiągać 1.0 (znormalizowany)
    let max_peak = peaks.iter().cloned().fold(0.0f32, f32::max);
    assert!(
        (max_peak - 1.0).abs() < 1e-3,
        "Maksymalny punkt fali powinien wynosić 1.0"
    );

    // Powinna istnieć zmienność dynamiczna (nie linia prosta)
    let min_peak = peaks.iter().cloned().fold(1.0f32, f32::min);
    assert!(
        max_peak > min_peak + 0.1,
        "Wykres fali powinien odzwierciedlać dynamikę utworu"
    );
}

/// Trójdźwięk z kilkoma alikwotami (basowa pryma o oktawę niżej), `cents` odstrojenia.
fn synth_triad(
    root_midi: f64,
    intervals: [f64; 3],
    seconds: f64,
    cents: f64,
    sample_rate: f64,
) -> Vec<f32> {
    let n = (seconds * sample_rate) as usize;
    let mut out = vec![0.0f32; n];
    let freq = |midi: f64| 440.0 * 2.0f64.powf((midi - 69.0 + cents / 100.0) / 12.0);
    let mut notes: Vec<f64> = intervals.iter().map(|i| root_midi + i).collect();
    notes.push(root_midi - 12.0);
    for midi in notes {
        let f = freq(midi);
        for (h, amp) in [(1.0, 1.0), (2.0, 0.5), (3.0, 0.33), (4.0, 0.25)] {
            for (i, s) in out.iter_mut().enumerate() {
                let t = i as f64 / sample_rate;
                *s += (amp * 0.15 * (2.0 * PI * f * h * t).sin()) as f32;
            }
        }
    }
    out
}

/// Siatka 4/4 co `beat_ms` od zera.
fn fixed_grid(beats: usize, beat_ms: u64) -> Vec<domain::analysis::BeatPoint> {
    (0..beats)
        .map(|i| domain::analysis::BeatPoint {
            time_ms: i as u64 * beat_ms,
            beat_number: (i % 4) as u32 + 1,
            is_downbeat: i % 4 == 0,
        })
        .collect()
}

const MAJOR: [f64; 3] = [0.0, 4.0, 7.0];
const MINOR: [f64; 3] = [0.0, 3.0, 7.0];

fn progression_audio(cents: f64, sample_rate: f64) -> Vec<f32> {
    // C – G – Am – F, po 2 takty (4 s przy 120 BPM) na akord.
    let mut audio = Vec::new();
    for (root, intervals) in [(60.0, MAJOR), (55.0, MAJOR), (57.0, MINOR), (53.0, MAJOR)] {
        audio.extend(synth_triad(root, intervals, 4.0, cents, sample_rate));
    }
    audio
}

#[test]
fn test_chord_progression_c_g_am_f_detected_per_bar() {
    use audio_engine::analysis::detect_chords_with_grid;
    let sample_rate = 22050.0;
    let audio = progression_audio(0.0, sample_rate);
    let grid = fixed_grid(32, 500);
    let chords = detect_chords_with_grid(&audio, sample_rate, &grid, Some(0), Some(false));

    for seg in &chords {
        assert!(
            seg.end_ms - seg.start_ms <= 2000,
            "Segment {seg:?} przekracza jeden takt"
        );
    }
    let expected = ["C", "C", "G", "G", "Am", "Am", "F", "F"];
    let mut correct = 0;
    for (bar0, want) in expected.iter().enumerate() {
        let bar = bar0 as u32 + 1;
        let in_bar: Vec<_> = chords.iter().filter(|c| c.bar == bar).collect();
        assert!(!in_bar.is_empty(), "Brak segmentu dla taktu {bar}");
        let best = in_bar.iter().max_by_key(|c| c.end_ms - c.start_ms).unwrap();
        if best.chord == *want {
            correct += 1;
        }
    }
    assert!(
        correct >= 7,
        "Poprawnie rozpoznano {correct}/8 taktów: {chords:?}"
    );
}

#[test]
fn test_chord_detection_tolerates_detuning() {
    use audio_engine::analysis::detect_chords_with_grid;
    let sample_rate = 22050.0;
    let audio = synth_triad(60.0, MAJOR, 8.0, 30.0, sample_rate);
    let grid = fixed_grid(16, 500);
    let chords = detect_chords_with_grid(&audio, sample_rate, &grid, None, None);
    assert!(!chords.is_empty());
    assert!(
        chords.iter().all(|c| c.chord == "C"),
        "Odstrojone +30 centów C-dur powinno nadal być C: {chords:?}"
    );
}

#[test]
fn test_last_chord_segment_reaches_audio_end() {
    use audio_engine::analysis::detect_chords_with_grid;
    let sample_rate = 22050.0;
    // 7,3 s – ostatnie uderzenie siatki zaczyna się 7,0 s, a audio kończy po 300 ms.
    let audio = synth_triad(60.0, MAJOR, 7.3, 0.0, sample_rate);
    let grid = fixed_grid(15, 500);
    let chords = detect_chords_with_grid(&audio, sample_rate, &grid, None, None);
    let last = chords.last().unwrap();
    assert_eq!(last.end_ms, 7300);
}

#[test]
fn test_chord_segments_are_contiguous_and_numbered_per_bar() {
    use audio_engine::analysis::detect_chords_with_grid;
    let sample_rate = 22050.0;
    let audio = progression_audio(0.0, sample_rate);
    let grid = fixed_grid(32, 500);
    let chords = detect_chords_with_grid(&audio, sample_rate, &grid, None, None);
    for pair in chords.windows(2) {
        assert_eq!(pair[0].end_ms, pair[1].start_ms);
        assert!(pair[1].bar == pair[0].bar || pair[1].bar == pair[0].bar + 1);
    }
    assert_eq!(chords.last().unwrap().bar, 8);
}

#[test]
fn test_viterbi_switches_within_two_beats_of_clear_evidence() {
    use audio_engine::analysis::{
        chord_emissions, generate_chord_templates, viterbi_smooth_chords,
    };
    let defs = generate_chord_templates();
    let index_of = |s: &str| defs.iter().position(|d| d.symbol == s).unwrap();
    let (c, g) = (index_of("C"), index_of("G"));

    let emissions: Vec<Vec<f64>> = (0..16)
        .map(|beat| {
            let target = if beat < 8 { c } else { g };
            chord_emissions(&defs[target].template, false, &defs).0
        })
        .collect();
    let path = viterbi_smooth_chords(&emissions, &defs, None, None);

    assert!(path[..8].iter().all(|&s| s == c));
    let first_g = path.iter().position(|&s| s == g).unwrap();
    assert!(
        (8 - 2..=8 + 2).contains(&first_g),
        "Zmiana akordu na uderzeniu {first_g}, oczekiwano w pobliżu 8"
    );
    assert!(path[first_g..].iter().all(|&s| s == g));
}

#[test]
fn test_silence_is_no_chord() {
    use audio_engine::analysis::detect_chords_with_grid;
    let sample_rate = 22050.0;
    let mut audio = synth_triad(60.0, MAJOR, 4.0, 0.0, sample_rate);
    audio.extend(vec![0.0f32; (4.0 * sample_rate) as usize]);
    let grid = fixed_grid(16, 500);
    let chords = detect_chords_with_grid(&audio, sample_rate, &grid, None, None);
    let tail = chords.iter().rev().find(|c| c.start_ms >= 5000).unwrap();
    assert_eq!(tail.chord, "N");
}

#[test]
fn test_parse_chord_symbol_roundtrips_generated_templates() {
    use audio_engine::analysis::{generate_chord_templates, parse_chord_symbol};
    for def in generate_chord_templates()
        .iter()
        .filter(|d| d.quality != "N")
    {
        let (root, quality) = parse_chord_symbol(&def.symbol);
        assert_eq!(
            root, CHROMATIC_NOTES_FOR_TEST[def.root_idx],
            "{}",
            def.symbol
        );
        assert_eq!(quality, def.quality, "{}", def.symbol);
    }
    assert_eq!(parse_chord_symbol("Dm7/F"), ("D".to_string(), "min7"));
    assert_eq!(parse_chord_symbol("N"), ("N".to_string(), "N"));
}

const CHROMATIC_NOTES_FOR_TEST: [&str; 12] = [
    "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];

#[test]
fn test_beat_grid_follows_click_track_without_drift() {
    use audio_engine::analysis::extract_beat_grid;
    let sample_rate = 22050.0;
    let seconds = 40.0;
    let n = (sample_rate * seconds) as usize;
    let mut samples = vec![0.0f32; n];
    // 119,5 BPM (okres 502,09 ms), a siatka dostaje zaokrąglone 120 – korekta fazy musi dryf wyłapać.
    let period = 60.0 / 119.5;
    let mut t = 0.123;
    while t < seconds - 0.1 {
        let start = (t * sample_rate) as usize;
        for k in 0..200 {
            samples[start + k] = 0.8 * (-(k as f32) / 40.0).exp();
        }
        t += period;
    }
    let grid = extract_beat_grid(&samples, sample_rate, 120.0);
    assert!(grid.len() > 70);
    let last = grid.last().unwrap();
    let click_idx = ((last.time_ms as f64 / 1000.0 - 0.123) / period).round();
    let click_ms = (0.123 + click_idx * period) * 1000.0;
    assert!(
        (last.time_ms as f64 - click_ms).abs() < 40.0,
        "Ostatni beat siatki {} ms dryfuje względem klika {} ms",
        last.time_ms,
        click_ms
    );
    assert!(grid[0].is_downbeat || grid[..4].iter().any(|b| b.is_downbeat));
}
