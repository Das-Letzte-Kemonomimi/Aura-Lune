//! Decodes tracks to `f32` PCM samples for analysis and separation.
//!
//! Every decoder uses one [`DecodeSession`]
//! (`uridecodebin → audioconvert → audioresample → appsink`). Samples are pulled with a
//! timeout and the bus is checked for errors, so a corrupt file or a missing codec
//! ends decoding with an error instead of blocking the analysis thread forever.

use crate::AnalysisError;
use gst::prelude::*;
use gstreamer as gst;
use gstreamer_app as gst_app;
use gstreamer_audio as gst_audio;
use std::time::{Duration, Instant};

/// Sample rate of the signal returned by [`decode_snippet_for_analysis`].
pub const ANALYSIS_SAMPLE_RATE: u32 = 22_050;

/// Sample rate of the signal returned by [`decode_stereo_for_stems`].
pub const STEMS_SAMPLE_RATE: u32 = 44_100;

/// How long to wait for a single buffer before checking the bus and the timeout.
const PULL_TIMEOUT: Duration = Duration::from_millis(100);

/// Why [`DecodeSession::run`] ended.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum DecodeEnd {
    /// The whole file was decoded.
    Eos,
    /// The caller asked to stop (enough samples collected).
    Stopped,
    /// The decode timeout was exceeded.
    TimedOut,
    /// The decoder reported an error (corrupt file, missing codec, missing file).
    Failed(String),
}

/// Pipeline decoding a file to interleaved `f32` samples at a given sample rate and channel count.
/// On drop the pipeline is always set to `Null`.
pub(super) struct DecodeSession {
    pipeline: gst::Pipeline,
    appsink: gst_app::AppSink,
}

impl DecodeSession {
    pub(super) fn open(uri_or_path: &str, rate: u32, channels: u32) -> Result<Self, AnalysisError> {
        let _ = gst::init();
        let uri = crate::uri::media_uri_checked(uri_or_path)?;
        let make = |name: &str| {
            gst::ElementFactory::make(name)
                .build()
                .map_err(|e| format!("Missing GStreamer element {name}: {e}"))
        };

        let pipeline = gst::Pipeline::new();
        let uridecodebin = gst::ElementFactory::make("uridecodebin")
            .property("uri", &uri)
            .build()
            .map_err(|e| format!("Missing uridecodebin: {e}"))?;
        let audioconvert = make("audioconvert")?;
        let audioresample = make("audioresample")?;
        let caps = gst_audio::AudioCapsBuilder::new()
            .format(gst_audio::AudioFormat::F32le)
            .rate(rate as i32)
            .channels(channels as i32)
            .build();
        let capsfilter = gst::ElementFactory::make("capsfilter")
            .property("caps", &caps)
            .build()
            .map_err(|e| format!("Missing capsfilter: {e}"))?;
        let appsink = gst_app::AppSink::builder()
            .caps(&caps)
            .property("sync", false)
            .max_buffers(2000)
            .drop(false)
            .build();

        pipeline
            .add_many([
                &uridecodebin,
                &audioconvert,
                &audioresample,
                &capsfilter,
                appsink.upcast_ref(),
            ])
            .map_err(|e| format!("Failed to add elements to the pipeline: {e}"))?;
        gst::Element::link_many([
            &audioconvert,
            &audioresample,
            &capsfilter,
            appsink.upcast_ref(),
        ])
        .map_err(|e| format!("Failed to link elements: {e}"))?;

        let convert_sink_pad = audioconvert
            .static_pad("sink")
            .ok_or_else(|| "audioconvert has no sink pad".to_string())?;
        uridecodebin.connect_pad_added(move |_bin, src_pad| {
            if convert_sink_pad.is_linked() {
                return;
            }
            let caps = src_pad
                .current_caps()
                .unwrap_or_else(|| src_pad.query_caps(None));
            if let Some(structure) = caps.structure(0) {
                if structure.name().starts_with("audio/") {
                    let _ = src_pad.link(&convert_sink_pad);
                }
            }
        });

        let session = Self { pipeline, appsink };
        session
            .pipeline
            .set_state(gst::State::Playing)
            .map_err(|e| format!("Failed to start the decoder: {e}"))?;
        Ok(session)
    }

