//! Domena kolejki odtwarzania (Playback Queue) oraz trybów zapętlania i losowości.
//!
//! Zgodnie z ADR 0008 i AGENTS.md:
//! Czysta, w pełni testowalna logika domenowa bez zależności od Tauri czy GStreamera.

use serde::{Deserialize, Serialize};

/// Tryb zapętlania odtwarzacza.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum LoopMode {
    #[default]
    None,
    Track,
    Queue,
}

/// Element kolejki odtwarzania.
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

/// Kolejka odtwarzania z obsługą zapętlania i losowości (Shuffle).
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

    /// Ustawia nową listę utworów w kolejce i opcjonalnie indeks startowy.
    pub fn set_items(&mut self, items: Vec<QueueItem>, start_index: Option<usize>) {
        let count = items.len();
        self.items = items;
        self.current_index = if count == 0 {
            None
        } else {
            start_index.map(|idx| idx.min(count - 1))
        };
        // Utwór z kolejki ma być teraz odtwarzany — nieaktualny strumień (np. radio)
        // nie może go przesłaniać w `current_item()`.
        if self.current_index.is_some() {
            self.active_stream = None;
        }
        self.rebuild_shuffle_order();
    }

    /// Ustawia bieżący odtwarzany utwór w kolejce jeśli w niej istnieje.
    /// Jeśli utwór nie znajduje się w kolejce, nie dodaje go automatycznie do listy utworów —
    /// kolejka odtwarzania zawiera wyłącznie utwory celowo dodane przez użytkownika.
    pub fn set_active_item(&mut self, item: QueueItem) {
        self.active_stream = Some(item.clone());
        if let Some(pos) = self.items.iter().position(|i| {
            i.uri == item.uri
                || (i.track_id.is_some() && item.track_id.is_some() && i.track_id == item.track_id)
        }) {
            self.current_index = Some(pos);
            self.items[pos] = item;
        } else {
            self.current_index = None;
        }
    }

    /// Dodaje utwór na koniec kolejki.
    pub fn add_item(&mut self, item: QueueItem) {
        self.items.push(item);
        if self.current_index.is_none() && !self.items.is_empty() {
            self.current_index = Some(0);
        }
        self.rebuild_shuffle_order();
    }

    /// Wstawia utwór bezpośrednio po aktualnie odtwarzanym ("Odtwórz jako następny").
    pub fn add_next(&mut self, item: QueueItem) {
        match self.current_index {
            Some(idx) => {
                self.items.insert(idx + 1, item);
                self.rebuild_shuffle_order();
            }
            None => self.add_item(item),
        }
    }

    /// Usuwa element z kolejki po unikalnym ID.
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

    /// Zmienia kolejność elementów w kolejce (przeniesienie z from_idx do to_idx).
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

    /// Czyści całą kolejkę odtwarzania.
    pub fn clear(&mut self) {
        self.items.clear();
        self.current_index = None;
        self.shuffle_order.clear();
        self.shuffle_cursor = 0;
    }

    /// Zwraca aktualnie odtwarzany element kolejki.
    pub fn current_item(&self) -> Option<&QueueItem> {
        self.current_index
            .and_then(|idx| self.items.get(idx))
            .or(self.active_stream.as_ref())
    }

    /// Przechodzi do następnego utworu w kolejce według trybów Loop i Shuffle.
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

        // Tryb sekwencyjny
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

    /// Przechodzi do poprzedniego utworu w kolejce.
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

    /// Ustawia tryb zapętlania (None, Track, Queue).
    pub fn set_loop_mode(&mut self, mode: LoopMode) {
        self.loop_mode = mode;
    }

    /// Włącza lub wyłącza tryb Shuffle.
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

        // Tasowanie Fishera-Yatesa. Ziarno zmienia się przy każdej przebudowie, więc dwie kolejki
        // tej samej długości nie dostają identycznej kolejności.
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

/// Zwraca nowe ziarno tasowania: zegar systemowy wymieszany z licznikiem wywołań
/// (dwa wywołania w tej samej nanosekundzie nadal dają różne ziarna).
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

/// Mały, szybki generator pseudolosowy (SplitMix64) — wystarczający do tasowania kolejki.
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
