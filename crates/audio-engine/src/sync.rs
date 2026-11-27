//! Lock helpers.
//!
//! Poisoned mutexes (after a panic in a thread holding the lock) must not take down
//! the whole audio engine: every later `lock().unwrap()` would panic again. The GStreamer
//! pipeline state stays usable, so the guard is recovered and work continues.

use std::sync::{Mutex, MutexGuard, PoisonError};

pub(crate) trait LockExt<T> {
    /// Like `lock()`, but recovers a lock poisoned by another thread's panic.
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
