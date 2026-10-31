use audio_engine::AudioEngine;
use std::path::PathBuf;
use std::thread::sleep;
use std::time::Duration;

#[test]
fn test_audio_engine_playback_and_dsp_modulation() {
    let fixture_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("tests/fixtures/test_sine_440hz.wav");

    assert!(
        fixture_path.exists(),
        "Plik testowy powinien istnieć: {:?}",
        fixture_path
    );

    let engine = AudioEngine::new().expect("Inicjalizacja AudioEngine powinna się powieść");
    let uri = format!("file://{}", fixture_path.canonicalize().unwrap().display());

    engine
        .load_uri(&uri)
        .expect("Ładowanie pliku powinno się powieść");

    // Start odtwarzania
    engine.play().expect("Play powinno się powieść");
    sleep(Duration::from_millis(150));

    // Dynamiczna modulacja parametrów DSP
    engine
        .set_pitch_semitones(4.0)
        .expect("Zmiana pitchu na +4 półtony powinna się powieść");
    assert_eq!(engine.dsp_params().pitch_semitones, 4.0);

    engine
        .set_tempo_ratio(1.25)
        .expect("Zmiana tempa na 1.25x powinna się powieść");
    assert_eq!(engine.dsp_params().tempo_ratio, 1.25);

    sleep(Duration::from_millis(150));

    // Weryfikacja przełączania silnika DSP w locie: SoundTouch <-> Rubber Band
    engine
        .set_dsp_engine(dsp_api::DspEngine::RubberBand)
        .expect("Przełączenie na Rubber Band powinno się powieść");
    assert_eq!(engine.dsp_params().engine, dsp_api::DspEngine::RubberBand);
    assert_eq!(engine.dsp_capabilities().name, "Rubber Band");

    sleep(Duration::from_millis(150));

    engine
        .set_dsp_engine(dsp_api::DspEngine::SoundTouch)
        .expect("Przełączenie na SoundTouch powinno się powieść");
    assert_eq!(engine.dsp_params().engine, dsp_api::DspEngine::SoundTouch);
    assert_eq!(engine.dsp_capabilities().name, "SoundTouch");

    sleep(Duration::from_millis(150));

    // Weryfikacja przełączenia na Bypass w locie podczas aktywnego odtwarzania
    engine
        .set_dsp_engine(dsp_api::DspEngine::Bypass)
        .expect("Przełączenie na Bypass w locie powinno się powieść");
    assert_eq!(engine.dsp_params().engine, dsp_api::DspEngine::Bypass);
    assert_eq!(engine.dsp_capabilities().name, "Brak DSP (Direct Bypass)");

    sleep(Duration::from_millis(150));

    // Weryfikacja powrotu do RubberBand z Bypass w locie
    engine
        .set_dsp_engine(dsp_api::DspEngine::RubberBand)
        .expect("Powrót do Rubber Band w locie powinien się powieść");
    assert_eq!(engine.dsp_params().engine, dsp_api::DspEngine::RubberBand);

    // Weryfikacja seek
    let seek_result = engine.seek(Duration::from_millis(200));
    assert!(seek_result.is_ok(), "Seek powinien się powieść");

    // Weryfikacja odpytywania magistrali
    let _events = engine.poll_events();

    // Wstrzymanie i zatrzymanie
    engine.pause().expect("Pauza powinna się powieść");
    engine.stop().expect("Stop powinien się powieść");
}

