/**
 * Key shift caused by the DSP chain.
 *
 * Playback rate is tape-style: it changes tempo AND pitch together, so it shifts the key by
 * `12 * log2(rate)` semitones on top of the explicit pitch shift. Tempo-only stretching keeps the key.
 */

/** Total pitch shift in semitones from an explicit pitch shift plus the rate (tape) shift. */
export function totalPitchShiftSemitones(pitchSemitones: number, rateRatio: number): number {
  const rate = Number.isFinite(rateRatio) && rateRatio > 0 ? rateRatio : 1;
  const pitch = Number.isFinite(pitchSemitones) ? pitchSemitones : 0;
  return pitch + 12 * Math.log2(rate);
}

/** Pitch class (0-11) reached after shifting `baseIndex` by `semitones`, rounded to the nearest key. */
export function transposeKeyIndex(baseIndex: number, semitones: number): number {
  const shift = Number.isFinite(semitones) ? Math.round(semitones) : 0;
  return (((baseIndex + shift) % 12) + 12) % 12;
}
