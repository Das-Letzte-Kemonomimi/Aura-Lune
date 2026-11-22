//! Pomocnicze narzędzia dla kodu wykonywanego w wątku strumieniowym GStreamera
//! (funkcja `chain` elementu DSP, sondy padów saturatora i stereo widenera).
//!
//! Zasady (AGENTS.md §7.1): brak alokacji na stercie, brak I/O i brak długo trzymanych blokad
//! w gorącej ścieżce. Rzutowanie bajtów bufora na `f32` jest sprawdzane pod kątem wyrównania
//! (`bytemuck`) zamiast niezabezpieczonego `slice::from_raw_parts`.

use std::sync::atomic::{AtomicU64, Ordering};

/// Widok bajtów bufora jako próbek `f32`. `None`, gdy bufor nie jest wyrównany do 4 bajtów
/// lub jego długość nie jest wielokrotnością 4.
pub fn f32_samples(bytes: &[u8]) -> Option<&[f32]> {
    bytemuck::try_cast_slice(bytes).ok()
}

/// Mutowalny widok bajtów bufora jako próbek `f32` (zob. [`f32_samples`]).
pub fn f32_samples_mut(bytes: &mut [u8]) -> Option<&mut [f32]> {
    bytemuck::try_cast_slice_mut(bytes).ok()
}

/// Dopisuje próbki `f32` z bajtów bufora do `out`. Działa także dla niewyrównanych buforów
/// (kopiowanie bajt po bajcie), a nadmiarowe bajty na końcu (< 4) są pomijane.
pub fn extend_f32_samples(bytes: &[u8], out: &mut Vec<f32>) {
    if let Some(samples) = f32_samples(bytes) {
        out.extend_from_slice(samples);
        return;
    }
    out.extend(
        bytes
            .as_chunks::<4>()
            .0
            .iter()
            .map(|c| f32::from_ne_bytes(*c)),
    );
}

/// Stosuje `f` do każdej próbki `f32` w buforze w miejscu, również gdy bufor jest niewyrównany.
pub fn map_f32_samples_in_place(bytes: &mut [u8], mut f: impl FnMut(f32) -> f32) {
    if let Some(samples) = f32_samples_mut(bytes) {
        for s in samples.iter_mut() {
            *s = f(*s);
        }
        return;
    }
    for c in bytes.as_chunks_mut::<4>().0 {
        *c = f(f32::from_ne_bytes(*c)).to_ne_bytes();
    }
}

/// Stosuje `f` do każdej ramki stereo (L, R) w miejscu, również gdy bufor jest niewyrównany.
pub fn map_stereo_frames_in_place(bytes: &mut [u8], mut f: impl FnMut(f32, f32) -> (f32, f32)) {
    if let Some(samples) = f32_samples_mut(bytes) {
        for frame in samples.as_chunks_mut::<2>().0 {
            let (l, r) = f(frame[0], frame[1]);
            *frame = [l, r];
        }
        return;
    }
    for frame in bytes.as_chunks_mut::<8>().0 {
        let (lb, rb) = frame.split_at_mut(4);
        let l = f32::from_ne_bytes([lb[0], lb[1], lb[2], lb[3]]);
        let r = f32::from_ne_bytes([rb[0], rb[1], rb[2], rb[3]]);
        let (l, r) = f(l, r);
        lb.copy_from_slice(&l.to_ne_bytes());
        rb.copy_from_slice(&r.to_ne_bytes());
    }
}

/// Ograniczenie częstotliwości ostrzeżeń w gorącej ścieżce: loguj pierwsze wystąpienie
/// i następnie co `every`-te (błąd DSP w każdym buforze nie zaleje logów).
#[derive(Debug, Default)]
pub struct RateLimiter {
    count: AtomicU64,
}

impl RateLimiter {
    pub const fn new() -> Self {
        Self {
            count: AtomicU64::new(0),
        }
    }

    /// Zwraca `true`, gdy bieżące zdarzenie należy zalogować.
    pub fn should_log(&self, every: u64) -> bool {
        let n = self.count.fetch_add(1, Ordering::Relaxed);
        every == 0 || n.is_multiple_of(every)
    }
}
