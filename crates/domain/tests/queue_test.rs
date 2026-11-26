use domain::queue::{LoopMode, PlaybackQueue, QueueItem};
use std::collections::HashSet;

fn items(n: usize) -> Vec<QueueItem> {
    (0..n)
        .map(|i| QueueItem {
            id: format!("q-{i}"),
            track_id: Some(i as i64),
            uri: format!("file:///music/{i}.flac"),
            title: format!("Track {i}"),
            artist: "Artist".into(),
            album: None,
            duration_ms: 1000,
        })
        .collect()
}

fn shuffled_queue(n: usize, start: usize) -> PlaybackQueue {
    let mut q = PlaybackQueue::new();
    q.set_items(items(n), Some(start));
    q.set_shuffle(true);
    q
}

#[test]
fn test_shuffle_order_is_a_permutation_starting_at_current() {
    let q = shuffled_queue(50, 7);
    assert_eq!(q.shuffle_order.len(), 50);
    let unique: HashSet<_> = q.shuffle_order.iter().copied().collect();
    assert_eq!(unique.len(), 50, "Every track exactly once");
    assert_eq!(q.shuffle_order[0], 7, "The current track starts the order");
    assert_eq!(q.shuffle_cursor, 0);
}

#[test]
fn test_shuffle_differs_between_queues_of_same_length() {
    // The seed used to depend only on the queue length, so every 20-item queue
    // had the same order. With 20! permutations, 5 identical results are impossible.
    let orders: HashSet<Vec<usize>> = (0..5)
        .map(|_| shuffled_queue(20, 0).shuffle_order)
        .collect();
    assert!(orders.len() > 1, "The shuffle order must change");
}

#[test]
fn test_shuffle_next_visits_every_track_once_then_stops() {
    let mut q = shuffled_queue(10, 3);
    let mut seen = vec![q.current_item().unwrap().id.clone()];
    while let Some(item) = q.next() {
        seen.push(item.id.clone());
    }
    let unique: HashSet<_> = seen.iter().collect();
    assert_eq!(seen.len(), 10);
    assert_eq!(unique.len(), 10);
}

#[test]
fn test_shuffle_previous_walks_back_through_history() {
    let mut q = shuffled_queue(10, 0);
    let first = q.current_item().unwrap().id.clone();
    let second = q.next().unwrap().id.clone();
    let _third = q.next().unwrap().id.clone();
    assert_eq!(q.previous().unwrap().id, second);
    assert_eq!(q.previous().unwrap().id, first);
}

#[test]
fn test_shuffle_loop_queue_wraps_around() {
    let mut q = shuffled_queue(3, 0);
    q.set_loop_mode(LoopMode::Queue);
    for _ in 0..10 {
        assert!(q.next().is_some(), "Loop Queue never ends the queue");
    }
}

#[test]
fn test_mutations_under_shuffle_keep_current_item() {
    let mut q = shuffled_queue(10, 4);
    q.next();
    let current = q.current_item().unwrap().id.clone();

    q.add_item(items(11).pop().unwrap());
    assert_eq!(q.current_item().unwrap().id, current, "add_item");

    let mut extra = items(12).pop().unwrap();
    extra.id = "next-up".into();
    q.add_next(extra);
    assert_eq!(q.current_item().unwrap().id, current, "add_next");

    let removable = q.items.iter().find(|i| i.id != current).unwrap().id.clone();
    q.remove_item(&removable);
    assert_eq!(q.current_item().unwrap().id, current, "remove_item");

    let cur_idx = q.current_index.unwrap();
    q.move_item(cur_idx, 0);
    assert_eq!(q.current_item().unwrap().id, current, "move_item");

    // After every change the shuffle order still covers every track and starts with the current one.
    assert_eq!(q.shuffle_order.len(), q.items.len());
    assert_eq!(q.shuffle_order[q.shuffle_cursor], q.current_index.unwrap());
}

#[test]
fn test_add_next_inserts_after_current_in_sequential_mode() {
    let mut q = PlaybackQueue::new();
    q.set_items(items(3), Some(1));
    let mut extra = items(4).pop().unwrap();
    extra.id = "next-up".into();
    q.add_next(extra);
    assert_eq!(q.next().unwrap().id, "next-up");
}

#[test]
fn test_set_items_with_start_index_drops_stale_active_stream() {
    let mut q = PlaybackQueue::new();
    // Radio does not belong to the queue: it is set as the active stream.
    q.set_active_item(QueueItem {
        id: "radio-1".into(),
        track_id: None,
        uri: "http://stream.radio.fm/live".into(),
        title: "Anime FM".into(),
        artist: "Anime FM".into(),
        album: None,
        duration_ms: 0,
    });
    assert_eq!(q.current_item().map(|i| i.id.as_str()), Some("radio-1"));

    q.set_items(items(3), Some(1));
    assert_eq!(q.current_item().map(|i| i.id.as_str()), Some("q-1"));

    // After the index is cleared, radio must not "come back" as the current track.
    q.current_index = None;
    assert!(q.current_item().is_none());
}

#[test]
fn set_active_item_keeps_queue_entry_and_shuffle_position() {
    let mk = |id: &str, track: i64| QueueItem {
        id: id.to_string(),
        track_id: Some(track),
        uri: format!("file:///{track}.flac"),
        title: format!("Song {track}"),
        artist: "A".into(),
        album: None,
        duration_ms: 1000,
    };
    let mut q = PlaybackQueue::new();
    q.set_items((1..=6).map(|n| mk(&format!("q{n}"), n)).collect(), Some(0));
    q.set_shuffle(true);

    // Stem studio re-announces the playing track under a different id.
    let playing = q.current_item().unwrap().clone();
    let mut announced = playing.clone();
    announced.id = "stem-project-9".into();
    q.set_active_item(announced);

    assert_eq!(q.current_item().unwrap().id, playing.id);
    assert_eq!(q.shuffle_order[q.shuffle_cursor], q.current_index.unwrap());

    // Next must advance to the following shuffled track, not skip or restart.
    let expected = q.shuffle_order[q.shuffle_cursor + 1];
    q.next();
    assert_eq!(q.current_index, Some(expected));
}
