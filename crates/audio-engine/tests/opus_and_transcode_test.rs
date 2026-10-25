use audio_engine::{AudioEngine, DeviceManager, Transcoder};
use domain::transcode::{DspExportSettings, ExportFormat, TimeRange};
use std::fs;
use std::path::PathBuf;
use std::thread::sleep;
use std::time::Duration;

#[test]
fn test_opus_playback_and_pitch_shift() {
    let fixture_opus = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("tests/fixtures/test_sine_440hz.opus");

    assert!(
        fixture_opus.exists(),
        "Plik testowy Opus powinien istnieć: {:?}",
        fixture_opus
    );

    let engine = AudioEngine::new().expect("AudioEngine powinien się zainicjalizować");
    let uri = format!("file://{}", fixture_opus.canonicalize().unwrap().display());

    engine
        .load_uri(&uri)
        .expect("Ładowanie pliku Opus powinno się powieść");
    engine
        .play()
        .expect("Odtwarzanie pliku Opus powinno się powieść");
    sleep(Duration::from_millis(150));

    // Dynamiczny pitch shift na pliku Opus
    engine
        .set_pitch_semitones(5.0)
        .expect("Pitch shift na Opus powinien się powieść");
    assert_eq!(engine.dsp_params().pitch_semitones, 5.0);

    engine.stop().expect("Zatrzymanie powinno się powieść");
}

#[test]
fn test_transcoding_preserves_source_file_and_creates_valid_target() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let root = manifest_dir.parent().unwrap().parent().unwrap();

    let input_wav = root.join("tests/fixtures/test_sine_440hz.wav");
    let output_transcoded_opus = root.join("tests/fixtures/test_converted_output.opus");
    let output_transcoded_flac = root.join("tests/fixtures/test_converted_output.flac");

    // Upewniamy się, że pliki wyjściowe nie istnieją przed testem
    let _ = fs::remove_file(&output_transcoded_opus);
    let _ = fs::remove_file(&output_transcoded_flac);

    let input_size_before = fs::metadata(&input_wav)
        .expect("Plik źródłowy WAV musi istnieć")
        .len();

    // 1. Konwersja WAV -> Opus (192 kbps)
    Transcoder::transcode(
        &input_wav,
        &output_transcoded_opus,
        ExportFormat::Opus { bitrate_kbps: 192 },
    )
    .expect("Transkodowanie WAV -> Opus powinno się powieść");

    // 2. Konwersja WAV -> FLAC
    Transcoder::transcode(
        &input_wav,
        &output_transcoded_flac,
        ExportFormat::Flac {
            compression_level: 5,
        },
    )
    .expect("Transkodowanie WAV -> FLAC powinno się powieść");

    // 3. WERYFIKACJA ZASADY BEZPIECZEŃSTWA:
    // Plik źródłowy nadal istnieje i jego rozmiar nie uległ zmianie
    assert!(input_wav.exists(), "Plik źródłowy WAV MUSI istnieć!");
    let input_size_after = fs::metadata(&input_wav).unwrap().len();
    assert_eq!(
        input_size_before, input_size_after,
        "Plik źródłowy nie może być modyfikowany!"
    );

    // 4. Weryfikacja plików wynikowych
    assert!(
        output_transcoded_opus.exists(),
        "Plik Opus musi zostać utworzony"
    );
    assert!(output_transcoded_opus.metadata().unwrap().len() > 1000);

    assert!(
        output_transcoded_flac.exists(),
        "Plik FLAC musi zostać utworzony"
    );
    assert!(output_transcoded_flac.metadata().unwrap().len() > 1000);

    // 5. Weryfikacja, że wygenerowany plik Opus można odtworzyć przez AudioEngine
    let engine = AudioEngine::new().unwrap();
    let uri = format!(
        "file://{}",
        output_transcoded_opus.canonicalize().unwrap().display()
    );
    engine
        .load_uri(&uri)
        .expect("Załadowanie wygenerowanego Opus powinno się powieść");
    engine
        .play()
        .expect("Odtworzenie wygenerowanego Opus powinno się powieść");
    sleep(Duration::from_millis(150));
    engine.stop().unwrap();

    // Czyszczenie plików tymczasowych testu
    let _ = fs::remove_file(&output_transcoded_opus);
    let _ = fs::remove_file(&output_transcoded_flac);
}

#[test]
fn test_device_manager_discovers_cards_and_codecs() {
    let cards =
        DeviceManager::list_cards().expect("list_cards powinno się powieść na Linuksie z PipeWire");
    // W systemie CachyOS mamy podłączone karty dźwiękowe (Scarlett Solo, Alder Lake, Bluetooth JBL GO)
    assert!(
        !cards.is_empty(),
        "Menedżer urządzeń powinien wykryć co najmniej jedną kartę"
    );

    for card in &cards {
        println!("Wykryta karta: {} (BT: {})", card.name, card.is_bluetooth);
        if card.supports_pro_audio() {
            println!("  -> Karta wspiera tryb Pro Audio!");
        }
        if card.is_bluetooth {
            let codecs = card.available_bluetooth_codecs();
            println!("  -> Dostępne kodeki Bluetooth: {:?}", codecs);
        }
    }
}

