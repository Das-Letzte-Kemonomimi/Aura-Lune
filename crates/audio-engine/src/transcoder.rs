//! Nieniszczący transkoder formatów audio oparty o GStreamer z obsługą efektów DSP.
//!
//! ZGODNIE Z ZASADĄ BEZPIECZEŃSTWA:
//! Plik wejściowy jest ZAWSZE tylko odczytywany. Aplikacja nigdy nie modyfikuje
//! ani nie usuwa pliku źródłowego.

use crate::error::AudioEngineError;
use domain::transcode::{DspExportSettings, ExportFormat, TimeRange};
use gst::prelude::*;
use gstreamer as gst;
use std::path::Path;
use tracing::{debug, error, info};

/// Transkoder formatów audio.
pub struct Transcoder;

impl Transcoder {
    /// Konwertuje plik wejściowy do wybranego formatu docelowego (bez modyfikacji DSP i całego utworu).
    ///
    /// Plik źródłowy (`input_path`) pozostaje nienaruszony na dysku.
    pub fn transcode(
        input_path: impl AsRef<Path>,
        output_path: impl AsRef<Path>,
        format: ExportFormat,
    ) -> Result<(), AudioEngineError> {
        Self::transcode_with_dsp(input_path, output_path, format, None, None)
    }

    /// Konwertuje wycinek czasowy (markery A-B) pliku wejściowego do formatu docelowego.
    pub fn transcode_range(
        input_path: impl AsRef<Path>,
        output_path: impl AsRef<Path>,
        format: ExportFormat,
        time_range: &TimeRange,
    ) -> Result<(), AudioEngineError> {
        Self::transcode_with_dsp(input_path, output_path, format, None, Some(time_range))
    }

