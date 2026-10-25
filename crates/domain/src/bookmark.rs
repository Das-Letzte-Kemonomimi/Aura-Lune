use serde::{Deserialize, Serialize};

/// Wielopunktowy znacznik czasu (zakładka / cue point) wewnątrz utworu.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TrackBookmark {
    pub id: i64,
    pub track_id: i64,
    pub name: String,
    pub position_ms: u64,
    pub created_at: i64,
}

impl TrackBookmark {
    pub fn new(
        id: i64,
        track_id: i64,
        name: impl Into<String>,
        position_ms: u64,
        created_at: i64,
    ) -> Self {
        Self {
            id,
            track_id,
            name: name.into(),
            position_ms,
            created_at,
        }
    }
}
