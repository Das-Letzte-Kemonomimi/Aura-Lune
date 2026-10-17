//! Nieniszczący transkoder formatów audio oparty o GStreamer.
//!
//! ZGODNIE Z ZASADĄ BEZPIECZEŃSTWA:
//! Plik wejściowy jest ZAWSZE tylko odczytywany. Aplikacja nigdy nie modyfikuje
//! ani nie usuwa pliku źródłowego.

use crate::error::AudioEngineError;
use domain::transcode::ExportFormat;
use gst::prelude::*;
use gstreamer as gst;
use std::path::Path;
use tracing::{debug, error, info};

/// Transkoder formatów audio.
pub struct Transcoder;

impl Transcoder {
    /// Konwertuje plik wejściowy do wybranego formatu docelowego.
    ///
    /// Plik źródłowy (`input_path`) pozostaje nienaruszony na dysku.
    pub fn transcode(
        input_path: impl AsRef<Path>,
        output_path: impl AsRef<Path>,
        format: ExportFormat,
    ) -> Result<(), AudioEngineError> {
        let input = input_path.as_ref();
        let output = output_path.as_ref();

        if !input.exists() {
            return Err(AudioEngineError::FileNotFound(input.display().to_string()));
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

        info!(
            "Rozpoczynanie transkodowania: {} -> {} ({})",
            input.display(),
            output.display(),
            format.display_name()
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
                audioresample.link(&opusenc)?;
                opusenc.link(&oggmux)?;
                oggmux.link(&filesink)?;
            }
            ExportFormat::Flac { compression_level } => {
                let flacenc = gst::ElementFactory::make("flacenc")
                    .build()
                    .map_err(|_| AudioEngineError::MissingElement("flacenc"))?;
                flacenc.set_property_from_str("quality", &compression_level.min(8).to_string());

                pipeline.add(&flacenc)?;
                audioresample.link(&flacenc)?;
                flacenc.link(&filesink)?;
            }
            ExportFormat::Wav => {
                let wavenc = gst::ElementFactory::make("wavenc")
                    .build()
                    .map_err(|_| AudioEngineError::MissingElement("wavenc"))?;

                pipeline.add(&wavenc)?;
                audioresample.link(&wavenc)?;
                wavenc.link(&filesink)?;
            }
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
