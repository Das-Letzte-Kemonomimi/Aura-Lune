import { useState, useCallback } from 'react';
import type { Translations } from '../i18n';
import { fmt } from '../utils/fmt';
import { formatVolume, type FormatVolumeOptions, type VolumeCurve } from '../utils/volumeCurve';
import { useVolumeCurve } from './useVolumeCurve';

export type VolumeUnit = 'percent' | 'db';

export interface UseVolumeUnitOptions {
  loc: Translations;
  showMessage: (msg: string) => void;
}

export function useVolumeUnit({ loc, showMessage }: UseVolumeUnitOptions) {
  const [volumeUnit, setVolumeUnit] = useState<VolumeUnit>(() => {
    try {
      const saved = localStorage.getItem('auralune_volume_unit');
      return saved === 'db' ? 'db' : 'percent';
    } catch {
      return 'percent';
    }
  });
  const [volumeCurve, setVolumeCurve] = useVolumeCurve();

  const handleSetVolumeUnit = useCallback(
    (unit: VolumeUnit) => {
      setVolumeUnit(unit);
      try {
        localStorage.setItem('auralune_volume_unit', unit);
      } catch {}
      showMessage(
        loc.notifications.volumeUnitChanged.replace(
          '{0}',
          unit === 'db' ? loc.notifications.volumeUnitDb : loc.notifications.volumeUnitPercent
        )
      );
    },
    [loc.notifications.volumeUnitChanged, loc.notifications.volumeUnitDb, loc.notifications.volumeUnitPercent, showMessage]
  );

  // The playback status holds linear gain, so switching the curve only moves the slider
  // thumb: loudness stays exactly the same and nothing is sent to the engine.
  const handleSetVolumeCurve = useCallback(
    (curve: VolumeCurve) => {
      setVolumeCurve(curve);
      showMessage(
        fmt(
          loc.notifications.volumeCurveChanged,
          curve === 'db-linear' ? loc.settings.volumeCurveDbLinear : loc.settings.volumeCurveCubic
        )
      );
    },
    [loc.notifications.volumeCurveChanged, loc.settings.volumeCurveCubic, loc.settings.volumeCurveDbLinear, setVolumeCurve, showMessage]
  );

  const handleToggleVolumeUnit = useCallback(() => {
    handleSetVolumeUnit(volumeUnit === 'percent' ? 'db' : 'percent');
  }, [handleSetVolumeUnit, volumeUnit]);

  /** `%` = slider position on the active curve, dB = real gain. */
  const formatVolumeValue = useCallback(
    (gain: number, unit: VolumeUnit = volumeUnit, options?: FormatVolumeOptions): string =>
      formatVolume(gain, unit, volumeCurve, options),
    [volumeCurve, volumeUnit]
  );

  return {
    volumeUnit,
    setVolumeUnit,
    handleSetVolumeUnit,
    handleToggleVolumeUnit,
    volumeCurve,
    handleSetVolumeCurve,
    formatVolumeValue,
  };
}
