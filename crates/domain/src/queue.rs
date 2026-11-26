//! Playback queue domain, with the repeat and shuffle modes.
//!
//! Per ADR 0008 and AGENTS.md:
//! pure, fully testable domain logic with no dependency on Tauri or GStreamer.

use serde::{Deserialize, Serialize};

/// Player repeat mode.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum LoopMode {
    #[default]
    None,
    Track,
    Queue,
}

/// A playback queue item.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct QueueItem {
    pub id: String,
    pub track_id: Option<i64>,
    pub uri: String,
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub duration_ms: u64,
}

/// Playback queue with repeat and shuffle support.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct PlaybackQueue {
    pub items: Vec<QueueItem>,
    pub current_index: Option<usize>,
    pub loop_mode: LoopMode,
    pub shuffle: bool,
    pub shuffle_order: Vec<usize>,
    pub shuffle_cursor: usize,
    #[serde(default)]
    pub active_stream: Option<QueueItem>,
}

impl PlaybackQueue {
    pub fn new() -> Self {
        Self::default()
    }

    /// Sets a new list of tracks in the queue and optionally the start index.
    pub fn set_items(&mut self, items: Vec<QueueItem>, start_index: Option<usize>) {
        let count = items.len();
        self.items = items;
        self.current_index = if count == 0 {
            None
        } else {
            start_index.map(|idx| idx.min(count - 1))
        };
        // A queue track is to be played now: a stale stream (e.g. radio)
        // must not shadow it in `current_item()`.
        if self.current_index.is_some() {
            self.active_stream = None;
        }
        self.rebuild_shuffle_order();
    }

    /// Sets the currently playing track in the queue if it exists there.
    /// A track that is not in the queue is not added automatically: the playback
    /// queue only holds tracks the user added on purpose.
    pub fn set_active_item(&mut self, item: QueueItem) {
        self.active_stream = Some(item.clone());
        if let Some(pos) = self.items.iter().position(|i| {
            i.uri == item.uri
                || (i.track_id.is_some() && item.track_id.is_some() && i.track_id == item.track_id)
        }) {
            // Keep the UI entry's `id` stable, refresh its metadata from the new item, and
            // align the shuffle cursor so the next track does not skip past this one.
            let existing_id = self.items[pos].id.clone();
            self.items[pos] = QueueItem {
                id: existing_id,
                ..item
            };
            self.current_index = Some(pos);
            if let Some(cursor) = self.shuffle_order.iter().position(|&i| i == pos) {
                self.shuffle_cursor = cursor;
            }
        } else {
            self.current_index = None;
        }
    }

    /// Appends a track to the end of the queue.
    pub fn add_item(&mut self, item: QueueItem) {
        self.items.push(item);
        if self.current_index.is_none() && !self.items.is_empty() {
            self.current_index = Some(0);
        }
        self.rebuild_shuffle_order();
    }

    /// Inserts a track right after the one playing now ("Play next").
    pub fn add_next(&mut self, item: QueueItem) {
        match self.current_index {
            Some(idx) => {
                self.items.insert(idx + 1, item);
                self.rebuild_shuffle_order();
            }
            None => self.add_item(item),
        }
    }

    /// Removes an item from the queue by its unique ID.
    pub fn remove_item(&mut self, id: &str) -> Option<QueueItem> {
        let pos = self.items.iter().position(|i| i.id == id)?;
        let removed = self.items.remove(pos);

        if self.items.is_empty() {
            self.current_index = None;
        } else if let Some(cur) = self.current_index {
            if cur == pos {
                self.current_index = Some(pos.min(self.items.len() - 1));
            } else if cur > pos {
                self.current_index = Some(cur - 1);
            }
        }

        self.rebuild_shuffle_order();
        Some(removed)
    }

    /// Reorders the queue items (moves from from_idx to to_idx).
    pub fn move_item(&mut self, from_idx: usize, to_idx: usize) -> bool {
        if from_idx >= self.items.len() || to_idx >= self.items.len() {
            return false;
        }
        let item = self.items.remove(from_idx);
        self.items.insert(to_idx, item);

        if let Some(cur) = self.current_index {
            if cur == from_idx {
                self.current_index = Some(to_idx);
            } else if from_idx < cur && to_idx >= cur {
                self.current_index = Some(cur - 1);
            } else if from_idx > cur && to_idx <= cur {
                self.current_index = Some(cur + 1);
            }
        }

        self.rebuild_shuffle_order();
        true
    }

    /// Clears the whole playback queue.
    pub fn clear(&mut self) {
        self.items.clear();
        self.current_index = None;
        self.shuffle_order.clear();
        self.shuffle_cursor = 0;
    }