    /// Passes successive buffers (interleaved `f32` samples) to `on_chunk` while it returns
    /// `true` and the decoder has not finished the file, reported an error or exceeded `max_wait`.
    pub(super) fn run(
        &self,
        max_wait: Duration,
        mut on_chunk: impl FnMut(&[f32]) -> bool,
    ) -> DecodeEnd {
        let start = Instant::now();
        let bus = self.pipeline.bus();
        let mut unaligned = Vec::new();
        loop {
            if let Some(err) = bus
                .as_ref()
                .and_then(|b| b.pop_filtered(&[gst::MessageType::Error]))
            {
                if let gst::MessageView::Error(e) = err.view() {
                    return DecodeEnd::Failed(e.error().to_string());
                }
            }
            if start.elapsed() >= max_wait {
                return DecodeEnd::TimedOut;
            }
            let Some(sample) = self.appsink.try_pull_sample(gst::ClockTime::from_mseconds(
                PULL_TIMEOUT.as_millis() as u64,
            )) else {
                if self.appsink.is_eos() {
                    return DecodeEnd::Eos;
                }
                continue;
            };
            let Some(buffer) = sample.buffer() else {
                continue;
            };
            let Ok(map) = buffer.map_readable() else {
                continue;
            };
            // Alignment-checked cast; an unaligned buffer is copied.
            let samples = match crate::rt::f32_samples(map.as_slice()) {
                Some(s) => s,
                None => {
                    unaligned.clear();
                    crate::rt::extend_f32_samples(map.as_slice(), &mut unaligned);
                    &unaligned
                }
            };
            if !on_chunk(samples) {
                return DecodeEnd::Stopped;
            }
        }
    }
}

impl Drop for DecodeSession {
    fn drop(&mut self) {
        let _ = self.pipeline.set_state(gst::State::Null);
    }
}

/// Turns a decoder error into an `AnalysisError` when no samples were collected.
pub(super) fn finish<T>(
    collected_any: bool,
    end: DecodeEnd,
    value: T,
    what: &str,
) -> Result<T, AnalysisError> {
    if collected_any {
        if let DecodeEnd::Failed(e) = &end {
            tracing::warn!("Decoding ({what}) stopped by an error part-way through the file: {e}");
        }
        return Ok(value);
    }
    Err(match end {
        DecodeEnd::Failed(e) => format!("Failed to decode ({what}): {e}").into(),
        DecodeEnd::TimedOut => format!("Timed out decoding ({what})").into(),
        _ => format!("No audio samples ({what})").into(),
    })
}

/// Decodes a representative part of a track into memory (mono, 22050 Hz F32LE).
/// The decode timeout grows with the snippet length: `max(6 s, max_duration_sec / 10)`.
/// When the timeout is exceeded a partial result is returned (with a warning in the log).
pub fn decode_snippet_for_analysis(
    uri_or_path: &str,
    max_duration_sec: f64,
) -> Result<Vec<f32>, AnalysisError> {
    decode_mono_22k(
        uri_or_path,
        max_duration_sec,
        analysis_timeout(max_duration_sec),
    )
}

