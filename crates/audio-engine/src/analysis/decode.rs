//! Dekodowanie utworów do próbek PCM `f32` na potrzeby analizy i separacji.
//!
//! Wszystkie dekodery korzystają z jednej sesji [`DecodeSession`]
//! (`uridecodebin → audioconvert → audioresample → appsink`). Próbki są pobierane z limitem
//! czasu, a magistrala jest sprawdzana pod kątem błędów, więc uszkodzony plik lub brak kodeka
//! kończy dekodowanie błędem zamiast blokować wątek analizy na zawsze.

use crate::AnalysisError;
use gst::prelude::*;
use gstreamer as gst;
use gstreamer_app as gst_app;
use gstreamer_audio as gst_audio;
use std::time::{Duration, Instant};

/// Częstotliwość próbkowania sygnału zwracanego przez [`decode_snippet_for_analysis`].
pub const ANALYSIS_SAMPLE_RATE: u32 = 22_050;

/// Częstotliwość próbkowania sygnału zwracanego przez [`decode_stereo_for_stems`].
pub const STEMS_SAMPLE_RATE: u32 = 44_100;

/// Jak długo czekamy na pojedynczy bufor, zanim sprawdzimy magistralę i limit czasu.
const PULL_TIMEOUT: Duration = Duration::from_millis(100);

/// Powód zakończenia [`DecodeSession::run`].
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum DecodeEnd {
    /// Zdekodowano cały plik.
    Eos,
    /// Wywołujący zażądał zatrzymania (zebrano dość próbek).
    Stopped,
    /// Przekroczono limit czasu dekodowania.
    TimedOut,
    /// Dekoder zgłosił błąd (uszkodzony plik, brak kodeka, brak pliku).
    Failed(String),
}

/// Potok dekodujący plik do przeplatanych próbek `f32` o zadanej częstotliwości i liczbie kanałów.
/// Przy zniszczeniu potok jest zawsze przełączany w stan `Null`.
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
                .map_err(|e| format!("Brak elementu GStreamer {name}: {e}"))
        };

        let pipeline = gst::Pipeline::new();
        let uridecodebin = gst::ElementFactory::make("uridecodebin")
            .property("uri", &uri)
            .build()
            .map_err(|e| format!("Brak uridecodebin: {e}"))?;
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
            .map_err(|e| format!("Brak capsfilter: {e}"))?;
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
            .map_err(|e| format!("Błąd dodawania do potoku: {e}"))?;
        gst::Element::link_many([
            &audioconvert,
            &audioresample,
            &capsfilter,
            appsink.upcast_ref(),
        ])
        .map_err(|e| format!("Błąd linkowania elementów: {e}"))?;

        let convert_sink_pad = audioconvert
            .static_pad("sink")
            .ok_or_else(|| "Brak sink pad w audioconvert".to_string())?;
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
            .map_err(|e| format!("Błąd uruchomienia dekodera: {e}"))?;
        Ok(session)
    }

    /// Przekazuje kolejne bufory (przeplatane próbki `f32`) do `on_chunk`, dopóki ten zwraca
    /// `true`, a dekoder nie skończy pliku, nie zgłosi błędu ani nie minie `max_wait`.
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
            // Rzutowanie sprawdzane pod kątem wyrównania; niewyrównany bufor jest kopiowany.
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

/// Zamienia błąd dekodera na `AnalysisError`, gdy nie zebrano żadnych próbek.
pub(super) fn finish<T>(
    collected_any: bool,
    end: DecodeEnd,
    value: T,
    what: &str,
) -> Result<T, AnalysisError> {
    if collected_any {
        if let DecodeEnd::Failed(e) = &end {
            tracing::warn!("Dekodowanie ({what}) przerwane błędem po części pliku: {e}");
        }
        return Ok(value);
    }
    Err(match end {
        DecodeEnd::Failed(e) => format!("Nie udało się zdekodować ({what}): {e}").into(),
        DecodeEnd::TimedOut => format!("Przekroczono czas dekodowania ({what})").into(),
        _ => format!("Brak próbek audio ({what})").into(),
    })
}

/// Dekoduje reprezentatywny fragment utworu do pamięci (mono, 22050 Hz F32LE).
/// Limit czasu dekodowania rośnie z długością fragmentu: `max(6 s, max_duration_sec / 10)`.
/// Po przekroczeniu limitu zwracany jest częściowy wynik (z ostrzeżeniem w logu).
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

/// Jak [`decode_snippet_for_analysis`], ale przekroczenie limitu czasu po zebraniu części próbek
/// jest błędem – dla wyników zapisywanych w pamięci podręcznej, które nie mogą być obcięte.
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
        return Err("Przekroczono czas dekodowania utworu do analizy".into());
    }
    let any = !collected.is_empty();
    finish(any, end, collected, "mono")
}

fn analysis_timeout(max_duration_sec: f64) -> Duration {
    Duration::from_secs_f64((max_duration_sec / 10.0).max(6.0))
}

/// Dekoduje do `max_duration_sec` sekund utworu (mono, [`ANALYSIS_SAMPLE_RATE`] Hz, F32LE),
/// dekodując najwyżej `max_wait`.
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
            "Dekodowanie do analizy przerwane limitem czasu — użyto {} s audio",
            collected.len() / ANALYSIS_SAMPLE_RATE as usize
        );
    }
    let any = !collected.is_empty();
    finish(any, end, collected, "mono")
}

/// Dekoduje utwór do pełnego pasma stereo ([`STEMS_SAMPLE_RATE`] Hz, F32LE, kanały L i R)
/// na potrzeby separacji stemów (HPSS / AI Neural).
pub fn decode_stereo_for_stems(
    uri_or_path: &str,
    max_duration_sec: f64,
) -> Result<(Vec<f32>, Vec<f32>, u32), AnalysisError> {
    let session = DecodeSession::open(uri_or_path, STEMS_SAMPLE_RATE, 2)?;
    let target = (max_duration_sec * STEMS_SAMPLE_RATE as f64).round() as usize;
    let capacity = target.min(STEMS_SAMPLE_RATE as usize * 600);
    let mut left: Vec<f32> = Vec::with_capacity(capacity);
    let mut right: Vec<f32> = Vec::with_capacity(capacity);
    // Stemy są zapisywane w cache na stałe — przerwane dekodowanie (limit czasu, błąd w połowie
    // pliku) jest błędem, a nie krótszym wynikiem. Limit czasu rośnie z długością fragmentu.
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
            return Err("Przekroczono czas dekodowania utworu do separacji stemów".into());
        }
        DecodeEnd::Failed(e) if !left.is_empty() => {
            return Err(format!("Dekodowanie do separacji stemów przerwane błędem: {e}").into());
        }
        DecodeEnd::Stopped => tracing::warn!(
            "Utwór dłuższy niż {max_duration_sec} s — stemy obejmują tylko początek utworu"
        ),
        _ => {}
    }
    let any = !left.is_empty();
    finish(any, end, (left, right, STEMS_SAMPLE_RATE), "stereo")
}
