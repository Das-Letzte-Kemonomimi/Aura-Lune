import { usePersistedState } from './usePersistedState';
import { isVolumeCurve, type VolumeCurve } from '../utils/volumeCurve';

export const VOLUME_CURVE_STORAGE_KEY = 'auralune_volume_curve';

const parseVolumeCurve = (raw: string): VolumeCurve | undefined => (isVolumeCurve(raw) ? raw : undefined);

/**
 * The volume slider curve preference (default cubic). Every caller shares one store, so the
 * sliders, the OSD and the settings card all switch together without prop threading.
 */
export function useVolumeCurve(): [VolumeCurve, (curve: VolumeCurve) => void] {
  return usePersistedState<VolumeCurve>(VOLUME_CURVE_STORAGE_KEY, 'cubic', { parse: parseVolumeCurve });
}