#[test]
fn test_transcoding_with_dsp_nightcore_bounce() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let root = manifest_dir.parent().unwrap().parent().unwrap();

    let input_wav = root.join("tests/fixtures/test_sine_440hz.wav");
    let output_dsp_opus = root.join("tests/fixtures/test_nightcore_output.opus");

    let _ = fs::remove_file(&output_dsp_opus);

    let dsp_settings = DspExportSettings {
        pitch_semitones: 3.0,
        tempo_ratio: 1.25,
        rate_ratio: 1.0,
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
    .expect("Transkodowanie z DSP powinno się powieść");

    assert!(
        output_dsp_opus.exists(),
        "Plik wyjściowy Opus z DSP musi istnieć!"
    );
    assert!(
        fs::metadata(&output_dsp_opus).unwrap().len() > 100,
        "Wygenerowany plik z DSP nie może być pusty"
    );

    // Odtworzenie wygenerowanego pliku z DSP
    let engine = AudioEngine::new().unwrap();
    let uri = format!(
        "file://{}",
        output_dsp_opus.canonicalize().unwrap().display()
    );
    engine.load_uri(&uri).unwrap();
    engine.play().unwrap();
    sleep(Duration::from_millis(150));
    engine.stop().unwrap();

    let _ = fs::remove_file(&output_dsp_opus);
}

#[test]
fn test_transcode_range_marker_a_to_b() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let root = manifest_dir.parent().unwrap().parent().unwrap();

    let input_wav = root.join("tests/fixtures/test_sine_440hz.wav");
    let output_range_wav = root.join("tests/fixtures/test_range_marker_ab.wav");
    let _ = fs::remove_file(&output_range_wav);

    let range = TimeRange::new(500, Some(1500)).expect("Poprawny zakres A-B");

    Transcoder::transcode_range(&input_wav, &output_range_wav, ExportFormat::Wav, &range)
        .expect("Transkodowanie wycinka A-B powinno się powieść");

    assert!(output_range_wav.exists(), "Plik wycinka A-B musi istnieć");
    let size = fs::metadata(&output_range_wav).unwrap().len();
    assert!(size > 1000, "Plik wycinka musi zawierać dane audio");

    // Weryfikacja odtwarzania wycinka przez AudioEngine
    let engine = AudioEngine::new().unwrap();
    let uri = format!(
        "file://{}",
        output_range_wav.canonicalize().unwrap().display()
    );
    engine
        .load_uri(&uri)
        .expect("Załadowanie wycinka do odtwarzacza");
    engine.play().expect("Odtworzenie wycinka");
    sleep(Duration::from_millis(100));
    engine.stop().unwrap();

    let _ = fs::remove_file(&output_range_wav);
}

#[test]
fn test_transcode_range_with_dsp_nightcore() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let root = manifest_dir.parent().unwrap().parent().unwrap();

    let input_wav = root.join("tests/fixtures/test_sine_440hz.wav");
    let output_range_opus = root.join("tests/fixtures/test_range_dsp_ab.opus");
    let _ = fs::remove_file(&output_range_opus);

    let dsp_settings = DspExportSettings {
        pitch_semitones: 4.0,
        tempo_ratio: 1.3,
        rate_ratio: 1.0,
        reverb_level: 0.1,
        eq_bands: None,
    };
    let range = TimeRange::new(200, Some(1200)).expect("Poprawny zakres A-B");

    Transcoder::transcode_with_dsp(
        &input_wav,
        &output_range_opus,
        ExportFormat::Opus { bitrate_kbps: 192 },
        Some(&dsp_settings),
        Some(&range),
    )
    .expect("Transkodowanie wycinka z DSP powinno się powieść");

    assert!(
        output_range_opus.exists(),
        "Plik wycinka z DSP musi istnieć"
    );
    let size = fs::metadata(&output_range_opus).unwrap().len();
    assert!(size > 100, "Plik wycinka z DSP nie może być pusty");

    let engine = AudioEngine::new().unwrap();
    let uri = format!(
        "file://{}",
        output_range_opus.canonicalize().unwrap().display()
    );
    engine.load_uri(&uri).expect("Załadowanie wycinka z DSP");
    engine.play().expect("Odtworzenie wycinka z DSP");
    sleep(Duration::from_millis(100));
    engine.stop().unwrap();

    let _ = fs::remove_file(&output_range_opus);
}

#[test]
fn test_transcode_range_invalid_order_rejected() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let root = manifest_dir.parent().unwrap().parent().unwrap();

    let input_wav = root.join("tests/fixtures/test_sine_440hz.wav");
    let output_wav = root.join("tests/fixtures/test_invalid_range.wav");

    let invalid_range = TimeRange {
        start_ms: 1500,
        end_ms: Some(500),
    };

    let result =
        Transcoder::transcode_range(&input_wav, &output_wav, ExportFormat::Wav, &invalid_range);

    assert!(
        result.is_err(),
        "Transkoder musi odrzucić nieprawidłowy zakres czasowy"
    );
}

#[test]
fn test_transcode_range_with_file_uri_prefix() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let root = manifest_dir.parent().unwrap().parent().unwrap();

    let input_wav = root.join("tests/fixtures/test_sine_440hz.wav");
    let output_wav = root.join("tests/fixtures/test_uri_range.wav");
    let _ = fs::remove_file(&output_wav);

    let uri_string = format!("file://{}", input_wav.canonicalize().unwrap().display());
    let range = TimeRange::new(300, Some(900)).unwrap();

    Transcoder::transcode_range(uri_string, &output_wav, ExportFormat::Wav, &range)
        .expect("Transkodowanie ze ścieżki file:// powinno się powieść");

    assert!(output_wav.exists());
    let _ = fs::remove_file(&output_wav);
}
