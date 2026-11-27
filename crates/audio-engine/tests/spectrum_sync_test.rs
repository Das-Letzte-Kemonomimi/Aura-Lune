use audio_engine::spectrum_sync::{
    SpectrumSync, SPECTRUM_MAX_STALENESS, SPECTRUM_RELEASE_LOOKAHEAD, SPECTRUM_SYNC_CAPACITY,
};
use std::time::Duration;

fn ms(v: u64) -> Duration {
    Duration::from_millis(v)
}

/// The analyser runs ~0.8 s ahead (measured: 720-820 ms with the 600 ms queue):
/// frames for 50..750 ms arrive while the sink is still at 0.
fn ahead_by_800ms() -> SpectrumSync<u64> {
    let mut sync = SpectrumSync::new();
    for at in (50..=750).step_by(100) {
        sync.push(ms(at), at);
    }
    sync
}

#[test]
fn test_frames_ahead_of_the_listener_are_held_back() {
    let mut sync = ahead_by_800ms();
    assert_eq!(sync.release(ms(0)), Some(50), "only the frame being heard");
    assert_eq!(sync.release(ms(20)), None, "nothing new reached yet");
    assert_eq!(sync.len(), 7, "the rest stays pending");
}

#[test]
fn test_release_returns_the_newest_reached_frame_and_drops_older_ones() {
    let mut sync = ahead_by_800ms();
    assert_eq!(sync.release(ms(300)), Some(350));
    assert_eq!(sync.release(ms(600)), Some(650));
    assert_eq!(sync.release(ms(700)), Some(750));
    assert!(sync.is_empty());
}

#[test]
fn test_frames_are_released_half_a_tick_early() {
    let mut sync = SpectrumSync::new();
    sync.push(ms(1_000), 1);
    let just_before = ms(1_000) - SPECTRUM_RELEASE_LOOKAHEAD - ms(1);
    assert_eq!(sync.release(just_before), None);
    assert_eq!(
        sync.release(ms(1_000) - SPECTRUM_RELEASE_LOOKAHEAD),
        Some(1)
    );
}

#[test]
fn test_stale_frames_after_a_forward_jump_are_not_shown() {
    let mut sync = ahead_by_800ms();
    // A forward seek moves the sink far past every pending frame.
    let heard = ms(750) + SPECTRUM_MAX_STALENESS + ms(100);
    assert_eq!(sync.release(heard), None);
    assert!(sync.is_empty(), "stale frames are dropped, not kept");
}

#[test]
fn test_backward_timestamps_discard_the_old_timeline() {
    let mut sync = ahead_by_800ms();
    // Seek back / new track: stream time restarts.
    sync.push(ms(10_050), 10);
    sync.push(ms(50), 0);
    assert_eq!(sync.len(), 1, "frames of the previous timeline are gone");
    assert_eq!(sync.release(ms(0)), Some(0));
}

#[test]
fn test_capacity_is_bounded() {
    let mut sync = SpectrumSync::new();
    for i in 0..(SPECTRUM_SYNC_CAPACITY as u64 + 20) {
        sync.push(ms(i * 100), i);
    }
    assert_eq!(sync.len(), SPECTRUM_SYNC_CAPACITY);
    sync.clear();
    assert!(sync.is_empty());
    // After clear, an earlier timestamp is not treated as a discontinuity of anything.
    sync.push(ms(0), 0);
    assert_eq!(sync.release(ms(0)), Some(0));
}
