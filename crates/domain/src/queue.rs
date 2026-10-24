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
        self.rebuild_shuffle_order();
    }

    /// Ustawia lub dodaje bieżący odtwarzany utwór do kolejki (np. po wczytaniu z biblioteki lub pliku).
    pub fn set_active_item(&mut self, item: QueueItem) {
        if let Some(pos) = self.items.iter().position(|i| i.uri == item.uri) {
            self.current_index = Some(pos);
            self.items[pos] = item;
        } else {
            self.items.push(item);
            self.current_index = Some(self.items.len() - 1);
            self.rebuild_shuffle_order();
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
        if let Some(idx) = self.current_index {
            self.items.insert(idx + 1, item);
        } else {
            self.add_item(item);
        }
        self.rebuild_shuffle_order();
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
        self.current_index.and_then(|idx| self.items.get(idx))
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

        let mut order: Vec<usize> = (0..count).collect();
        let mut seed = (count as u64)
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        for i in (1..count).rev() {
            seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1);
            let j = (seed % (i as u64 + 1)) as usize;
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

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_item(id: &str, title: &str) -> QueueItem {
        QueueItem {
            id: id.to_string(),
            track_id: None,
            uri: format!("file:///{}.flac", id),
            title: title.to_string(),
            artist: "Artist".to_string(),
            album: Some("Album".to_string()),
            duration_ms: 180000,
        }
    }

    #[test]
    fn test_queue_navigation_sequential_and_loop() {
        let mut queue = PlaybackQueue::new();
        queue.set_items(
            vec![
                sample_item("1", "Song A"),
                sample_item("2", "Song B"),
                sample_item("3", "Song C"),
            ],
            Some(0),
        );

        assert_eq!(queue.current_item().unwrap().title, "Song A");
        assert_eq!(queue.next().unwrap().title, "Song B");
        assert_eq!(queue.next().unwrap().title, "Song C");
        // Na końcu bez loop_mode zwraca None
        assert!(queue.next().is_none());

        // Z LoopMode::Queue powraca na początek
        queue.set_loop_mode(LoopMode::Queue);
        assert_eq!(queue.next().unwrap().title, "Song A");

        // Previous cofa do końca
        assert_eq!(queue.previous().unwrap().title, "Song C");
        assert_eq!(queue.previous().unwrap().title, "Song B");

        // Z LoopMode::Track powtarza utwór
        queue.set_loop_mode(LoopMode::Track);
        assert_eq!(queue.next().unwrap().title, "Song B");
        assert_eq!(queue.next().unwrap().title, "Song B");
    }

    #[test]
    fn test_queue_add_next_and_remove() {
        let mut queue = PlaybackQueue::new();
        queue.set_items(
            vec![sample_item("1", "Song 1"), sample_item("2", "Song 2")],
            Some(0),
        );

        queue.add_next(sample_item("1.5", "Song Interlude"));
        assert_eq!(queue.items.len(), 3);
        assert_eq!(queue.items[1].title, "Song Interlude");

        let removed = queue.remove_item("1.5");
        assert_eq!(removed.unwrap().title, "Song Interlude");
        assert_eq!(queue.items.len(), 2);
    }
}
