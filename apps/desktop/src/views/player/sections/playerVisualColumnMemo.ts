import type { PlaybackStatus } from '../../../types/player';
import type { PlayerVisualColumnProps } from './PlayerVisualColumn';

/**
 * `PlayerView` renderuje się ~10×/s (żywy status), a ta kolumna zawiera ciężkie widżety (winyl, taśma, VU).
 * Renderujemy ją ponownie tylko przy zmianie rzeczywiście używanych pól statusu — pozycja zaokrąglona do
 * sekundy (licznik i nawój taśmy), widma nie porównujemy (VU czyta je ze store'u).
 */
function statusUnchanged(a: PlaybackStatus, b: PlaybackStatus): boolean {
  return (
    a.state === b.state &&
    a.tempo_ratio === b.tempo_ratio &&
    a.rate_ratio === b.rate_ratio &&
    a.engine === b.engine &&
    a.volume === b.volume &&
    a.current_track === b.current_track &&
    Math.floor((a.position_ms ?? 0) / 1000) === Math.floor((b.position_ms ?? 0) / 1000)
  );
}

export function arePlayerVisualColumnPropsEqual(prev: PlayerVisualColumnProps, next: PlayerVisualColumnProps): boolean {
  const { status: prevStatus, ...prevRest } = prev;
  const { status: nextStatus, ...nextRest } = next;
  const keys = Object.keys(nextRest) as (keyof typeof nextRest)[];
  if (keys.length !== Object.keys(prevRest).length) return false;
  for (const key of keys) {
    if (!Object.is(prevRest[key], nextRest[key])) return false;
  }
  return statusUnchanged(prevStatus, nextStatus);
}

