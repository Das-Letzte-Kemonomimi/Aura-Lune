import { useState, useCallback } from 'react';
import type { Translations } from '../i18n';
import { formatDb } from '../utils/volumeScale';

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

  const handleToggleVolumeUnit = useCallback(() => {
    handleSetVolumeUnit(volumeUnit === 'percent' ? 'db' : 'percent');
  }, [handleSetVolumeUnit, volumeUnit]);

  const formatVolumeValue = useCallback(
    (vol: number, unit: VolumeUnit = volumeUnit): string => {
      if (unit === 'db') return formatDb(vol);
      return `${Math.round(vol * 100)}%`;
    },
    [volumeUnit]
  );

  return {
    volumeUnit,
    setVolumeUnit,
    handleSetVolumeUnit,
    handleToggleVolumeUnit,
    formatVolumeValue,
  };
}
