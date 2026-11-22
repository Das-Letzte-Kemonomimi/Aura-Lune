//! Efekty przetwarzane w sondach padów (wątek strumieniowy GStreamera).
//!
//! Kod w zamknięciach sond wykonuje się dla każdego bufora audio, więc obowiązują zasady
//! czasu rzeczywistego (AGENTS.md §7.1): konfiguracja czytana z `AtomicCell` bez blokad,
//! rzutowanie próbek przez `crate::rt`, brak alokacji i zapytań o caps w gorącej ścieżce.

use super::*;

/// Saturator analogowy (lampa elektronowa / taśma): element `identity` z sondą bufora F32LE.
pub(super) fn build_saturator(
) -> Result<(gst::Element, Arc<AtomicCell<SaturatorConfig>>), AudioEngineError> {
    // 3. Saturator analogowy (lampa elektronowa / taśma) z sondą bufora F32LE
    let saturator = gst::ElementFactory::make("identity")
        .name("analog_saturator")
        .property("silent", true)
        .build()
        .map_err(|_| AudioEngineError::MissingElement("identity"))?;

    // Konfiguracja czytana w wątku strumieniowym bez blokad (AtomicCell; zapis jest rzadki i krótki).
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

/// Stereo Widener (Mid-Side Matrix): element `identity` z sondą bufora F32LE.
/// Liczba kanałów jest śledzona ze zdarzenia Caps; inne niż stereo strumienie przechodzą bez zmian.
pub(super) fn build_stereo_widener() -> Result<
    (
        gst::Element,
        Arc<AtomicCell<domain::dynamics::StereoWidenerConfig>>,
    ),
    AudioEngineError,
> {
    // 4. Stereo Widener (baza stereo / Stereo Stage) z natywną sondą bufora F32LE (Mid-Side Matrix)
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
        // Liczba kanałów z ostatniego zdarzenia Caps (0 = nieznana) — bez odpytywania caps
        // przy każdym buforze.
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
            // Stereo Widener przetwarza wyłącznie 2-kanałowy strumień stereo.
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
