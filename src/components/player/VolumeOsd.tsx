import React, { useEffect, useState, useRef } from 'react';
import { Volume2, Volume1, VolumeX } from 'lucide-react';
import { cn } from '../../utils/cn';

export type VolumeOsdPosition = 'center' | 'top-right' | 'top-left' | 'bottom-center' | 'bottom-right' | 'bottom-left' | 'off';

interface VolumeOsdProps {
  volume: number; // 0.0 - 1.0 (or up to 2.0)
  position: VolumeOsdPosition;
  unit?: 'percent' | 'db';
}

/** Screen position of the OSD (`left-1/2 -translate-x-1/2` centres horizontally). */
const OSD_POSITIONS: Record<string, string> = {
  center: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
  'top-right': 'top-8 right-8',
  'top-left': 'top-8 left-8',
  'bottom-center': 'bottom-30 left-1/2 -translate-x-1/2',
  'bottom-right': 'bottom-30 right-8',
  'bottom-left': 'bottom-30 left-8',
};

export const VolumeOsd: React.FC<VolumeOsdProps> = ({ volume, position, unit = 'percent' }) => {
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef<number | null>(null);
  const isFirstMount = useRef(true);

  const percentage = Math.round(volume * 100);
  const isDb = unit === 'db';
  const displayValue = isDb
    ? (volume <= 0.0001 ? '-∞ dB' : `${(20 * Math.log10(volume)).toFixed(1)} dB`)
    : `${percentage}%`;

  useEffect(() => {
    // Nie wyświetlaj przy inicjalizacji
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
    }, 1300);

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
      className={cn(
        'pointer-events-none fixed z-130 flex min-w-45 flex-col items-center gap-3 rounded-2xl border border-accent-pink/35 bg-ink/85 px-6 py-4 shadow-modal backdrop-blur-xl transition-opacity duration-300 motion-safe:animate-osd-pop',
        OSD_POSITIONS[position] ?? OSD_POSITIONS['bottom-center'],
      )}
    >
      <div className="flex items-center gap-2.5">
        {percentage === 0 ? (
          <VolumeX size={26} className="text-accent-pink" />
        ) : percentage < 50 ? (
          <Volume1 size={26} className="text-accent-cyan" />
        ) : (
          <Volume2 size={26} className="text-accent-pink" />
        )}
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

      {/* Wskaźnik paska głośności */}
      <div className="relative h-2 w-35 overflow-hidden rounded-sm bg-white/10">
        <div
          className="h-full rounded-sm bg-linear-to-r from-accent-cyan to-accent-pink shadow-halo-sm shadow-accent-pink/50 transition-[width] duration-75"
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>
    </div>
  );
};
