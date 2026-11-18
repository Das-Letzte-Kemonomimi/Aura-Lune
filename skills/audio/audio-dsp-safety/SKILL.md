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

2. **Lockless Parameter Modulation**:
   - Never take standard blocking locks (`std::sync::Mutex`, `RwLock`) in the real-time audio thread where UI or worker threads could cause priority inversion or lock contention.
   - Use atomic primitives (`AtomicBool`, `AtomicU32`, `portable_atomic::AtomicF32`) or bounded lock-free channels (e.g. `crossbeam-channel` or `rtrb`) for parameter updates.

3. **GStreamer Pipeline Discipline**:
   - Follow GStreamer state transitions carefully: `NULL` -> `READY` -> `PAUSED` -> `PLAYING`.
   - Dynamic element re-linking (such as swapping between Rubber Band and SoundTouch or inserting an equalizer bin) must be done with pads blocked or during paused state to prevent pipeline stalls.
   - Always process bus messages asynchronously on the glib main loop or via dedicated polling tasks.

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