#[test]
fn test_dsp_tempo_position_synchronization() {
    let fixture_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("tests/fixtures/test_sine_440hz.wav");

    let engine = AudioEngine::new().expect("Inicjalizacja AudioEngine");
    let uri = format!("file://{}", fixture_path.canonicalize().unwrap().display());

    engine.load_uri(&uri).expect("Ładowanie pliku");

    // Aktywacja silnika DSP do testu synchronizacji tempa
    engine
        .set_dsp_engine(dsp_api::DspEngine::RubberBand)
        .expect("Aktywacja RubberBand");

    // Ustawienie tempa 0.50x (podwojenie czasu odsłuchu)
    engine
        .set_tempo_ratio(0.50)
        .expect("Ustawienie tempa 0.50x");

    engine.play().expect("Play");
    sleep(Duration::from_millis(300));

    let pos = engine.position();
    let dur = engine.duration();

    assert!(pos.is_some(), "Pozycja powinna być dostępna");
    assert!(dur.is_some(), "Czas trwania powinien być dostępny");

    let pos_ms = pos.unwrap().as_millis() as u64;
    let dur_ms = dur.unwrap().as_millis() as u64;

    // Przy tempie 0.50x po 300ms czasu rzeczywistego, pozycja w utworze źródłowym
    // powinna wynosić około 150ms (+- bufor), a nie wyprzedzać długości utworu.
    assert!(
        pos_ms <= dur_ms,
        "Pozycja {} ms nie może przekraczać długości utworu {} ms",
        pos_ms,
        dur_ms
    );
    // Skalowanie: pozycja w utworze nie może wyprzedzać czasu rzeczywistego przy zwolnionym tempie (0.50x)
    assert!(
        pos_ms <= 260,
        "Pozycja ({pos_ms}ms) przy tempie 0.50x powinna być proporcjonalnie mniejsza niż czas zegarowy (300ms)"
    );

    // Weryfikacja seek przy aktywnym spowolnieniu
    engine
        .seek(Duration::from_millis(500))
        .expect("Seek do 500ms");
    sleep(Duration::from_millis(50));
    let seek_pos = engine.position().expect("Pozycja po seek").as_millis() as u64;
    assert!(
        (480..=650).contains(&seek_pos),
        "Pozycja po seek do 500ms powinna wynosić ok. 500ms, a wynosi {}",
        seek_pos
    );

    // Weryfikacja zmiany tempa w locie (bez skoku pozycji)
    engine
        .set_tempo_ratio(1.50)
        .expect("Zmiana tempa w locie na 1.50x");
    let after_change_pos = engine
        .position()
        .expect("Pozycja po zmianie tempa")
        .as_millis() as u64;
    assert!(
        (after_change_pos as i64 - seek_pos as i64).abs() < 100,
        "Pozycja po zmianie tempa w locie nie może gwałtownie skoczyć: przed={}, po={}",
        seek_pos,
        after_change_pos
    );

    engine.stop().expect("Stop");
}

#[test]
fn test_audio_engine_seek_with_fade() {
    let fixture_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("tests/fixtures/test_sine_440hz.wav");

    let engine = AudioEngine::new().expect("Inicjalizacja AudioEngine");
    let uri = format!("file://{}", fixture_path.canonicalize().unwrap().display());
    engine.load_uri(&uri).expect("Ładowanie pliku");

    engine.set_volume(0.85).expect("Ustawienie głośności");
    assert!((engine.volume() - 0.85).abs() < 1e-4);

    engine.play().expect("Play");
    sleep(Duration::from_millis(100));

    // Weryfikacja seek z aktywnym płynnym wyciszeniem (fade: true)
    engine
        .seek_with_fade(Duration::from_millis(200), true)
        .expect("seek_with_fade (fade: true) powiodło się");
    // Po zakończeniu głośność użytkownika musi pozostać 0.85
    assert!((engine.volume() - 0.85).abs() < 1e-4);

    // Weryfikacja seek z wyłączonym fade (fade: false)
    engine
        .seek_with_fade(Duration::from_millis(400), false)
        .expect("seek_with_fade (fade: false) powiodło się");
    assert!((engine.volume() - 0.85).abs() < 1e-4);

    engine.stop().expect("Stop");
}

#[test]
fn test_dsp_bypass_preserves_custom_parameters_on_return() {
    let engine = AudioEngine::new().expect("Inicjalizacja AudioEngine");

    // 1. Ustawienie parametrów w silniku RubberBand
    engine
        .set_dsp_engine(dsp_api::DspEngine::RubberBand)
        .expect("Przełączenie na RubberBand");
    engine
        .set_pitch_semitones(3.5)
        .expect("Ustawienie pitch na +3.5");
    engine
        .set_tempo_ratio(1.20)
        .expect("Ustawienie tempo na 1.20x");
    engine
        .set_rate_ratio(1.05)
        .expect("Ustawienie rate na 1.05x");

    assert_eq!(engine.dsp_params().pitch_semitones, 3.5);
    assert_eq!(engine.dsp_params().tempo_ratio, 1.20);
    assert_eq!(engine.dsp_params().rate_ratio, 1.05);

    // 2. Przełączenie na wyjście bez DSP (Bypass / Direct)
    engine
        .set_dsp_engine(dsp_api::DspEngine::Bypass)
        .expect("Przełączenie na Bypass");
    assert_eq!(engine.dsp_params().engine, dsp_api::DspEngine::Bypass);

    // 3. Powrót do RubberBand - wartości muszą zostać nienaruszone
    engine
        .set_dsp_engine(dsp_api::DspEngine::RubberBand)
        .expect("Powrót do RubberBand");
    assert_eq!(engine.dsp_params().engine, dsp_api::DspEngine::RubberBand);
    assert_eq!(engine.dsp_params().pitch_semitones, 3.5);
    assert_eq!(engine.dsp_params().tempo_ratio, 1.20);
    assert_eq!(engine.dsp_params().rate_ratio, 1.05);

    // 4. Przełączenie na SoundTouch - wartości również muszą być zachowane
    engine
        .set_dsp_engine(dsp_api::DspEngine::SoundTouch)
        .expect("Przełączenie do SoundTouch");
    assert_eq!(engine.dsp_params().engine, dsp_api::DspEngine::SoundTouch);
    assert_eq!(engine.dsp_params().pitch_semitones, 3.5);
    assert_eq!(engine.dsp_params().tempo_ratio, 1.20);
    assert_eq!(engine.dsp_params().rate_ratio, 1.05);
}

