/**
 * Prędkość odtwarzania względem czasu rzeczywistego.
 *
 * `position_ms` z backendu jest czasem źródła. W trybie Bypass dźwięk płynie bit-perfect z prędkością 1.0×,
 * w pozostałych silnikach DSP czas źródła biegnie z prędkością `tempo * rate`.
 */
export interface PlaybackSpeedInput {
  engine?: string;
  tempo?: number;
  rate?: number;
  /** Jawna informacja, czy DSP moduluje strumień (nadpisuje wnioskowanie z `engine`). */
  isDspActive?: boolean;
}

export function playbackSpeed({ engine, tempo, rate, isDspActive }: PlaybackSpeedInput): number {
  const dspActive = isDspActive !== undefined ? isDspActive : engine !== 'Bypass' && Boolean(engine);
  if (!dspActive) return 1;
  return Math.max(0.1, Math.min(4, (tempo || 1) * (rate || 1)));
}
