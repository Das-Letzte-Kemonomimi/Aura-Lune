#[cfg(target_os = "linux")]
use gstreamer as gst;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AudioEngineError {
    #[cfg(target_os = "linux")]
    #[error("Błąd GStreamera: {0}")]
    Gst(#[from] glib::Error),

    #[cfg(target_os = "linux")]
    #[error("Błąd zmiany stanu GStreamera: {0}")]
    StateChange(#[from] gst::StateChangeError),

    #[cfg(target_os = "linux")]
    #[error("Operacja GStreamera nie powiodła się: {0}")]
    Bool(#[from] glib::BoolError),

    #[error("Błąd elementu: brak elementu '{0}' w systemie")]
    MissingElement(&'static str),

    #[cfg(target_os = "linux")]
    #[error("Błąd padu GStreamera: {0}")]
    PadLink(#[from] gst::PadLinkError),

    #[error("Nie udało się połączyć elementów potoku: {0}")]
    ElementLink(String),

    #[error("Błąd DSP: {0}")]
    Dsp(#[from] dsp_api::DspError),

    #[error("Nieprawidłowy stan odtwarzacza: oczekiwano {expected:?}, otrzymano {actual:?}")]
    InvalidState {
        expected: &'static str,
        actual: domain::PlaybackState,
    },

    #[error("Błąd wejścia/wyjścia: {0}")]
    Io(#[from] std::io::Error),

    #[error("Plik nie istnieje lub jest nieosiągalny: {0}")]
    FileNotFound(String),

    #[error("Błąd backendu audio: {0}")]
    Backend(String),
}
