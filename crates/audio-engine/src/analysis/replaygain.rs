//! Analiza głośności ReplayGain 2.0 (`rganalysis`) i zapis tagów.

use crate::AnalysisError;
use gst::prelude::*;
use gstreamer as gst;
use gstreamer_audio as gst_audio;
use lofty::file::TaggedFileExt;
use serde::{Deserialize, Serialize};

/// Wynik analizy głośności EBU R128 / ReplayGain 2.0 dla utworu.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ReplayGainAnalysisResult {
    /// Wzmocnienie utworu w dB (Track Gain, np. -5.2 dB).
    pub track_gain_db: f64,
    /// Szczytowa amplituda utworu (Track Peak, 1.0 = 0 dBFS).
    pub track_peak: f64,
    /// Poziom referencyjny w dB SPL (domyślnie 89.0 dB SPL).
    pub reference_level_db: f64,
    /// Wzmocnienie albumu w dB jeśli było kalkulowane.
    pub album_gain_db: Option<f64>,
    /// Szczytowa amplituda albumu jeśli była kalkulowana.
    pub album_peak: Option<f64>,
}

/// Przeprowadza pełną, bitowo dokładną analizę głośności EBU R128 / ReplayGain 2.0
/// utworu za pomocą potoku GStreamer `rganalysis` i `fakesink` (ultra-szybka analiza bez czasu rzeczywistego).
pub fn analyze_track_replaygain(
    uri_or_path: &str,
) -> Result<ReplayGainAnalysisResult, AnalysisError> {
    let _ = gst::init();
    let uri = crate::uri::media_uri_checked(uri_or_path)?;

    let pipeline = gst::Pipeline::new();

    let uridecodebin = gst::ElementFactory::make("uridecodebin")
        .property("uri", &uri)
        .build()
        .map_err(|e| format!("Brak uridecodebin: {}", e))?;

    let audioconvert = gst::ElementFactory::make("audioconvert")
        .build()
        .map_err(|e| format!("Brak audioconvert: {}", e))?;

    let audioresample = gst::ElementFactory::make("audioresample")
        .build()
        .map_err(|e| format!("Brak audioresample: {}", e))?;

    let caps = gst_audio::AudioCapsBuilder::new()
        .format(gst_audio::AudioFormat::F32le)
        .rate(44100)
        .channels(2)
        .build();

    let capsfilter = gst::ElementFactory::make("capsfilter")
        .property("caps", &caps)
        .build()
        .map_err(|e| format!("Brak capsfilter: {}", e))?;

    let rganalysis = gst::ElementFactory::make("rganalysis")
        .property("forced", true)
        .property("reference-level", 89.0f64)
        .build()
        .map_err(|e| format!("Brak rganalysis: {}", e))?;

    let fakesink = gst::ElementFactory::make("fakesink")
        .property("sync", false)
        .build()
        .map_err(|e| format!("Brak fakesink: {}", e))?;

    pipeline
        .add_many([
            &uridecodebin,
            &audioconvert,
            &audioresample,
            &capsfilter,
            &rganalysis,
            &fakesink,
        ])
        .map_err(|e| format!("Błąd dodawania elementów: {}", e))?;

    gst::Element::link_many([
        &audioconvert,
        &audioresample,
        &capsfilter,
        &rganalysis,
        &fakesink,
    ])
    .map_err(|e| format!("Błąd linkowania: {}", e))?;

    let convert_sink_pad = audioconvert
        .static_pad("sink")
        .ok_or_else(|| "Brak sink pad w audioconvert".to_string())?;

    uridecodebin.connect_pad_added(move |_bin, src_pad| {
        if convert_sink_pad.is_linked() {
            return;
        }
        let pad_caps = src_pad
            .current_caps()
            .unwrap_or_else(|| src_pad.query_caps(None));
        let is_audio = pad_caps
            .structure(0)
            .is_some_and(|s| s.name().starts_with("audio/"));

        if is_audio {
            let _ = src_pad.link(&convert_sink_pad);
        }
    });

    pipeline
        .set_state(gst::State::Playing)
        .map_err(|e| format!("Błąd uruchomienia pipeline: {:?}", e))?;

    let bus = pipeline.bus().ok_or("Brak busa w potoku")?;
    let mut track_gain = None;
    let mut track_peak = None;
    let mut ref_level = 89.0;
    let mut album_gain = None;
    let mut album_peak = None;

    let start_time = std::time::Instant::now();
    loop {
        if start_time.elapsed() > std::time::Duration::from_secs(60) {
            let _ = pipeline.set_state(gst::State::Null);
            return Err("Przekroczono limit czasu analizy ReplayGain (60s)".into());
        }

        if let Some(msg) = bus.timed_pop(gst::ClockTime::from_mseconds(100)) {
            match msg.view() {
                gst::MessageView::Tag(tag_msg) => {
                    let tags = tag_msg.tags();
                    if let Some(g) = tags.get::<gst::tags::TrackGain>() {
                        track_gain = Some(g.get());
                    }
                    if let Some(p) = tags.get::<gst::tags::TrackPeak>() {
                        track_peak = Some(p.get());
                    }
                    if let Some(r) = tags.get::<gst::tags::ReferenceLevel>() {
                        ref_level = r.get();
                    }
                    if let Some(ag) = tags.get::<gst::tags::AlbumGain>() {
                        album_gain = Some(ag.get());
                    }
                    if let Some(ap) = tags.get::<gst::tags::AlbumPeak>() {
                        album_peak = Some(ap.get());
                    }
                }
                gst::MessageView::Eos(..) => {
                    break;
                }
                gst::MessageView::Error(err) => {
                    let _ = pipeline.set_state(gst::State::Null);
                    return Err(format!("Błąd analizy potoku audio: {}", err.error()).into());
                }
                _ => {}
            }
        }
    }

    let _ = pipeline.set_state(gst::State::Null);

    let gain = track_gain.unwrap_or(0.0);
    let peak = track_peak.unwrap_or(1.0);

    Ok(ReplayGainAnalysisResult {
        track_gain_db: gain,
        track_peak: peak,
        reference_level_db: ref_level,
        album_gain_db: album_gain,
        album_peak,
    })
}

