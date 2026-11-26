//! Effects processed in pad probes (the GStreamer streaming thread).
//!
//! Probe closures run for every audio buffer, so the real-time rules apply
//! (crates/AGENTS.md, "Real-Time Audio Safety"): configuration is read lock-free from `AtomicCell`,
//! samples are cast through `crate::rt`, and the hot path never allocates or queries caps.

use super::*;

/// Analog saturator (tube / tape): an `identity` element with an F32LE buffer probe.
pub(super) fn build_saturator(
) -> Result<(gst::Element, Arc<AtomicCell<SaturatorConfig>>), AudioEngineError> {
    // 3. Analog saturator (tube / tape) with an F32LE buffer probe
    let saturator = gst::ElementFactory::make("identity")
        .name("analog_saturator")
        .property("silent", true)
        .build()
        .map_err(|_| AudioEngineError::MissingElement("identity"))?;

    // Configuration read lock-free on the streaming thread (AtomicCell; writes are rare and short).
    let saturator_config = Arc::new(AtomicCell::new(domain::dynamics::SaturatorConfig::default()));
    let sat_cfg_clone = Arc::clone(&saturator_config);

    if let Some(src_pad) = saturator.static_pad("src") {
        src_pad.add_probe(gst::PadProbeType::BUFFER, move |_pad, info| {
            let Some(gst::PadProbeData::Buffer(ref mut buffer)) = info.data else {
                return gst::PadProbeReturn::Ok;
            };
            let config = sat_cfg_clone.load();
            if !config.enabled || config.mode == domain::dynamics::SaturatorMode::Off {
                return gst::PadProbeReturn::Ok;
            }
            let buffer_mut = buffer.make_mut();
            if let Ok(mut map) = buffer_mut.map_writable() {
                crate::rt::map_f32_samples_in_place(map.as_mut_slice(), |s| {
                    config.process_sample(s)
                });
            }
            gst::PadProbeReturn::Ok
        });
    }

    Ok((saturator, saturator_config))
}

/// Stereo widener (mid-side matrix): an `identity` element with an F32LE buffer probe.
/// The channel count is tracked from the Caps event; non-stereo streams pass unchanged.
pub(super) fn build_stereo_widener() -> Result<
    (
        gst::Element,
        Arc<AtomicCell<domain::dynamics::StereoWidenerConfig>>,
    ),
    AudioEngineError,
> {
    // 4. Stereo widener (stereo stage) with a native F32LE buffer probe (mid-side matrix)
    let stereo_widener = gst::ElementFactory::make("identity")
        .name("stereo_widener")
        .property("silent", true)
        .build()
        .map_err(|_| AudioEngineError::MissingElement("identity"))?;

    let stereo_widener_config = Arc::new(AtomicCell::new(
        domain::dynamics::StereoWidenerConfig::default(),
    ));
    let widener_cfg_clone = Arc::clone(&stereo_widener_config);

    if let Some(src_pad) = stereo_widener.static_pad("src") {
        // Channel count from the last Caps event (0 = unknown), so caps are not queried
        // on every buffer.
        let channels = Arc::new(AtomicU32::new(0));
        let channels_from_caps = Arc::clone(&channels);
        src_pad.add_probe(gst::PadProbeType::EVENT_DOWNSTREAM, move |_pad, info| {
            if let Some(gst::PadProbeData::Event(ref event)) = info.data {
                if let gst::EventView::Caps(c) = event.view() {
                    let ch = c
                        .caps()
                        .structure(0)
                        .and_then(|s| s.get::<i32>("channels").ok())
                        .unwrap_or(0);
                    channels_from_caps.store(ch.max(0) as u32, Ordering::Relaxed);
                }
            }
            gst::PadProbeReturn::Ok
        });

        src_pad.add_probe(gst::PadProbeType::BUFFER, move |_pad, info| {
            let Some(gst::PadProbeData::Buffer(ref mut buffer)) = info.data else {
                return gst::PadProbeReturn::Ok;
            };
            let config = widener_cfg_clone.load();
            // The stereo widener only processes a 2-channel stereo stream.
            if !config.enabled || config.width <= 0.0 || channels.load(Ordering::Relaxed) != 2 {
                return gst::PadProbeReturn::Ok;
            }
            let buffer_mut = buffer.make_mut();
            if let Ok(mut map) = buffer_mut.map_writable() {
                crate::rt::map_stereo_frames_in_place(map.as_mut_slice(), |l, r| {
                    config.process_frame(l, r)
                });
            }
            gst::PadProbeReturn::Ok
        });
    }

    Ok((stereo_widener, stereo_widener_config))
}

/// Clip detection: read-only F32LE buffer probes that add no element. They share one latch, which
/// sets on the first sample above 0 dBFS and stays set until the host clears it:
///
/// - on the stereo widener's src pad, after the preamp, EQ and dynamics: `bs2b`, which follows,
///   hard-clips its float output to ±1.0, so overs from the preamp or EQ are only visible here;
/// - on rglimiter's sink pad, the signal the limiter receives, which adds ReplayGain boosts.
pub(super) fn install_clip_probes(
    stereo_widener: &gst::Element,
    rglimiter: &gst::Element,
) -> Arc<AtomicBool> {
    let clip_latched = Arc::new(AtomicBool::new(false));
    for (element, pad_name) in [(stereo_widener, "src"), (rglimiter, "sink")] {
        match element.static_pad(pad_name) {
            Some(pad) => add_clip_probe(&pad, Arc::clone(&clip_latched)),
            None => warn!(
                "{} has no {pad_name} pad; clip detection there is unavailable",
                element.name()
            ),
        }
    }
    clip_latched
}

/// While latched the probe returns before mapping, so a clipped stream costs almost nothing.
fn add_clip_probe(pad: &gst::Pad, latch: Arc<AtomicBool>) {
    pad.add_probe(gst::PadProbeType::BUFFER, move |_pad, info| {
        if latch.load(Ordering::Relaxed) {
            return gst::PadProbeReturn::Ok;
        }
        let Some(gst::PadProbeData::Buffer(ref buffer)) = info.data else {
            return gst::PadProbeReturn::Ok;
        };
        let Ok(map) = buffer.map_readable() else {
            return gst::PadProbeReturn::Ok;
        };
        if crate::rt::bytes_exceed_full_scale(map.as_slice()) {
            latch.store(true, Ordering::Relaxed);
        }
        gst::PadProbeReturn::Ok
    });
}
