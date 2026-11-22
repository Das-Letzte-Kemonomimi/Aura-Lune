use super::LockExt;
use std::sync::{Arc, Mutex};

#[test]
fn lock_safe_recovers_poisoned_mutex() {
    let m = Arc::new(Mutex::new(5));
    let m2 = Arc::clone(&m);
    let _ = std::thread::spawn(move || {
        let _guard = m2.lock().unwrap();
        panic!("zatrucie blokady w teście");
    })
    .join();

    assert!(m.is_poisoned());
    *m.lock_safe() += 1;
    assert_eq!(*m.lock_safe(), 6);
}