/// Like [`decode_snippet_for_analysis`], but exceeding the timeout after collecting some samples
/// is an error: for cached results, which must not be truncated.
pub fn decode_complete_for_analysis(
    uri_or_path: &str,
    max_duration_sec: f64,
) -> Result<Vec<f32>, AnalysisError> {
    let session = DecodeSession::open(uri_or_path, ANALYSIS_SAMPLE_RATE, 1)?;
    let target = (max_duration_sec * ANALYSIS_SAMPLE_RATE as f64).round() as usize;
    let mut collected: Vec<f32> =
        Vec::with_capacity(target.min(ANALYSIS_SAMPLE_RATE as usize * 600));
    let end = session.run(analysis_timeout(max_duration_sec), |chunk| {
        let room = target.saturating_sub(collected.len());
        collected.extend_from_slice(&chunk[..chunk.len().min(room)]);
        collected.len() < target
    });
    if end == DecodeEnd::TimedOut && !collected.is_empty() {
        return Err("Timed out decoding the track for analysis".into());
    }
    let any = !collected.is_empty();
    finish(any, end, collected, "mono")
}

fn analysis_timeout(max_duration_sec: f64) -> Duration {
    Duration::from_secs_f64((max_duration_sec / 10.0).max(6.0))
}

/// Decodes up to `max_duration_sec` seconds of a track (mono, [`ANALYSIS_SAMPLE_RATE`] Hz, F32LE),
/// spending at most `max_wait` on decoding.
pub(super) fn decode_mono_22k(
    uri_or_path: &str,
    max_duration_sec: f64,
    max_wait: Duration,
) -> Result<Vec<f32>, AnalysisError> {
    let session = DecodeSession::open(uri_or_path, ANALYSIS_SAMPLE_RATE, 1)?;
    let target = (max_duration_sec * ANALYSIS_SAMPLE_RATE as f64).round() as usize;
    let mut collected: Vec<f32> =
        Vec::with_capacity(target.min(ANALYSIS_SAMPLE_RATE as usize * 600));
    let end = session.run(max_wait, |chunk| {
        let room = target.saturating_sub(collected.len());
        collected.extend_from_slice(&chunk[..chunk.len().min(room)]);
        collected.len() < target
    });
    if end == DecodeEnd::TimedOut && !collected.is_empty() {
        tracing::warn!(
            "Decoding for analysis stopped by the timeout; used {} s of audio",
            collected.len() / ANALYSIS_SAMPLE_RATE as usize
        );
    }
    let any = !collected.is_empty();
    finish(any, end, collected, "mono")
}

/// Decodes a track to full-band stereo ([`STEMS_SAMPLE_RATE`] Hz, F32LE, L and R channels)
/// for stem separation (HPSS / AI Neural).
pub fn decode_stereo_for_stems(
    uri_or_path: &str,
    max_duration_sec: f64,
) -> Result<(Vec<f32>, Vec<f32>, u32), AnalysisError> {
    let session = DecodeSession::open(uri_or_path, STEMS_SAMPLE_RATE, 2)?;
    let target = (max_duration_sec * STEMS_SAMPLE_RATE as f64).round() as usize;
    let capacity = target.min(STEMS_SAMPLE_RATE as usize * 600);
    let mut left: Vec<f32> = Vec::with_capacity(capacity);
    let mut right: Vec<f32> = Vec::with_capacity(capacity);
    // Stems are cached permanently, so interrupted decoding (timeout, error half-way through the
    // file) is an error, not a shorter result. The timeout grows with the snippet length.
    let max_wait = Duration::from_secs_f64((max_duration_sec / 3.0).max(30.0));
    let end = session.run(max_wait, |chunk| {
        for frame in chunk.as_chunks::<2>().0 {
            if left.len() >= target {
                return false;
            }
            left.push(frame[0]);
            right.push(frame[1]);
        }
        left.len() < target
    });
    match end {
        DecodeEnd::TimedOut if !left.is_empty() => {
            return Err("Timed out decoding the track for stem separation".into());
        }
        DecodeEnd::Failed(e) if !left.is_empty() => {
            return Err(format!("Decoding for stem separation stopped by an error: {e}").into());
        }
        DecodeEnd::Stopped => tracing::warn!(
            "Track longer than {max_duration_sec} s; the stems cover only its beginning"
        ),
        _ => {}
    }
    let any = !left.is_empty();
    finish(any, end, (left, right, STEMS_SAMPLE_RATE), "stereo")
}
