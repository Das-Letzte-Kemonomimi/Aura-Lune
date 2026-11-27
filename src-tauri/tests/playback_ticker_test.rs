use auralune_desktop::commands::playback::PlaybackStatusDto;
use auralune_desktop::setup::playback_ticker::{should_emit, ListeningTracker, EMIT_KEEPALIVE};
use domain::queue::LoopMode;
use domain::replaygain::ReplayGainConfig;
use domain::PlaybackState;
use dsp_api::DspEngine;
use std::time::Duration;

fn sample_dto(state: PlaybackState, position_ms: u64) -> PlaybackStatusDto {
    PlaybackStatusDto {
        state,
        position_ms,
        duration_ms: Some(180_000),
        volume: 0.8,
        pitch_semitones: 0.0,
        tempo_ratio: 1.0,
        rate_ratio: 1.0,
        engine: DspEngine::Bypass,
        capabilities: DspEngine::Bypass.capabilities(),
        loop_mode: LoopMode::None,
        shuffle: false,
        stop_after_current: false,
        current_track: None,
        equalizer_enabled: false,
        equalizer_bands: [0.0; 10],
        parametric_eq_enabled: false,
        compressor_enabled: false,
        saturator_enabled: false,
        limiter_enabled: false,
        clip_detected: false,
        spectrum: Vec::new(),
        replaygain_config: ReplayGainConfig::default(),
        replaygain_status: (0.0, 0.0, false),
        live_stream_title: None,
        is_stems_active: false,
        active_stem_project_id: None,
    }
}

#[test]
fn test_should_emit_policy_visible_and_hidden() {
    let paused_a = sample_dto(PlaybackState::Paused, 5_000);
    let paused_same = sample_dto(PlaybackState::Paused, 5_000);
    let playing_next = sample_dto(PlaybackState::Playing, 5_100);

    // First emit always goes through.
    assert!(should_emit(
        None,
        &paused_a,
        Duration::from_millis(0),
        false
    ));
    assert!(should_emit(None, &paused_a, Duration::from_millis(0), true));

    // Unchanged visible status skips until the 1 s keepalive boundary.
    assert!(!should_emit(
        Some(&paused_a),
        &paused_same,
        Duration::from_millis(250),
        false
    ));
    assert!(should_emit(
        Some(&paused_a),
        &paused_same,
        EMIT_KEEPALIVE,
        false
    ));

    // Any visible change emits immediately.
    assert!(should_emit(
        Some(&paused_a),
        &playing_next,
        Duration::from_millis(100),
        false
    ));

    // While hidden in tray, even changed frames wait for the 1 s cap.
    assert!(!should_emit(
        Some(&paused_a),
        &playing_next,
        Duration::from_millis(500),
        true
    ));
    assert!(should_emit(
        Some(&paused_a),
        &playing_next,
        EMIT_KEEPALIVE,
        true
    ));
}

/// Simulates ticks every `step_ms` for `total_ms`; returns all the writes.
fn run(
    tracker: &mut ListeningTracker,
    start_ms: u64,
    total_ms: u64,
    step_ms: u64,
    playing: bool,
    track: Option<i64>,
) -> Vec<(i64, u64)> {
    let mut flushes = Vec::new();
    let mut t = start_ms;
    while t <= start_ms + total_ms {
        if let Some(f) = tracker.on_tick(t, playing, track) {
            flushes.push(f);
        }
        t += step_ms;
    }
    flushes
}

#[test]
fn test_flushes_every_five_seconds_of_playback() {
    let mut tr = ListeningTracker::default();
    let flushes = run(&mut tr, 0, 12_000, 100, true, Some(7));
    assert_eq!(flushes, vec![(7, 5_000), (7, 5_000)]);
}

#[test]
fn test_paused_time_is_not_counted() {
    let mut tr = ListeningTracker::default();
    let flushes = run(&mut tr, 0, 60_000, 250, false, Some(7));
    assert!(flushes.is_empty());
}

#[test]
fn test_track_change_flushes_remaining_time_for_previous_track() {
    let mut tr = ListeningTracker::default();
    run(&mut tr, 0, 3_000, 100, true, Some(1));
    assert_eq!(tr.on_tick(3_100, true, Some(2)), Some((1, 3_000)));
    // A new track starts counting from zero.
    let flushes = run(&mut tr, 3_200, 5_000, 100, true, Some(2));
    assert_eq!(flushes, vec![(2, 5_000)]);
}

#[test]
fn test_long_gap_between_ticks_is_capped() {
    // An hour of system sleep must not add an hour of listening.
    let mut tr = ListeningTracker::default();
    tr.on_tick(0, true, Some(3));
    assert_eq!(tr.on_tick(3_600_000, true, Some(3)), None);
    let flushes = run(&mut tr, 3_600_100, 4_000, 100, true, Some(3));
    assert_eq!(flushes, vec![(3, 5_000)], "1 s (cap) + 4 s of normal ticks");
}

#[test]
fn test_untracked_items_are_ignored() {
    let mut tr = ListeningTracker::default();
    assert!(run(&mut tr, 0, 20_000, 100, true, None).is_empty());
}
