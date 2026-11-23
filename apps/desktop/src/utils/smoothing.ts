/**
 * Wygładzanie niezależne od liczby klatek na sekundę.
 *
 * Stałe „na klatkę” (np. `x += (cel - x) * 0.45`) działają 2.4× szybciej na ekranie 144 Hz niż na 60 Hz.
 * Tu wszystko jest wyrażone w czasie: stała czasowa `tau` (sekundy) i `dt` (sekundy).
 */

/** Wygładzanie wykładnicze: zbliża `current` do `target` z stałą czasową `tau` (s) w czasie `dt` (s). */
export function smoothTo(current: number, target: number, dt: number, tau: number): number {
  if (!(tau > 0) || !(dt > 0)) return dt > 0 ? target : current;
  return current + (target - current) * (1 - Math.exp(-dt / tau));
}

/** Stała czasowa (s) odpowiadająca współczynnikowi `factor` stosowanemu co klatkę przy `hz` klatek/s. */
export function tauFromFrameLerp(factor: number, hz = 60): number {
  const f = Math.min(0.999999, Math.max(1e-6, factor));
  return -1 / (hz * Math.log(1 - f));
}

/** Przelicza spadek „na klatkę” (przy `hz` klatek/s) na spadek na sekundę. */
export function fallPerSec(perFrame: number, hz = 60): number {
  return perFrame * hz;
}