    /// Returns the queue item playing now.
    pub fn current_item(&self) -> Option<&QueueItem> {
        self.current_index
            .and_then(|idx| self.items.get(idx))
            .or(self.active_stream.as_ref())
    }

    /// Moves to the next track in the queue according to the loop and shuffle modes.
    #[allow(clippy::should_implement_trait)]
    pub fn next(&mut self) -> Option<&QueueItem> {
        if self.items.is_empty() {
            return None;
        }

        if self.loop_mode == LoopMode::Track && self.current_index.is_some() {
            return self.current_item();
        }

        if self.shuffle && !self.shuffle_order.is_empty() {
            if self.shuffle_cursor + 1 < self.shuffle_order.len() {
                self.shuffle_cursor += 1;
                self.current_index = Some(self.shuffle_order[self.shuffle_cursor]);
                return self.current_item();
            } else if self.loop_mode == LoopMode::Queue {
                self.shuffle_cursor = 0;
                self.current_index = Some(self.shuffle_order[0]);
                return self.current_item();
            } else {
                return None;
            }
        }

        // Sequential mode
        match self.current_index {
            Some(idx) => {
                if idx + 1 < self.items.len() {
                    self.current_index = Some(idx + 1);
                    self.current_item()
                } else if self.loop_mode == LoopMode::Queue {
                    self.current_index = Some(0);
                    self.current_item()
                } else {
                    None
                }
            }
            None => {
                self.current_index = Some(0);
                self.current_item()
            }
        }
    }

    /// Moves to the previous track in the queue.
    pub fn previous(&mut self) -> Option<&QueueItem> {
        if self.items.is_empty() {
            return None;
        }

        if self.loop_mode == LoopMode::Track && self.current_index.is_some() {
            return self.current_item();
        }

        if self.shuffle && !self.shuffle_order.is_empty() {
            if self.shuffle_cursor > 0 {
                self.shuffle_cursor -= 1;
                self.current_index = Some(self.shuffle_order[self.shuffle_cursor]);
                return self.current_item();
            } else if self.loop_mode == LoopMode::Queue {
                self.shuffle_cursor = self.shuffle_order.len() - 1;
                self.current_index = Some(self.shuffle_order[self.shuffle_cursor]);
                return self.current_item();
            } else {
                return self.current_item();
            }
        }

        match self.current_index {
            Some(idx) => {
                if idx > 0 {
                    self.current_index = Some(idx - 1);
                    self.current_item()
                } else if self.loop_mode == LoopMode::Queue {
                    self.current_index = Some(self.items.len() - 1);
                    self.current_item()
                } else {
                    self.current_item()
                }
            }
            None => {
                self.current_index = Some(0);
                self.current_item()
            }
        }
    }

    /// Sets the repeat mode (None, Track, Queue).
    pub fn set_loop_mode(&mut self, mode: LoopMode) {
        self.loop_mode = mode;
    }

    /// Turns shuffle mode on or off.
    pub fn set_shuffle(&mut self, enabled: bool) {
        self.shuffle = enabled;
        self.rebuild_shuffle_order();
    }

    fn rebuild_shuffle_order(&mut self) {
        let count = self.items.len();
        if count == 0 {
            self.shuffle_order.clear();
            self.shuffle_cursor = 0;
            return;
        }

        // Fisher-Yates shuffle. The seed changes on every rebuild, so two queues
        // of the same length do not get the same order.
        let mut order: Vec<usize> = (0..count).collect();
        let mut rng = SplitMix64::new(fresh_shuffle_seed());
        for i in (1..count).rev() {
            let j = (rng.next_u64() % (i as u64 + 1)) as usize;
            order.swap(i, j);
        }

        if let Some(cur) = self.current_index {
            if let Some(pos) = order.iter().position(|&x| x == cur) {
                order.swap(0, pos);
            }
        }

        self.shuffle_order = order;
        self.shuffle_cursor = 0;
    }
}

/// Returns a new shuffle seed: the system clock mixed with a call counter
/// (two calls in the same nanosecond still get different seeds).
fn fresh_shuffle_seed() -> u64 {
    use std::sync::atomic::{AtomicU64, Ordering};
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(0);
    nanos
        ^ COUNTER
            .fetch_add(1, Ordering::Relaxed)
            .wrapping_mul(0x9E37_79B9_7F4A_7C15)
}

/// A small, fast pseudo-random generator (SplitMix64), good enough for shuffling the queue.
struct SplitMix64(u64);

impl SplitMix64 {
    fn new(seed: u64) -> Self {
        Self(seed)
    }

    fn next_u64(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }
}