#[test]
fn test_reverb_parameters_and_pipeline() {
    let engine = AudioEngine::new().expect("Inicjalizacja AudioEngine");

    // Domyślnie wyłączony
    let (enabled, room_size, damping, width, level) = engine.reverb_params();
    assert!(!enabled);
    assert_eq!(room_size, 0.5);
    assert_eq!(damping, 0.2);
    assert_eq!(width, 1.0);
    assert_eq!(level, 0.0);

    // Włączenie pogłosu (preset Slowed + Reverb)
    engine.set_reverb_params(true, 0.75, 0.35, 1.0, 0.40);
    let (enabled, room_size, damping, width, level) = engine.reverb_params();
    assert!(enabled);
    assert_eq!(room_size, 0.75);
    assert_eq!(damping, 0.35);
    assert_eq!(width, 1.0);
    assert_eq!(level, 0.40);
}

#[test]
fn test_play_and_pause_with_fade() {
    let fixture_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("tests/fixtures/test_sine_440hz.wav");

    let engine = AudioEngine::new().expect("Inicjalizacja AudioEngine");
    let uri = format!("file://{}", fixture_path.canonicalize().unwrap().display());
    engine.load_uri(&uri).unwrap();

    // Play z mikro-fade-in
    engine.play_with_fade(true).expect("Play z fade");
    sleep(Duration::from_millis(80));

    // Pause z mikro-fade-out
    engine.pause_with_fade(true).expect("Pause z fade");
    sleep(Duration::from_millis(50));

    // Ponowny play
    engine.play_with_fade(true).expect("Ponowny play z fade");
    sleep(Duration::from_millis(80));

    engine.stop().unwrap();
}

#[test]
fn test_replaygain_pipeline_elements() {
    use gstreamer::prelude::*;
    gstreamer::init().unwrap();
    let bin = gstreamer::Pipeline::new();
    let src = gstreamer::ElementFactory::make("audiotestsrc")
        .property("num-buffers", 5i32)
        .build()
        .unwrap();
    let conv = gstreamer::ElementFactory::make("audioconvert")
        .build()
        .unwrap();
    let rgv = gstreamer::ElementFactory::make("rgvolume").build().unwrap();
    let rgl = gstreamer::ElementFactory::make("rglimiter")
        .build()
        .unwrap();
    let sink = gstreamer::ElementFactory::make("fakesink").build().unwrap();
    bin.add_many([&src, &conv, &rgv, &rgl, &sink]).unwrap();
    gstreamer::Element::link_many([&src, &conv, &rgv, &rgl, &sink]).unwrap();
    bin.set_state(gstreamer::State::Playing).unwrap();
    std::thread::sleep(std::time::Duration::from_millis(50));
    bin.set_state(gstreamer::State::Null).unwrap();
}