/// Zapisuje obliczone tagi ReplayGain (Track Gain i Track Peak) bezpośrednio do pliku audio.
pub fn write_replaygain_tags_to_file(
    path: &str,
    gain: f64,
    peak: f64,
) -> Result<(), AnalysisError> {
    use lofty::config::WriteOptions;
    use lofty::file::AudioFile;
    use lofty::probe::Probe;
    use lofty::tag::{ItemKey, ItemValue, TagItem};

    let mut tagged_file = Probe::open(path)
        .map_err(|e| AnalysisError::Tags(format!("Błąd otwarcia pliku: {}", e)))?
        .read()
        .map_err(|e| AnalysisError::Tags(format!("Błąd odczytu tagów: {}", e)))?;

    let tag = match tagged_file.primary_tag_mut() {
        Some(primary) => primary,
        None => {
            if let Some(first) = tagged_file.first_tag_mut() {
                first
            } else {
                return Err(AnalysisError::Tags(
                    "Brak obsługiwanego kontenera tagów w pliku audio".into(),
                ));
            }
        }
    };

    tag.insert(TagItem::new(
        ItemKey::ReplayGainTrackGain,
        ItemValue::Text(format!("{:.2} dB", gain)),
    ));
    tag.insert(TagItem::new(
        ItemKey::ReplayGainTrackPeak,
        ItemValue::Text(format!("{:.6}", peak)),
    ));

    tagged_file
        .save_to_path(path, WriteOptions::default())
        .map_err(|e| AnalysisError::Tags(format!("Błąd zapisu tagów do pliku {}: {}", path, e)))?;
    Ok(())
}
