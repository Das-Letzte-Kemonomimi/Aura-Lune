use audio_engine::{AudioEngine, DeviceManager, Transcoder};
use domain::transcode::ExportFormat;
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
