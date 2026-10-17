pub mod device;
pub mod transcode;

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
