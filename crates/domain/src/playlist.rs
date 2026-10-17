//! Domena playlist.

use serde::{Deserialize, Serialize};

/// Reprezentacja playlisty w domenie.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Playlist {
    pub id: i64,
    pub name: String,
    pub created_at: i64,
    pub track_count: usize,
}
