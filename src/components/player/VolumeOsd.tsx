import React, { useEffect, useState, useRef } from 'react';
import { cn } from '../../utils/cn';
import { useVolumeCurve } from '../../hooks/useVolumeCurve';
import { formatVolume, gainToPosition } from '../../utils/volumeCurve';
import { VolumeIcon } from './VolumeSlider';

export type VolumeOsdPosition = 'center' | 'top-right' | 'top-left' | 'bottom-center' | 'bottom-right' | 'bottom-left' | 'off';

/** Default spot: horizontally centred, just above the dock (`bottom-36.5`) so it clears the tempo controls. */
export const DEFAULT_VOLUME_OSD_POSITION: VolumeOsdPosition = 'bottom-center';

/** How long the OSD stays after the last volume change. */
export const VOLUME_OSD_HIDE_MS = 1200;

interface VolumeOsdProps {
  /** Linear gain (0..1), as in `PlaybackStatus.volume`. */
  volume: number;
  position: VolumeOsdPosition;
  unit?: 'percent' | 'db';
}

/** Screen position of the OSD (`left-1/2 -translate-x-1/2` centres horizontally). `bottom-36.5` clears the `h-25.5` dock. */
const OSD_POSITIONS: Record<string, string> = {
  center: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
  'top-right': 'top-8 right-8',
  'top-left': 'top-8 left-8',
  'bottom-center': 'bottom-36.5 left-1/2 -translate-x-1/2',
  'bottom-right': 'bottom-36.5 right-8',
  'bottom-left': 'bottom-36.5 left-8',
};

export const VolumeOsd: React.FC<VolumeOsdProps> = ({ volume, position, unit = 'percent' }) => {
  const [visible, setVisible] = useState(false);
  const [curve] = useVolumeCurve();
  const hideTimerRef = useRef<number | null>(null);
  const isFirstMount = useRef(true);

  // The bar and the percentage follow the slider position, the dB readout the real gain.
  const percentage = Math.round(gainToPosition(volume, curve) * 100);
  const isDb = unit === 'db';
  const displayValue = formatVolume(volume, unit, curve);

  useEffect(() => {
    // Do not show on initialisation
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    if (position === 'off') {
      queueMicrotask(() => setVisible(false));
      return;
    }

    queueMicrotask(() => setVisible(true));

    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }

    hideTimerRef.current = window.setTimeout(() => {
      setVisible(false);
    }, VOLUME_OSD_HIDE_MS);

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [volume, position]);

  if (!visible || position === 'off') {
    return null;
  }

  return (
    <div
      role="status"
      className={cn(
        'pointer-events-none fixed z-130 flex min-w-45 flex-col items-center gap-3 rounded-2xl border border-accent-pink/35 bg-ink/85 px-6 py-4 shadow-modal backdrop-blur-xl transition-opacity duration-300 motion-safe:animate-osd-pop',
        OSD_POSITIONS[position] ?? OSD_POSITIONS[DEFAULT_VOLUME_OSD_POSITION],
      )}
    >
      <div className="flex items-center gap-2.5">
        <VolumeIcon gain={volume} size={26} className={percentage < 50 && percentage > 0 ? 'text-accent-cyan' : 'text-accent-pink'} />
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-2xl font-extrabold tracking-tight text-fg">
            {displayValue}
          </span>
          {isDb && (
            <span className="font-mono text-ui font-semibold text-fg-muted">
              ({percentage}%)
            </span>
          )}
        </div>
      </div>

      {/* Volume bar indicator */}
      <div className="relative h-2 w-35 overflow-hidden rounded-sm bg-white/10">
        <div
          className="h-full rounded-sm bg-linear-to-r from-accent-cyan to-accent-pink shadow-halo-sm shadow-accent-pink/50 transition-[width] duration-75"
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>
    </div>
  );
};
