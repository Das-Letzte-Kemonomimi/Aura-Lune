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
use tracing::{debug, error, info, warn};

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
        Self::transcode_with_dsp_and_progress(
            input_path,
            output_path,
            format,
            dsp_settings,
            time_range,
            None::<fn(f64, u64, u64)>,
        )
    }

    /// Wersja z raportowaniem postępu transkodowania w czasie rzeczywistym (wywołanie callbacku co ~150 ms).
    pub fn transcode_with_dsp_and_progress<F>(
        input_path: impl AsRef<Path>,
        output_path: impl AsRef<Path>,
        format: ExportFormat,
        dsp_settings: Option<&DspExportSettings>,
        time_range: Option<&TimeRange>,
        progress_cb: Option<F>,
    ) -> Result<(), AudioEngineError>
    where
        F: Fn(f64, u64, u64) + Send + 'static,
    {
        let input_raw = input_path.as_ref();
        let input_buf;
        let input = if let Some(path_str) = input_raw.to_str() {
            if path_str.starts_with("file://") {
                if let Ok((p, _)) = glib::filename_from_uri(path_str) {
                    input_buf = p;
                    input_buf.as_path()
                } else {
                    let stripped = path_str.trim_start_matches("file://");
                    input_buf = std::path::PathBuf::from(stripped);
                    input_buf.as_path()
                }
            } else {
                input_raw
            }
        } else {
            input_raw
        };
        let output_raw = output_path.as_ref();
        let output_buf;
        let output = if let Some(path_str) = output_raw.to_str() {
            if path_str.starts_with("file://") {
                if let Ok((p, _)) = glib::filename_from_uri(path_str) {
                    output_buf = p;
                    output_buf.as_path()
                } else {
                    let stripped = path_str.trim_start_matches("file://");
                    output_buf = std::path::PathBuf::from(stripped);
                    output_buf.as_path()
                }
            } else {
                output_raw
            }
        } else {
            output_raw
        };

        if let Some(parent) = output.parent() {
            if !parent.as_os_str().is_empty() {
                let _ = std::fs::create_dir_all(parent);
            }
        }

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

            let _ = crate::dsp_node::register_dsp_element();

            let selected_engine = match dsp.engine.as_deref() {
                Some("SoundTouch") | Some("soundtouch") => dsp_api::DspEngine::SoundTouch,
                _ => dsp_api::DspEngine::RubberBand,
            };

            info!(
                "Transkoder: Inicjalizacja procesora DSP {:?} (tempo={}, pitch={}, rate={})",
                selected_engine, dsp.tempo_ratio, dsp.pitch_semitones, dsp.rate_ratio
            );

            let dsp_elem = crate::dsp_node::AuraluneDsp::new(Some("transcoder_dsp"));
            let dsp_params = dsp_api::DspParams {
                tempo_ratio: dsp.tempo_ratio,
                pitch_semitones: dsp.pitch_semitones,
                rate_ratio: dsp.rate_ratio,
                engine: selected_engine,
            };
            if let Err(e) = dsp_elem.set_params(dsp_params) {
                warn!("Błąd set_params w transkoderze: {:?}", e);
            }
            dsp_elem.set_engine(selected_engine);

            let audioconvert_post = gst::ElementFactory::make("audioconvert")
                .build()
                .map_err(|_| AudioEngineError::MissingElement("audioconvert"))?;

            pipeline.add_many([&capsfilter_dsp, dsp_elem.upcast_ref(), &audioconvert_post])?;
            audioresample.link(&capsfilter_dsp)?;
            capsfilter_dsp.link(&dsp_elem)?;

            let mut last_elem = dsp_elem.upcast::<gst::Element>();

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
                        let clamped = gain.clamp(-24.0, 12.0);
                        eq.set_property(&prop, clamped);
                    }
                    pipeline.add(&eq)?;
                    last_elem.link(&eq)?;
                    last_elem = eq;
                }
            }

            last_elem.link(&audioconvert_post)?;
            audioconvert_post
        } else {
            audioresample.clone()
        };

        // Gwarantujemy uniwersalną konwersję formatu próbek (audioconvert + audioresample) tuż przed enkoderem.
        // Jest to krytyczne, gdyż enkodery (zwłaszcza flacenc) akceptują wyłącznie całkowitoliczbowe
        // próbki PCM (S16LE, S24LE, S32LE) i bez audioconvert potok zawiesza się na negocjacji capsów
        // (tworząc pusty plik 0 bajtów bez wygenerowania EOS).
        let audioconvert_enc = gst::ElementFactory::make("audioconvert")
            .name("transcoder_audioconvert_enc")
            .build()
            .map_err(|_| AudioEngineError::MissingElement("audioconvert"))?;
        let audioresample_enc = gst::ElementFactory::make("audioresample")
            .name("transcoder_audioresample_enc")
            .build()
            .map_err(|_| AudioEngineError::MissingElement("audioresample"))?;

        pipeline.add_many([&audioconvert_enc, &audioresample_enc])?;
        source_for_encoder.link(&audioconvert_enc)?;
        audioconvert_enc.link(&audioresample_enc)?;
        let final_source = audioresample_enc;

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
                final_source.link(&opusenc)?;
                opusenc.link(&oggmux)?;
                oggmux.link(&filesink)?;
            }
            ExportFormat::Flac { compression_level } => {
                let flacenc = gst::ElementFactory::make("flacenc")
                    .build()
                    .map_err(|_| AudioEngineError::MissingElement("flacenc"))?;
                flacenc.set_property_from_str("quality", &compression_level.min(8).to_string());

                pipeline.add(&flacenc)?;
                final_source.link(&flacenc)?;
                flacenc.link(&filesink)?;
            }
            ExportFormat::Wav => {
                let wavenc = gst::ElementFactory::make("wavenc")
                    .build()
                    .map_err(|_| AudioEngineError::MissingElement("wavenc"))?;

                pipeline.add(&wavenc)?;
                final_source.link(&wavenc)?;
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

            // Wykonujemy seek bezpośrednio na elemencie audioresample (przed procesorem DSP 'pitch').
            // Dzięki temu wartości punktów A i B są interpretowane w bezwzględnej osi czasu pliku
            // źródłowego i nie ulegają zniekształceniu/przeskalowaniu przez tempo i rate efektu DSP.
            let seek_res = audioresample.seek(
                1.0,
                gst::SeekFlags::FLUSH | gst::SeekFlags::ACCURATE,
                gst::SeekType::Set,
                start,
                stop_type,
                stop,
            );
            if let Err(e) = seek_res {
                debug!(
                    "Dokładny seek (ACCURATE) A-B nie powiódł się ({}), próba ze standardowym FLUSH",
                    e
                );
                audioresample.seek(
                    1.0,
                    gst::SeekFlags::FLUSH,
                    gst::SeekType::Set,
                    start,
                    stop_type,
                    stop,
                )?;
            }
        }

        // Uruchomienie potoku i oczekiwanie na zakończenie (EOS) lub błąd
        pipeline.set_state(gst::State::Playing)?;

        let bus = pipeline.bus().ok_or_else(|| {
            AudioEngineError::ElementLink("Brak magistrali potoku transkodera".into())
        })?;

        let mut got_eos = false;
        let start_time = std::time::Instant::now();
        let timeout = std::time::Duration::from_secs(180);
        let mut last_progress_report = std::time::Instant::now();

        while start_time.elapsed() < timeout {
            if let Some(msg) = bus.timed_pop_filtered(
                gst::ClockTime::from_mseconds(150),
                &[
                    gst::MessageType::Eos,
                    gst::MessageType::Error,
                    gst::MessageType::Warning,
                ],
            ) {
                use gst::MessageView;
                match msg.view() {
                    MessageView::Eos(..) => {
                        debug!("Transkodowanie ukończone pomyślnie (EOS)");
                        got_eos = true;
                        break;
                    }
                    MessageView::Error(err) => {
                        let err_msg =
                            format!("Błąd transkodowania: {} ({:?})", err.error(), err.debug());
                        error!("{}", err_msg);
                        let _ = pipeline.set_state(gst::State::Null);
                        return Err(AudioEngineError::ElementLink(err_msg));
                    }
                    MessageView::Warning(warn) => {
                        warn!(
                            "Ostrzeżenie transkodera: {} ({:?})",
                            warn.error(),
                            warn.debug()
                        );
                    }
                    _ => {}
                }
            }

            if let Some(ref cb) = progress_cb {
                if last_progress_report.elapsed() >= std::time::Duration::from_millis(150) {
                    last_progress_report = std::time::Instant::now();
                    let mut q_pos = gst::query::Position::new(gst::Format::Time);
                    let mut q_dur = gst::query::Duration::new(gst::Format::Time);

                    let pos_ms = if pipeline.query(&mut q_pos) {
                        match q_pos.result() {
                            gst::GenericFormattedValue::Time(Some(t)) => Some(t.mseconds()),
                            _ => None,
                        }
                    } else {
                        None
                    };

                    let dur_ms = if pipeline.query(&mut q_dur) {
                        match q_dur.result() {
                            gst::GenericFormattedValue::Time(Some(t)) => Some(t.mseconds()),
                            _ => None,
                        }
                    } else {
                        None
                    };

                    if let Some(p) = pos_ms {
                        let (effective_p, effective_d) = match time_range {
                            Some(r) => {
                                let start = r.start_ms;
                                let dur = match r.end_ms {
                                    Some(end) => end.saturating_sub(start),
                                    None => dur_ms.unwrap_or(0).saturating_sub(start),
                                };
                                (p.saturating_sub(start), dur)
                            }
                            None => (p, dur_ms.unwrap_or(0)),
                        };

                        let percent = if effective_d > 0 {
                            (effective_p as f64 / effective_d as f64 * 100.0).clamp(0.0, 99.0)
                        } else {
                            0.0
                        };

                        cb(percent, effective_p, effective_d);
                    }
                }
            }
        }

        if !got_eos {
            let _ = pipeline.set_state(gst::State::Null);
            return Err(AudioEngineError::ElementLink(
                "Upłynął limit czasu transkodowania (timeout 180s) lub potok nie wygenerował EOS"
                    .into(),
            ));
        }

        if let Some(ref cb) = progress_cb {
            cb(100.0, 0, 0);
        }

        pipeline.set_state(gst::State::Null)?;
        info!("Plik przekonwertowany i zapisany: {}", output.display());
        Ok(())
    }
}
