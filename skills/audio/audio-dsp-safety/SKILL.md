---
name: audio-dsp-safety
description: 'Real-time audio DSP safety guidelines, GStreamer pipeline rules, and underrun resilience for Aura-Lune.'
metadata:
  namespace: audio
---
# Audio DSP Safety & Real-Time Best Practices

This skill guides agents working with `crates/audio-engine`, `crates/dsp-rubberband`, `crates/dsp-soundtouch`, and related audio processing modules.

## Golden Rules of Real-Time Audio

1. **Zero Allocations in the Audio Thread**:
   - The audio callback / processing thread must NEVER allocate or deallocate memory (`Vec::new`, `Vec::push`, `String`, `Box`, `format!`).
   - Pre-allocate ring buffers, FFT analysis buffers, and sample arrays during initialization or engine startup.

2. **Lockless Parameter Modulation & Safe Buffers**:
   - Never take standard blocking locks that contend with UI/worker threads in GStreamer pad probes or DSP callbacks. `auralune_dsp` holds its state mutex only for a single buffer while `prepare()` runs outside the lock and Bypass is lock-free (`AtomicU8`).
   - Use atomic primitives (`AtomicBool`, `AtomicU8`, `AtomicU64`, `crossbeam_utils::atomic::AtomicCell`) for real-time parameter updates, `audio_engine::rt` (`f32_samples`, `map_f32_samples_in_place`, `RateLimiter`) for alignment-checked sample views (never `slice::from_raw_parts`), and `LockExt::lock_safe()` off the hot path.

3. **GStreamer Pipeline Discipline**:
   - Follow GStreamer state transitions carefully: `NULL` -> `READY` -> `PAUSED` -> `PLAYING`.
   - Use `gst_base::BaseTransform::set_passthrough` for EQ/dynamics bypass, rebase the timeline in `pipeline/dsp.rs` when entering DSP from Bypass, and build URIs exclusively via `audio_engine::uri`.
   - Drain bus messages only in `pipeline/bus.rs::poll_events` (driven by the desktop playback ticker).

4. **Underrun Resilience**:
   - Set adaptive ring buffer sizes for low-latency PipeWire output with fallback headroom for ALSA/PulseAudio.
   - Handle audio format conversions explicitly (sample rate, channel layout, float32 vs int16) before feeding DSP algorithms.

5. **Mandatory Pre-Commit DSP Verification**:
   - Never commit DSP or audio changes without running strict formatting, Clippy with all features, and single-threaded tests:
     ```bash
     cargo fmt --all --check
     cargo clippy --workspace --all-targets --all-features -- -D warnings
     cargo test --workspace -- --test-threads=1
     ./tests/run_all_tests.sh
     ```
