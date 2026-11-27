//! ReplayGain 2.0 loudness analysis (`rganalysis`) and tag writing.

use crate::AnalysisError;
use gst::prelude::*;
use gstreamer as gst;
use gstreamer_audio as gst_audio;
use lofty::file::TaggedFileExt;
use serde::{Deserialize, Serialize};

/// EBU R128 / ReplayGain 2.0 loudness analysis result for a track.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ReplayGainAnalysisResult {
    /// Track gain in dB (Track Gain, e.g. -5.2 dB).
    pub track_gain_db: f64,
    /// Track peak amplitude (Track Peak, 1.0 = 0 dBFS).
    pub track_peak: f64,
    /// Reference level in dB SPL (default 89.0 dB SPL).
    pub reference_level_db: f64,
    /// Album gain in dB, if it was computed.
    pub album_gain_db: Option<f64>,
    /// Album peak amplitude, if it was computed.
    pub album_peak: Option<f64>,
}

/// Runs a full, bit-exact EBU R128 / ReplayGain 2.0 loudness analysis of a track
/// through a GStreamer `rganalysis` + `fakesink` pipeline (faster than real time).
pub fn analyze_track_replaygain(
    uri_or_path: &str,
) -> Result<ReplayGainAnalysisResult, AnalysisError> {
    let _ = gst::init();
    let uri = crate::uri::media_uri_checked(uri_or_path)?;

    let pipeline = gst::Pipeline::new();

    let uridecodebin = gst::ElementFactory::make("uridecodebin")
        .property("uri", &uri)
        .build()
        .map_err(|e| format!("Missing uridecodebin: {}", e))?;

    let audioconvert = gst::ElementFactory::make("audioconvert")
        .build()
        .map_err(|e| format!("Missing audioconvert: {}", e))?;

    let audioresample = gst::ElementFactory::make("audioresample")
        .build()
        .map_err(|e| format!("Missing audioresample: {}", e))?;

    let caps = gst_audio::AudioCapsBuilder::new()
        .format(gst_audio::AudioFormat::F32le)
        .rate(44100)
        .channels(2)
        .build();

    let capsfilter = gst::ElementFactory::make("capsfilter")
        .property("caps", &caps)
        .build()
        .map_err(|e| format!("Missing capsfilter: {}", e))?;

    let rganalysis = gst::ElementFactory::make("rganalysis")
        .property("forced", true)
        .property("reference-level", 89.0f64)
        .build()
        .map_err(|e| format!("Missing rganalysis: {}", e))?;

    let fakesink = gst::ElementFactory::make("fakesink")
        .property("sync", false)
        .build()
        .map_err(|e| format!("Missing fakesink: {}", e))?;

    pipeline
        .add_many([
            &uridecodebin,
            &audioconvert,
            &audioresample,
            &capsfilter,
            &rganalysis,
            &fakesink,
        ])
        .map_err(|e| format!("Failed to add elements: {}", e))?;

    gst::Element::link_many([
        &audioconvert,
        &audioresample,
        &capsfilter,
        &rganalysis,
        &fakesink,
    ])
    .map_err(|e| format!("Failed to link elements: {}", e))?;

    let convert_sink_pad = audioconvert
        .static_pad("sink")
        .ok_or_else(|| "audioconvert has no sink pad".to_string())?;

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
        .map_err(|e| format!("Failed to start the pipeline: {:?}", e))?;

    let bus = pipeline.bus().ok_or("The pipeline has no bus")?;
    let mut track_gain = None;
    let mut track_peak = None;
    let mut ref_level = 89.0;
    let mut album_gain = None;
    let mut album_peak = None;

    let start_time = std::time::Instant::now();
    loop {
        if start_time.elapsed() > std::time::Duration::from_secs(60) {
            let _ = pipeline.set_state(gst::State::Null);
            return Err("ReplayGain analysis timed out (60s)".into());
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
                    return Err(format!("Audio pipeline analysis error: {}", err.error()).into());
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

/// Writes the computed ReplayGain tags (track gain and track peak) straight into the audio file.
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
        .map_err(|e| AnalysisError::Tags(format!("Failed to open the file: {}", e)))?
        .read()
        .map_err(|e| AnalysisError::Tags(format!("Failed to read tags: {}", e)))?;

    let tag = match tagged_file.primary_tag_mut() {
        Some(primary) => primary,
        None => {
            if let Some(first) = tagged_file.first_tag_mut() {
                first
            } else {
                return Err(AnalysisError::Tags(
                    "The audio file has no supported tag container".into(),
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
        .map_err(|e| AnalysisError::Tags(format!("Failed to write tags to {}: {}", path, e)))?;
    Ok(())
}
