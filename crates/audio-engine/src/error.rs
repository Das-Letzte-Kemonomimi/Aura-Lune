use gstreamer as gst;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AudioEngineError {
    #[error("Błąd GStreamera: {0}")]
    Gst(#[from] glib::Error),

    #[error("Błąd zmiany stanu GStreamera: {0}")]
    StateChange(#[from] gst::StateChangeError),

    #[error("Operacja GStreamera nie powiodła się: {0}")]
    Bool(#[from] glib::BoolError),

    #[error("Błąd elementu GStreamera: brak elementu '{0}' w systemie")]
    MissingElement(&'static str),

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

    /// Nieprawidłowe dane wejściowe od wywołującego (np. odwrócony zakres A-B, wyjście = wejście).
    #[error("Nieprawidłowe parametry: {0}")]
    Validation(String),

    /// Błąd w trakcie działania potoku (komunikat z magistrali, timeout, brak magistrali).
    #[error("{0}")]
    Pipeline(String),

    /// Brak zasobu systemowego, np. karty dźwiękowej o podanej nazwie.
    #[error("Nie znaleziono: {0}")]
    NotFound(String),

    /// Błąd zewnętrznego narzędzia systemowego (pactl, pw-cli).
    #[error("{0}")]
    External(String),
}

/// Błędy analizy muzycznej (BPM/tonacja, akordy, transkrypcja, ReplayGain, fala dźwiękowa).
#[derive(Debug, Error)]
pub enum AnalysisError {
    #[error("Plik nie istnieje: {0}")]
    FileNotFound(String),

    /// Budowa lub działanie potoku dekodującego GStreamera, brak próbek, timeout.
    #[error("{0}")]
    Pipeline(String),

    /// Odczyt lub zapis tagów (lofty).
    #[error("{0}")]
    Tags(String),

    #[error("Błąd wejścia/wyjścia: {0}")]
    Io(#[from] std::io::Error),
}

impl From<AudioEngineError> for AnalysisError {
    fn from(e: AudioEngineError) -> Self {
        match e {
            AudioEngineError::FileNotFound(p) => Self::FileNotFound(p),
            AudioEngineError::Io(io) => Self::Io(io),
            other => Self::Pipeline(other.to_string()),
        }
    }
}

/// Komunikaty kontekstowe budowy potoku (`format!("Brak uridecodebin: {e}")`) traktowane są
/// jako błędy potoku.
impl From<String> for AnalysisError {
    fn from(msg: String) -> Self {
        Self::Pipeline(msg)
    }
}

impl From<&str> for AnalysisError {
    fn from(msg: &str) -> Self {
        Self::Pipeline(msg.to_string())
    }
}

/// Błędy odczytu i zapisu tagów (`metadata_editor`).
#[derive(Debug, Error)]
pub enum TagError {
    #[error("Błąd otwarcia pliku {path}: {message}")]
    Open { path: String, message: String },

    #[error("Błąd odczytu tagów: {0}")]
    Read(String),

    #[error("Brak obsługiwanego kontenera tagów w pliku audio")]
    NoTagContainer,

    #[error("Błąd zapisu tagów do pliku {path}: {message}")]
    Write { path: String, message: String },
}
