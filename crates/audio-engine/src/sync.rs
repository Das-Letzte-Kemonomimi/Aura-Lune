//! Pomocnicze operacje na blokadach.
//!
//! Zatrute (poisoned) muteksy — po panice wątku trzymającego blokadę — nie mogą wyłączać
//! całego silnika audio: każde kolejne `lock().unwrap()` panikowałoby ponownie. Stan potoku
//! GStreamera pozostaje używalny, więc odzyskujemy strażnika i kontynuujemy.

use std::sync::{Mutex, MutexGuard, PoisonError};

pub(crate) trait LockExt<T> {
    /// Jak `lock()`, ale odzyskuje blokadę zatrutą przez panikę innego wątku.
    fn lock_safe(&self) -> MutexGuard<'_, T>;
}

impl<T> LockExt<T> for Mutex<T> {
    fn lock_safe(&self) -> MutexGuard<'_, T> {
        self.lock().unwrap_or_else(PoisonError::into_inner)
    }
}

#[cfg(test)]
#[path = "sync_test.rs"]
mod tests;
