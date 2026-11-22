use auralune_desktop::setup::playback_ticker::ListeningTracker;

/// Symuluje takty co `step_ms` przez `total_ms`; zwraca wszystkie zapisy.
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
    // Nowy utwór zaczyna liczyć od zera.
    let flushes = run(&mut tr, 3_200, 5_000, 100, true, Some(2));
    assert_eq!(flushes, vec![(2, 5_000)]);
}

#[test]
fn test_long_gap_between_ticks_is_capped() {
    // Uśpienie systemu na godzinę nie może dopisać godziny słuchania.
    let mut tr = ListeningTracker::default();
    tr.on_tick(0, true, Some(3));
    assert_eq!(tr.on_tick(3_600_000, true, Some(3)), None);
    let flushes = run(&mut tr, 3_600_100, 4_000, 100, true, Some(3));
    assert_eq!(
        flushes,
        vec![(3, 5_000)],
        "1 s (limit) + 4 s zwykłych taktów"
    );
}

#[test]
fn test_untracked_items_are_ignored() {
    let mut tr = ListeningTracker::default();
    assert!(run(&mut tr, 0, 20_000, 100, true, None).is_empty());
}
