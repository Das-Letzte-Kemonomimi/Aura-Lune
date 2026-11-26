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
        "The test file should exist: {:?}",
        fixture_path
    );

    let engine = AudioEngine::new().expect("AudioEngine initialisation should succeed");
    let uri = format!("file://{}", fixture_path.canonicalize().unwrap().display());

    engine
        .load_uri(&uri)
        .expect("Loading the file should succeed");

    // Start playback
    engine.play().expect("Play should succeed");
    sleep(Duration::from_millis(150));

    // Modulate the DSP parameters on the fly
    engine
        .set_pitch_semitones(4.0)
        .expect("Changing the pitch to +4 semitones should succeed");
    assert_eq!(engine.dsp_params().pitch_semitones, 4.0);

    engine
        .set_tempo_ratio(1.25)
        .expect("Changing the tempo to 1.25x should succeed");
    assert_eq!(engine.dsp_params().tempo_ratio, 1.25);

    sleep(Duration::from_millis(150));

    // Check switching the DSP engine on the fly: SoundTouch <-> Rubber Band
    engine
        .set_dsp_engine(dsp_api::DspEngine::RubberBand)
        .expect("Switching to Rubber Band should succeed");
    assert_eq!(engine.dsp_params().engine, dsp_api::DspEngine::RubberBand);
    assert_eq!(engine.dsp_capabilities().name, "Rubber Band");

    sleep(Duration::from_millis(150));

    engine
        .set_dsp_engine(dsp_api::DspEngine::SoundTouch)
        .expect("Switching to SoundTouch should succeed");
    assert_eq!(engine.dsp_params().engine, dsp_api::DspEngine::SoundTouch);
    assert_eq!(engine.dsp_capabilities().name, "SoundTouch");

    sleep(Duration::from_millis(150));

    // Check switching to Bypass on the fly during active playback
    engine
        .set_dsp_engine(dsp_api::DspEngine::Bypass)
        .expect("Switching to Bypass on the fly should succeed");
    assert_eq!(engine.dsp_params().engine, dsp_api::DspEngine::Bypass);
    assert_eq!(engine.dsp_capabilities().name, "Direct Bypass (No DSP)");

    sleep(Duration::from_millis(150));

    // Check going back to RubberBand from Bypass on the fly
    engine
        .set_dsp_engine(dsp_api::DspEngine::RubberBand)
        .expect("Going back to Rubber Band on the fly should succeed");
    assert_eq!(engine.dsp_params().engine, dsp_api::DspEngine::RubberBand);

    // Check seeking
    let seek_result = engine.seek(Duration::from_millis(200));
    assert!(seek_result.is_ok(), "Seek should succeed");

    // Check bus polling
    let _events = engine.poll_events();

    // Pause and stop
    engine.pause().expect("Pause should succeed");
    engine.stop().expect("Stop should succeed");
}