#[test]
fn test_crossfeed_and_silence_trimming_pipeline_controls() {
    use domain::crossfeed::{CrossfeedConfig, CrossfeedPreset};
    use domain::silence::SilenceTrimmingConfig;

    let engine = AudioEngine::new().expect("Inicjalizacja AudioEngine");

    // Test domyślnych ustawień
    assert!(!engine.crossfeed_config().enabled);
    assert!(!engine.silence_trimming_config().enabled);

    // Test konfiguracji Crossfeedu (Chu Moy preset)
    let crossfeed_cfg = CrossfeedConfig::with_preset(CrossfeedPreset::ChuMoy);
    let mut enabled_crossfeed = crossfeed_cfg;
    enabled_crossfeed.enabled = true;
    engine
        .set_crossfeed(enabled_crossfeed)
        .expect("Ustawienie Crossfeed");
    let retrieved_cf = engine.crossfeed_config();
    assert!(retrieved_cf.enabled);
    assert_eq!(retrieved_cf.preset, CrossfeedPreset::ChuMoy);
    assert_eq!(retrieved_cf.fcut_hz, 700);
    assert_eq!(retrieved_cf.feed_tenth_db, 60);

    // Test konfiguracji Silence Trimming
    let silence_cfg = SilenceTrimmingConfig {
        enabled: true,
        threshold_db: -55.0,
    };
    engine
        .set_silence_trimming(silence_cfg)
        .expect("Ustawienie Silence Trimming");
    let retrieved_silence = engine.silence_trimming_config();
    assert!(retrieved_silence.enabled);
    assert_eq!(retrieved_silence.threshold_db, -55.0);

    // Wyłączenie
    enabled_crossfeed.enabled = false;
    engine.set_crossfeed(enabled_crossfeed).unwrap();
    assert!(!engine.crossfeed_config().enabled);

    engine
        .set_silence_trimming(SilenceTrimmingConfig {
            enabled: false,
            threshold_db: -50.0,
        })
        .unwrap();
    assert!(!engine.silence_trimming_config().enabled);
}

#[test]
fn test_smart_replaygain_auto_mode() {
    use domain::replaygain::{ReplayGainConfig, ReplayGainMode};

    let engine = AudioEngine::new().expect("Inicjalizacja AudioEngine");

    let auto_cfg = ReplayGainConfig {
        mode: ReplayGainMode::Auto,
        pre_amp_db: 2.5,
        fallback_gain_db: -4.0,
        prevent_clipping: true,
    };

    engine
        .set_replaygain(auto_cfg)
        .expect("Ustawienie ReplayGain Auto");
    assert_eq!(engine.replaygain_config().mode, ReplayGainMode::Auto);
    assert_eq!(engine.replaygain_config().pre_amp_db, 2.5);
    assert_eq!(engine.replaygain_config().fallback_gain_db, -4.0);
    assert!(engine.replaygain_config().prevent_clipping);

    // Dynamiczna adaptacja: ten sam album bez shuffle -> Album Gain
    engine.apply_auto_replaygain(true, false);

    // Inny album lub shuffle -> Track Gain
    engine.apply_auto_replaygain(false, false);
    engine.apply_auto_replaygain(true, true);
}

#[test]
fn test_loop_mode_track_preserves_current_uri_and_replays() {
    let fixture_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("tests/fixtures/test_sine_440hz.wav");

    let engine = AudioEngine::new().expect("Inicjalizacja AudioEngine");
    let uri = format!("file://{}", fixture_path.canonicalize().unwrap().display());

    engine.load_uri(&uri).expect("load_uri");
    assert_eq!(engine.current_uri(), Some(uri.clone()));

    // Ustawienie globalnego trybu zapętlania pojedynczego utworu (LoopMode::Track)
    engine.set_loop_mode(domain::queue::LoopMode::Track);
    assert_eq!(engine.loop_mode(), domain::queue::LoopMode::Track);

    // Weryfikacja że current_uri jest zachowane w potoku bez względu na obecność w kolejce
    assert_eq!(engine.current_uri(), Some(uri));
}

#[test]
fn test_buffer_configuration_and_defaults() {
    let engine = AudioEngine::new().expect("Inicjalizacja AudioEngine");

    // Weryfikacja wartości domyślnych
    assert_eq!(engine.audio_buffer_duration_ms(), 80);
    assert_eq!(engine.dsp_block_size(), 2048);

    // Zmiana bufora wyjściowego audio
    engine
        .set_audio_buffer_duration_ms(150)
        .expect("Ustawienie bufora audio na 150 ms");
    assert_eq!(engine.audio_buffer_duration_ms(), 150);

    // Przywrócenie domyślnego bufora audio
    engine
        .set_audio_buffer_duration_ms(80)
        .expect("Przywrócenie bufora audio na 80 ms");
    assert_eq!(engine.audio_buffer_duration_ms(), 80);

    // Zmiana rozmiaru bloku bufora DSP
    engine
        .set_dsp_block_size(4096)
        .expect("Ustawienie rozmiaru bloku DSP na 4096 ramek");
    assert_eq!(engine.dsp_block_size(), 4096);

    // Przywrócenie domyślnego rozmiaru bloku DSP
    engine
        .set_dsp_block_size(2048)
        .expect("Przywrócenie rozmiaru bloku DSP na 2048 ramek");
    assert_eq!(engine.dsp_block_size(), 2048);
}
