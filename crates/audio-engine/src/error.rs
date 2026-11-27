use gstreamer as gst;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AudioEngineError {
    #[error("GStreamer error: {0}")]
    Gst(#[from] glib::Error),

    #[error("GStreamer state change error: {0}")]
    StateChange(#[from] gst::StateChangeError),

    #[error("GStreamer operation failed: {0}")]
    Bool(#[from] glib::BoolError),

    #[error("GStreamer element error: element '{0}' is not installed")]
    MissingElement(&'static str),

    #[error("GStreamer pad error: {0}")]
    PadLink(#[from] gst::PadLinkError),

    #[error("Failed to link pipeline elements: {0}")]
    ElementLink(String),

    #[error("DSP error: {0}")]
    Dsp(#[from] dsp_api::DspError),

    #[error("Invalid player state: expected {expected:?}, got {actual:?}")]
    InvalidState {
        expected: &'static str,
        actual: domain::PlaybackState,
    },

    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("File does not exist or is unreachable: {0}")]
    FileNotFound(String),

    /// Invalid input from the caller (e.g. a reversed A-B range, output = input).
    #[error("Invalid parameters: {0}")]
    Validation(String),

    /// Error while the pipeline runs (bus message, timeout, missing bus).
    #[error("{0}")]
    Pipeline(String),

    /// Missing system resource, e.g. no sound card with the given name.
    #[error("Not found: {0}")]
    NotFound(String),

    /// Error from an external system tool (pactl, pw-cli).
    #[error("{0}")]
    External(String),
}

/// Music analysis errors (BPM/key, chords, transcription, ReplayGain, waveform).
#[derive(Debug, Error)]
pub enum AnalysisError {
    #[error("File does not exist: {0}")]
    FileNotFound(String),

    /// Building or running the GStreamer decode pipeline, no samples, timeout.
    #[error("{0}")]
    Pipeline(String),

    /// Reading or writing tags (lofty).
    #[error("{0}")]
    Tags(String),

    #[error("I/O error: {0}")]
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

/// Contextual pipeline-building messages (`format!("Missing uridecodebin: {e}")`) are treated
/// as pipeline errors.
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

/// Tag read and write errors (`metadata_editor`).
#[derive(Debug, Error)]
pub enum TagError {
    #[error("Failed to open file {path}: {message}")]
    Open { path: String, message: String },

    #[error("Failed to read tags: {0}")]
    Read(String),

    #[error("The audio file has no supported tag container")]
    NoTagContainer,

    #[error("Failed to write tags to {path}: {message}")]
    Write { path: String, message: String },
}