    /// Konwertuje plik wejściowy do wybranego formatu docelowego z opcjonalnym nałożeniem parametrów DSP
    /// (pitch shift, time stretch/tempo, rate/varispeed, equalizer, reverb) oraz opcjonalnym wycięciem
    /// fragmentu czasowego (markery A i B).
    ///
    /// Plik źródłowy (`input_path`) pozostaje ZAWSZE nienaruszony na dysku.
    pub fn transcode_with_dsp(
        input_path: impl AsRef<Path>,
        output_path: impl AsRef<Path>,
        format: ExportFormat,
        dsp_settings: Option<&DspExportSettings>,
        time_range: Option<&TimeRange>,
    ) -> Result<(), AudioEngineError> {
        let input = input_path.as_ref();
        let output = output_path.as_ref();

        if !input.exists() {
            return Err(AudioEngineError::FileNotFound(input.display().to_string()));
        }

        if let Some(range) = time_range {
            if let Some(end) = range.end_ms {
                if end <= range.start_ms {
                    return Err(AudioEngineError::ElementLink(
                        "Czas końcowy (Marker B) musi być większy niż czas początkowy (Marker A)"
                            .into(),
                    ));
                }
            }
        }

        let input_canonical = input.canonicalize()?;
        if let Ok(output_canonical) = output.canonicalize() {
            if input_canonical == output_canonical {
                return Err(AudioEngineError::ElementLink(
                    "Ścieżka pliku wyjściowego nie może być tożsama z plikiem wejściowym".into(),
                ));
            }
        }

        gst::init()?;

        let dsp_active = dsp_settings.is_some_and(|s| s.is_active());
        let range_active = time_range.is_some_and(|r| r.is_active());
        info!(
            "Rozpoczynanie transkodowania: {} -> {} ({}) [DSP aktywne: {}, Zakres A-B aktywny: {}]",
            input.display(),
            output.display(),
            format.display_name(),
            dsp_active,
            range_active
        );

        let pipeline = gst::Pipeline::with_name("auralune-transcoder-pipeline");

        let filesrc = gst::ElementFactory::make("filesrc")
            .property("location", input.to_str().unwrap_or_default())
            .build()
            .map_err(|_| AudioEngineError::MissingElement("filesrc"))?;

        let decodebin = gst::ElementFactory::make("decodebin")
            .build()
            .map_err(|_| AudioEngineError::MissingElement("decodebin"))?;

        let audioconvert = gst::ElementFactory::make("audioconvert")
            .build()
            .map_err(|_| AudioEngineError::MissingElement("audioconvert"))?;

        let audioresample = gst::ElementFactory::make("audioresample")
            .build()
            .map_err(|_| AudioEngineError::MissingElement("audioresample"))?;

        let filesink = gst::ElementFactory::make("filesink")
            .property("location", output.to_str().unwrap_or_default())
            .build()
            .map_err(|_| AudioEngineError::MissingElement("filesink"))?;

        pipeline.add_many([
            &filesrc,
            &decodebin,
            &audioconvert,
            &audioresample,
            &filesink,
        ])?;
        filesrc.link(&decodebin)?;

        // Połączenie wyjścia decodebin -> audioconvert po wykryciu padu audio
        let convert_sink_pad = audioconvert
            .static_pad("sink")
            .ok_or_else(|| AudioEngineError::MissingElement("audioconvert.sink"))?;

        decodebin.connect_pad_added(move |_bin, src_pad| {
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

        audioconvert.link(&audioresample)?;

        // Opcjonalny tor przetwarzania DSP (Pitch, Tempo, Rate, Reverb, EQ)
        let source_for_encoder = if let Some(dsp) = dsp_settings.filter(|s| s.is_active()) {
            let caps_f32 = gst::Caps::builder("audio/x-raw")
                .field("format", "F32LE")
                .build();
            let capsfilter_dsp = gst::ElementFactory::make("capsfilter")
                .property("caps", &caps_f32)
                .build()
                .map_err(|_| AudioEngineError::MissingElement("capsfilter"))?;

            let pitch_scale = (2.0f32).powf(dsp.pitch_semitones as f32 / 12.0f32);
            let pitch_elem = gst::ElementFactory::make("pitch")
                .property("pitch", pitch_scale)
                .property("tempo", dsp.tempo_ratio as f32)
                .property("rate", dsp.rate_ratio as f32)
                .build()
                .map_err(|_| AudioEngineError::MissingElement("pitch"))?;

            let audioconvert_post = gst::ElementFactory::make("audioconvert")
                .build()
                .map_err(|_| AudioEngineError::MissingElement("audioconvert"))?;

            pipeline.add_many([&capsfilter_dsp, &pitch_elem, &audioconvert_post])?;
            audioresample.link(&capsfilter_dsp)?;
            capsfilter_dsp.link(&pitch_elem)?;

            let mut last_elem = pitch_elem;

            // Freeverb
            if dsp.reverb_level > 0.001 {
                if let Ok(freeverb) = gst::ElementFactory::make("freeverb")
                    .property("level", dsp.reverb_level)
                    .property("room-size", 0.5f32)
                    .property("damping", 0.2f32)
                    .property("width", 1.0f32)
                    .build()
                {
                    pipeline.add(&freeverb)?;
                    last_elem.link(&freeverb)?;
                    last_elem = freeverb;
                }
            }

            // Equalizer 10-bands
            if let Some(ref bands) = dsp.eq_bands {
                if let Ok(eq) = gst::ElementFactory::make("equalizer-10bands").build() {
                    for (i, &gain) in bands.iter().take(10).enumerate() {
                        let prop = format!("band{}", i);
                        eq.set_property(&prop, gain);
                    }
                    pipeline.add(&eq)?;
                    last_elem.link(&eq)?;
                    last_elem = eq;
                }
            }

            last_elem.link(&audioconvert_post)?;
            audioconvert_post
        } else {
            audioresample
        };

        // W zależności od formatu docelowego dodajemy odpowiedni encoder i opcjonalny muxer
        match format {
            ExportFormat::Opus { bitrate_kbps } => {
                let opusenc = gst::ElementFactory::make("opusenc")
                    .property("bitrate", (bitrate_kbps * 1000) as i32)
                    .build()
                    .map_err(|_| AudioEngineError::MissingElement("opusenc"))?;

                let oggmux = gst::ElementFactory::make("oggmux")
                    .build()
                    .map_err(|_| AudioEngineError::MissingElement("oggmux"))?;

                pipeline.add_many([&opusenc, &oggmux])?;
                source_for_encoder.link(&opusenc)?;
                opusenc.link(&oggmux)?;
                oggmux.link(&filesink)?;
            }
            ExportFormat::Flac { compression_level } => {
                let flacenc = gst::ElementFactory::make("flacenc")
                    .build()
                    .map_err(|_| AudioEngineError::MissingElement("flacenc"))?;
                flacenc.set_property_from_str("quality", &compression_level.min(8).to_string());

                pipeline.add(&flacenc)?;
                source_for_encoder.link(&flacenc)?;
                flacenc.link(&filesink)?;
            }
            ExportFormat::Wav => {
                let wavenc = gst::ElementFactory::make("wavenc")
                    .build()
                    .map_err(|_| AudioEngineError::MissingElement("wavenc"))?;

                pipeline.add(&wavenc)?;
                source_for_encoder.link(&wavenc)?;
                wavenc.link(&filesink)?;
            }
        }

        // Jeśli zdefiniowano zakres czasowy A-B, wpierw inicjalizujemy stan Paused (preroll),
        // po czym wykonujemy dokładny seek do punktu A z warunkiem stop w punkcie B.
        if let Some(range) = time_range.filter(|r| r.is_active()) {
            pipeline.set_state(gst::State::Paused)?;
            let (state_change, cur_state, _) = pipeline.state(gst::ClockTime::from_seconds(5));
            if state_change.is_err() || cur_state != gst::State::Paused {
                let _ = pipeline.set_state(gst::State::Null);
                return Err(AudioEngineError::ElementLink(
                    "Nie udało się zainicjalizować potoku do stanu Paused przed seekiem A-B".into(),
                ));
            }

            let start = gst::ClockTime::from_mseconds(range.start_ms);
            let (stop_type, stop) = match range.end_ms {
                Some(end) => (gst::SeekType::Set, Some(gst::ClockTime::from_mseconds(end))),
                None => (gst::SeekType::None, gst::ClockTime::NONE),
            };

            pipeline.seek(
                1.0,
                gst::SeekFlags::FLUSH | gst::SeekFlags::ACCURATE,
                gst::SeekType::Set,
                start,
                stop_type,
                stop,
            )?;
        }

        // Uruchomienie potoku i oczekiwanie na zakończenie (EOS) lub błąd
        pipeline.set_state(gst::State::Playing)?;

        let bus = pipeline.bus().ok_or_else(|| {
            AudioEngineError::ElementLink("Brak magistrali potoku transkodera".into())
        })?;

        for msg in bus.iter_timed(gst::ClockTime::NONE) {
            use gst::MessageView;
            match msg.view() {
                MessageView::Eos(..) => {
                    debug!("Transkodowanie ukończone pomyślnie (EOS)");
                    break;
                }
                MessageView::Error(err) => {
                    let err_msg =
                        format!("Błąd transkodowania: {} ({:?})", err.error(), err.debug());
                    error!("{}", err_msg);
                    let _ = pipeline.set_state(gst::State::Null);
                    return Err(AudioEngineError::ElementLink(err_msg));
                }
                _ => {}
            }
        }

        pipeline.set_state(gst::State::Null)?;
        info!("Plik przekonwertowany i zapisany: {}", output.display());
        Ok(())
    }
}
