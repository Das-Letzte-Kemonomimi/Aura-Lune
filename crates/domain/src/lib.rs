pub mod bookmark;
pub mod cue;
pub mod device;
pub mod equalizer;
pub mod m3u;
pub mod playlist;
pub mod queue;
pub mod renamer;
pub mod replaygain;
pub mod theme;
pub mod transcode;

pub use bookmark::TrackBookmark;
pub use cue::{CueSheet, CueTrack};
pub use equalizer::{EqualizerPreset, EqualizerState, EQUALIZER_FREQUENCIES, EQUALIZER_LABELS};
pub use m3u::{ImportM3uResult, M3uEntry, M3uPlaylist};
pub use playlist::Playlist;
pub use queue::{LoopMode, PlaybackQueue, QueueItem};
pub use renamer::{
    format_pattern_for_track, resolve_renamed_path, sanitize_filename_part, RenamePreviewItem,
    RenamerTrackInfo,
};
pub use replaygain::{ReplayGainConfig, ReplayGainMode};
pub use theme::{default_themes, Theme, ThemeTokens};
pub use transcode::{DspExportSettings, ExportFormat, TimeRange};

use serde::{Deserialize, Serialize};
use std::time::Duration;

/// Stan odtwarzacza audio.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum PlaybackState {
    #[default]
    Stopped,
    Playing,
    Paused,
}

/// Identyfikator ścieżki w bibliotece.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct TrackId(pub String);

/// Metadane ścieżki audio.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TrackMetadata {
    pub id: Option<TrackId>,
    pub uri: String,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub duration: Option<Duration>,
}

impl TrackMetadata {
    pub fn new(uri: impl Into<String>) -> Self {
        Self {
            id: None,
            uri: uri.into(),
            title: None,
            artist: None,
            album: None,
            duration: None,
        }
    }
}