#[test]
fn test_dsp_tempo_position_synchronization() {
    let fixture_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("tests/fixtures/test_sine_440hz.wav");

    let engine = AudioEngine::new().expect("Initialising AudioEngine");
    let uri = format!("file://{}", fixture_path.canonicalize().unwrap().display());

    engine.load_uri(&uri).expect("Loading the file");

    // Enable a DSP engine for the tempo sync test
    engine
        .set_dsp_engine(dsp_api::DspEngine::RubberBand)
        .expect("Enabling RubberBand");

    // Set the tempo to 0.50x (doubles the listening time)
    engine
        .set_tempo_ratio(0.50)
        .expect("Setting the tempo to 0.50x");

    engine.play().expect("Play");
    sleep(Duration::from_millis(300));

    let pos = engine.position();
    let dur = engine.duration();

    assert!(pos.is_some(), "The position should be available");
    assert!(dur.is_some(), "The duration should be available");

    let pos_ms = pos.unwrap().as_millis() as u64;
    let dur_ms = dur.unwrap().as_millis() as u64;

    // At 0.50x tempo after 300 ms of real time, the position in the source track
    // should be about 150 ms (+- buffering) and must not run past the track length.
    assert!(
        pos_ms <= dur_ms,
        "Position {} ms must not exceed the track length {} ms",
        pos_ms,
        dur_ms
    );
    // Scaling: at a slowed tempo (0.50x) the track position must not run ahead of real time
    assert!(
        pos_ms <= 260,
        "The position ({pos_ms}ms) at 0.50x tempo should be proportionally smaller than wall-clock time (300ms)"
    );

    // Check seeking while slowed down
    engine
        .seek(Duration::from_millis(500))
        .expect("Seek do 500ms");
    sleep(Duration::from_millis(50));
    let seek_pos = engine
        .position()
        .expect("Position after the seek")
        .as_millis() as u64;
    assert!(
        (480..=650).contains(&seek_pos),
        "The position after seeking to 500ms should be about 500ms, but is {}",
        seek_pos
    );

    // Check an on-the-fly tempo change (no position jump)
    engine
        .set_tempo_ratio(1.50)
        .expect("Changing the tempo on the fly to 1.50x");
    let after_change_pos = engine
        .position()
        .expect("Position after the tempo change")
        .as_millis() as u64;
    assert!(
        (after_change_pos as i64 - seek_pos as i64).abs() < 100,
        "The position must not jump after an on-the-fly tempo change: before={}, after={}",
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

    let engine = AudioEngine::new().expect("Initialising AudioEngine");
    let uri = format!("file://{}", fixture_path.canonicalize().unwrap().display());
    engine.load_uri(&uri).expect("Loading the file");

    engine.set_volume(0.85).expect("Setting the volume");
    assert!((engine.volume() - 0.85).abs() < 1e-4);

    engine.play().expect("Play");
    sleep(Duration::from_millis(100));

    // Seek with the smooth fade enabled (fade: true)
    engine
        .seek_with_fade(Duration::from_millis(200), true)
        .expect("seek_with_fade (fade: true) succeeded");
    // Afterwards the user's volume must still be 0.85
    assert!((engine.volume() - 0.85).abs() < 1e-4);

    // Seek with the fade disabled (fade: false)
    engine
        .seek_with_fade(Duration::from_millis(400), false)
        .expect("seek_with_fade (fade: false) succeeded");
    assert!((engine.volume() - 0.85).abs() < 1e-4);

    engine.stop().expect("Stop");
}

#[test]
fn test_audio_engine_set_volume_smooth() {
    let engine = AudioEngine::new().expect("Initialising AudioEngine");
    engine.set_volume(1.0).expect("Set initial volume");
    assert!((engine.volume() - 1.0).abs() < 1e-4);

    // Smooth transition from 1.0 to 0.40 over 60ms
    engine
        .set_volume_smooth(0.40, Duration::from_millis(60))
        .expect("Smooth volume transition started");
    assert!((engine.volume() - 0.40).abs() < 1e-4);

    sleep(Duration::from_millis(80));

    // Instant volume override cancels any active fade
    engine.set_volume(0.75).expect("Instant volume change");
    assert!((engine.volume() - 0.75).abs() < 1e-4);
}

#[test]
fn test_dsp_bypass_preserves_custom_parameters_on_return() {
    let engine = AudioEngine::new().expect("Initialising AudioEngine");

    // 1. Set the parameters in the RubberBand engine
    engine
        .set_dsp_engine(dsp_api::DspEngine::RubberBand)
        .expect("Switching to RubberBand");
    engine
        .set_pitch_semitones(3.5)
        .expect("Setting pitch to +3.5");
    engine
        .set_tempo_ratio(1.20)
        .expect("Setting tempo to 1.20x");
    engine.set_rate_ratio(1.05).expect("Setting rate to 1.05x");

    assert_eq!(engine.dsp_params().pitch_semitones, 3.5);
    assert_eq!(engine.dsp_params().tempo_ratio, 1.20);
    assert_eq!(engine.dsp_params().rate_ratio, 1.05);

    // 2. Switch to the output without DSP (Bypass / Direct)
    engine
        .set_dsp_engine(dsp_api::DspEngine::Bypass)
        .expect("Switching to Bypass");
    assert_eq!(engine.dsp_params().engine, dsp_api::DspEngine::Bypass);

    // 3. Back to RubberBand: the values must be intact
    engine
        .set_dsp_engine(dsp_api::DspEngine::RubberBand)
        .expect("Back to RubberBand");
    assert_eq!(engine.dsp_params().engine, dsp_api::DspEngine::RubberBand);
    assert_eq!(engine.dsp_params().pitch_semitones, 3.5);
    assert_eq!(engine.dsp_params().tempo_ratio, 1.20);
    assert_eq!(engine.dsp_params().rate_ratio, 1.05);

    // 4. Switch to SoundTouch: the values must be kept as well
    engine
        .set_dsp_engine(dsp_api::DspEngine::SoundTouch)
        .expect("Switching to SoundTouch");
    assert_eq!(engine.dsp_params().engine, dsp_api::DspEngine::SoundTouch);
    assert_eq!(engine.dsp_params().pitch_semitones, 3.5);
    assert_eq!(engine.dsp_params().tempo_ratio, 1.20);
    assert_eq!(engine.dsp_params().rate_ratio, 1.05);
}

#[test]
fn test_reverb_parameters_and_pipeline() {
    let engine = AudioEngine::new().expect("Initialising AudioEngine");

    // Off by default
    let (enabled, room_size, damping, width, level) = engine.reverb_params();
    assert!(!enabled);
    assert_eq!(room_size, 0.5);
    assert_eq!(damping, 0.2);
    assert_eq!(width, 1.0);
    assert_eq!(level, 0.0);

    // Enable the reverb (Slowed + Reverb preset)
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

    let engine = AudioEngine::new().expect("Initialising AudioEngine");
    let uri = format!("file://{}", fixture_path.canonicalize().unwrap().display());
    engine.load_uri(&uri).unwrap();

    // Play with a micro fade-in
    engine.play_with_fade(true).expect("Play with fade");
    sleep(Duration::from_millis(80));

    // Pause with a micro fade-out
    engine.pause_with_fade(true).expect("Pause with fade");
    sleep(Duration::from_millis(50));

    // Play again
    engine.play_with_fade(true).expect("Play again with fade");
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

    let engine = AudioEngine::new().expect("Initialising AudioEngine");

    // Default settings
    assert!(!engine.crossfeed_config().enabled);
    assert!(!engine.silence_trimming_config().enabled);

    // Crossfeed configuration (Chu Moy preset)
    let crossfeed_cfg = CrossfeedConfig::with_preset(CrossfeedPreset::ChuMoy);
    let mut enabled_crossfeed = crossfeed_cfg;
    enabled_crossfeed.enabled = true;
    engine
        .set_crossfeed(enabled_crossfeed)
        .expect("Setting crossfeed");
    let retrieved_cf = engine.crossfeed_config();
    assert!(retrieved_cf.enabled);
    assert_eq!(retrieved_cf.preset, CrossfeedPreset::ChuMoy);
    assert_eq!(retrieved_cf.fcut_hz, 700);
    assert_eq!(retrieved_cf.feed_tenth_db, 60);

    // Silence trimming configuration
    let silence_cfg = SilenceTrimmingConfig {
        enabled: true,
        threshold_db: -55.0,
    };
    engine
        .set_silence_trimming(silence_cfg)
        .expect("Setting silence trimming");
    let retrieved_silence = engine.silence_trimming_config();
    assert!(retrieved_silence.enabled);
    assert_eq!(retrieved_silence.threshold_db, -55.0);

    // Disable
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

    let engine = AudioEngine::new().expect("Initialising AudioEngine");

    // Album mode first: Auto must not inherit its album mode.
    engine
        .set_replaygain(ReplayGainConfig {
            mode: ReplayGainMode::Album,
            pre_amp_db: 0.0,
            fallback_gain_db: 0.0,
            prevent_clipping: true,
        })
        .expect("Setting ReplayGain Album");
    assert!(engine.replaygain_album_mode());

    let auto_cfg = ReplayGainConfig {
        mode: ReplayGainMode::Auto,
        pre_amp_db: 2.5,
        fallback_gain_db: -4.0,
        prevent_clipping: true,
    };

    engine
        .set_replaygain(auto_cfg)
        .expect("Setting ReplayGain Auto");
    assert_eq!(engine.replaygain_config().mode, ReplayGainMode::Auto);
    assert_eq!(engine.replaygain_config().pre_amp_db, 2.5);
    assert_eq!(engine.replaygain_config().fallback_gain_db, -4.0);
    assert!(engine.replaygain_config().prevent_clipping);

    // Auto starts with Track Gain even if Album mode was active before.
    assert!(!engine.replaygain_album_mode());

    // Dynamic adaptation: the same album without shuffle -> Album Gain
    engine.apply_auto_replaygain(true, false);
    assert!(engine.replaygain_album_mode());

    // Another album or shuffle -> Track Gain
    engine.apply_auto_replaygain(false, false);
    assert!(!engine.replaygain_album_mode());
    engine.apply_auto_replaygain(true, true);
    assert!(!engine.replaygain_album_mode());
}

#[test]
fn test_replaygain_toggle_modes_while_playing() {
    use domain::replaygain::{ReplayGainConfig, ReplayGainMode};
    let fixture_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("tests/fixtures/test_sine_440hz.wav");

    let engine = AudioEngine::new().expect("Initialising AudioEngine");
    let uri = format!("file://{}", fixture_path.canonicalize().unwrap().display());
    engine.load_uri(&uri).expect("load_uri");
    engine.play().expect("play");

    // The status reports the effective limiter; with the user's own limiter off, only the
    // ReplayGain clipping guard can switch it on.
    engine.set_limiter_enabled(false);

    // Default status (Off)
    let (tgt, res, lim) = engine.replaygain_status();
    assert_eq!((tgt, res, lim), (0.0, 0.0, false));

    // Switch to Track Gain
    engine
        .set_replaygain(ReplayGainConfig {
            mode: ReplayGainMode::Track,
            pre_amp_db: 1.0,
            fallback_gain_db: -6.0,
            prevent_clipping: true,
        })
        .expect("set_replaygain Track");
    assert_eq!(engine.replaygain_config().mode, ReplayGainMode::Track);

    // Switch to Album Gain
    engine
        .set_replaygain(ReplayGainConfig {
            mode: ReplayGainMode::Album,
            pre_amp_db: 0.0,
            fallback_gain_db: -3.0,
            prevent_clipping: false,
        })
        .expect("set_replaygain Album");
    assert_eq!(engine.replaygain_config().mode, ReplayGainMode::Album);

    // Switch back to Off (must not hang or loop forever!)
    engine
        .set_replaygain(ReplayGainConfig {
            mode: ReplayGainMode::Off,
            pre_amp_db: 0.0,
            fallback_gain_db: -6.0,
            prevent_clipping: true,
        })
        .expect("set_replaygain Off");
    assert_eq!(engine.replaygain_config().mode, ReplayGainMode::Off);
    let (tgt_off, res_off, lim_off) = engine.replaygain_status();
    assert_eq!((tgt_off, res_off, lim_off), (0.0, 0.0, false));

    // Enable and disable again during playback
    engine
        .set_replaygain(ReplayGainConfig {
            mode: ReplayGainMode::Auto,
            pre_amp_db: -1.0,
            fallback_gain_db: -6.0,
            prevent_clipping: true,
        })
        .expect("set_replaygain Auto");
    engine
        .set_replaygain(ReplayGainConfig {
            mode: ReplayGainMode::Off,
            pre_amp_db: 0.0,
            fallback_gain_db: -6.0,
            prevent_clipping: true,
        })
        .expect("set_replaygain Off again");

    engine.stop().expect("stop");
}

#[test]
fn test_loop_mode_track_preserves_current_uri_and_replays() {
    let fixture_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("tests/fixtures/test_sine_440hz.wav");

    let engine = AudioEngine::new().expect("Initialising AudioEngine");
    let uri = format!("file://{}", fixture_path.canonicalize().unwrap().display());

    engine.load_uri(&uri).expect("load_uri");
    assert_eq!(engine.current_uri(), Some(uri.clone()));

    // Set the global single-track repeat mode (LoopMode::Track)
    engine.set_loop_mode(domain::queue::LoopMode::Track);
    assert_eq!(engine.loop_mode(), domain::queue::LoopMode::Track);

    // Check that current_uri is kept in the pipeline whether or not it is in the queue
    assert_eq!(engine.current_uri(), Some(uri));

    // Start playback
    engine.play().expect("play");

    // Wait a moment for preroll and the duration
    let mut duration = None;
    for _ in 0..20 {
        sleep(Duration::from_millis(50));
        let _ = engine.poll_events();
        if let Some(d) = engine.duration() {
            if d > Duration::ZERO {
                duration = Some(d);
                break;
            }
        }
    }
    let dur = duration.expect("The file duration should be available");

    // Seek to 300ms before the end of the track to trigger EOS
    let target = dur.saturating_sub(Duration::from_millis(300));
    engine.seek(target).expect("seek near end");

    // Wait for EOS and the loop handling in poll_events()
    let mut got_eos = false;
    for _ in 0..40 {
        sleep(Duration::from_millis(50));
        let events = engine.poll_events();
        if events.contains(&audio_engine::PlayerEvent::Eos) {
            got_eos = true;
            break;
        }
    }
    assert!(got_eos, "Expected an Eos event on the GStreamer bus");

    // After handling EOS in LoopMode::Track the engine should reset and resume playback (Playing) right away
    assert_eq!(
        engine.state(),
        domain::PlaybackState::Playing,
        "The state after repeating the track should be Playing"
    );

    // The position should restart from the beginning of the track (< 1s)
    let pos = engine.position().unwrap_or(Duration::ZERO);
    assert!(
        pos < Duration::from_millis(1000),
        "The position after repeating should go back to the start (< 1000ms), but is {:?}",
        pos
    );

    engine.stop().expect("stop");
}

#[test]
fn test_loop_mode_queue_single_track_eos_replays() {
    let fixture_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("tests/fixtures/test_sine_440hz.wav");

    let engine = AudioEngine::new().expect("Initialising AudioEngine");
    let uri = format!("file://{}", fixture_path.canonicalize().unwrap().display());

    engine.load_uri(&uri).expect("load_uri");
    engine.set_loop_mode(domain::queue::LoopMode::Queue);
    assert_eq!(engine.loop_mode(), domain::queue::LoopMode::Queue);

    engine.play().expect("play");

    // Wait for preroll and the duration
    let mut duration = None;
    for _ in 0..20 {
        sleep(Duration::from_millis(50));
        let _ = engine.poll_events();
        if let Some(d) = engine.duration() {
            if d > Duration::ZERO {
                duration = Some(d);
                break;
            }
        }
    }
    let dur = duration.expect("The file duration should be available");

    // Seek to 300ms before the end of the track
    let target = dur.saturating_sub(Duration::from_millis(300));
    engine.seek(target).expect("seek near end");

    // Wait for EOS
    let mut got_eos = false;
    for _ in 0..40 {
        sleep(Duration::from_millis(50));
        let events = engine.poll_events();
        if events.contains(&audio_engine::PlayerEvent::Eos) {
            got_eos = true;
            break;
        }
    }
    assert!(got_eos, "Expected an Eos event");

    assert_eq!(
        engine.state(),
        domain::PlaybackState::Playing,
        "The state after repeating a single track in Queue mode should be Playing"
    );

    let pos = engine.position().unwrap_or(Duration::ZERO);
    assert!(
        pos < Duration::from_millis(1000),
        "The position should restart from the beginning, but is {:?}",
        pos
    );

    engine.stop().expect("stop");
}

#[test]
fn test_buffer_configuration_and_defaults() {
    let engine = AudioEngine::new().expect("Initialising AudioEngine");

    // Check the defaults (a 600 ms default buffer for maximum underrun resistance)
    assert_eq!(engine.audio_buffer_duration_ms(), 600);
    assert_eq!(engine.dsp_block_size(), 2048);

    // Change the audio output buffer
    engine
        .set_audio_buffer_duration_ms(150)
        .expect("Setting the audio buffer to 150 ms");
    assert_eq!(engine.audio_buffer_duration_ms(), 150);

    // Restore the default audio buffer
    engine
        .set_audio_buffer_duration_ms(600)
        .expect("Restoring the audio buffer to 600 ms");
    assert_eq!(engine.audio_buffer_duration_ms(), 600);

    // Change the DSP block size
    engine
        .set_dsp_block_size(4096)
        .expect("Setting the DSP block size to 4096 frames");
    assert_eq!(engine.dsp_block_size(), 4096);

    // Restore the default DSP block size
    engine
        .set_dsp_block_size(2048)
        .expect("Restoring the DSP block size to 2048 frames");
    assert_eq!(engine.dsp_block_size(), 2048);
}

#[test]
fn test_stop_after_current_track_flag_and_state() {
    let engine = AudioEngine::new().expect("Initialising AudioEngine");

    // The flag is off by default
    assert!(!engine.stop_after_current());

    // Enable the flag
    engine.set_stop_after_current(true);
    assert!(engine.stop_after_current());

    // Disable the flag
    engine.set_stop_after_current(false);
    assert!(!engine.stop_after_current());
}

#[test]
fn test_stop_after_current_track_eos_stops_cleanly() {
    let fixture_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("tests/fixtures/test_sine_440hz.wav");

    let engine = AudioEngine::new().expect("Initialising AudioEngine");
    let uri = format!("file://{}", fixture_path.canonicalize().unwrap().display());

    engine.load_uri(&uri).expect("load_uri");
    engine.play().expect("play");

    // Enable the "Stop After Current Track" flag
    engine.set_stop_after_current(true);
    assert!(engine.stop_after_current());

    // Wait for preroll and the duration
    let mut duration = None;
    for _ in 0..20 {
        sleep(Duration::from_millis(50));
        let _ = engine.poll_events();
        if let Some(d) = engine.duration() {
            if d > Duration::ZERO {
                duration = Some(d);
                break;
            }
        }
    }
    let dur = duration.expect("The file duration should be available");

    // Seek to just before the end of the track (300 ms before the end)
    let target = dur.saturating_sub(Duration::from_millis(300));
    engine.seek(target).expect("seek near end");

    // Wait for EOS
    let mut got_eos = false;
    for _ in 0..40 {
        sleep(Duration::from_millis(50));
        let events = engine.poll_events();
        if events.contains(&audio_engine::PlayerEvent::Eos) {
            got_eos = true;
            break;
        }
    }

    assert!(got_eos, "An EOS message should arrive");
    // After EOS the state should be Stopped and the flag reset to false
    assert_eq!(engine.state(), domain::PlaybackState::Stopped);
    assert!(
        !engine.stop_after_current(),
        "The stop_after_current flag should be reset automatically after stopping"
    );
}

#[test]
fn test_equal_power_crossfade_duration_and_transition() {
    let fixture_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("tests/fixtures/test_sine_440hz.wav");

    let engine = AudioEngine::new().expect("AudioEngine init");

    // Default crossfade duration
    assert_eq!(engine.crossfade_duration_ms(), 1500);

    // Set the full 8.00s (8000ms) crossfade, as in the user's screenshot
    engine.set_crossfade_duration_ms(8000);
    assert_eq!(engine.crossfade_duration_ms(), 8000);

    // Check clamping
    engine.set_crossfade_duration_ms(15000);
    assert_eq!(engine.crossfade_duration_ms(), 8000);

    engine.set_crossfade_duration_ms(400);

    let item1 = domain::queue::QueueItem {
        id: "q-xfade-1".to_string(),
        track_id: Some(101),
        uri: format!("file://{}", fixture_path.canonicalize().unwrap().display()),
        title: "Track 1".to_string(),
        artist: "Crossfade Test".to_string(),
        album: None,
        duration_ms: 1000,
    };
    let item2 = domain::queue::QueueItem {
        id: "q-xfade-2".to_string(),
        track_id: Some(102),
        uri: format!("file://{}", fixture_path.canonicalize().unwrap().display()),
        title: "Track 2".to_string(),
        artist: "Crossfade Test".to_string(),
        album: None,
        duration_ms: 1000,
    };

    let active = engine
        .set_queue(vec![item1, item2], Some(0))
        .expect("set_queue");
    assert!(active.is_some());
    assert_eq!(engine.state(), domain::PlaybackState::Playing);

    sleep(Duration::from_millis(50));

    // play_next with crossfade active (smooth fade-out and fade-in in the background)
    let next = engine.play_next().expect("play_next with crossfade");
    assert!(next.is_some());
    assert_eq!(next.unwrap().title, "Track 2");
    assert_eq!(engine.state(), domain::PlaybackState::Playing);

    sleep(Duration::from_millis(100));

    engine.stop().expect("stop");
}

/// Going from Bypass into DSP processing doesn't seek, but the position must keep rising smoothly:
/// no jump back / to the start and no skip forward after changing the engine and tempo.
#[test]
fn test_bypass_to_dsp_switch_keeps_position_continuous() {
    let fixture_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("tests/fixtures/Skrzydła Białe.flac");
    assert!(fixture_path.exists(), "The test file should exist");

    let engine = AudioEngine::new().expect("Initialising AudioEngine");
    let uri = audio_engine::uri::media_uri(fixture_path.to_str().unwrap());
    engine.load_uri(&uri).expect("Loading the file");
    engine.play().expect("Play");
    engine.seek(Duration::from_secs(5)).expect("Seek to 5 s");
    sleep(Duration::from_millis(500));

    let before = engine.position().expect("Position before the switch");

    engine
        .set_dsp_engine(dsp_api::DspEngine::RubberBand)
        .expect("Entering RubberBand from Bypass");
    engine.set_tempo_ratio(1.5).expect("Tempo 1.5x");
    sleep(Duration::from_millis(800));

    let after = engine.position().expect("Position after the switch");

    assert!(
        after >= before,
        "The position must not go back after the switch: {:?} -> {:?}",
        before,
        after
    );
    // 0.8 s of clock * 1.5 + headroom for buffers/rebase; a jump of several seconds would mean a timeline bug.
    assert!(
        after - before < Duration::from_millis(2500),
        "The position skipped forward: {:?} -> {:?}",
        before,
        after
    );
}
