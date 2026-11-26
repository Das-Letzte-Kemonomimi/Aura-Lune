import { useEffect, useRef } from 'react';
import { RangeSlider } from '../ui';
import { Volume, Volume1, Volume2, VolumeX } from '../ui/icons';
import { useVolumeCurve } from '../../hooks/useVolumeCurve';
import {
  DEFAULT_VOLUME_POSITION,
  gainToPosition,
  positionToGain,
  stepVolumeGain,
  volumeIconFor,
  wheelVolumeStep,
} from '../../utils/volumeCurve';

/** Keys the slider hands back to the global shortcuts (volume, seek, play/pause). */
const SHORTCUT_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '];

export interface VolumeSliderProps {
  /** Current linear gain (0..1), as in `PlaybackStatus.volume`. */
  gain: number;
  /** Receives the new linear gain; the slider position never leaves this component. */
  onGainChange: (gain: number) => void;
  ariaLabel: string;
  title?: string;
  className?: string;
}

/**
 * The one volume slider (dock, player, mini player, big screen). It shows the POSITION on the
 * user's volume curve and sends GAIN. Wheel: ±2% (Shift 0.5%, Ctrl 5%). Double-click: 70%.
 */
export function VolumeSlider({ gain, onGainChange, ariaLabel, title, className }: VolumeSliderProps) {
  const [curve] = useVolumeCurve();
  const inputRef = useRef<HTMLInputElement>(null);
  // The wheel listener is attached once; it reads the latest values through this ref.
  const latestRef = useRef({ gain, curve, onGainChange });
  useEffect(() => {
    latestRef.current = { gain, curve, onGainChange };
  });

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    // Native listener: React's onWheel is passive, so it could not stop the page from scrolling.
    const onWheel = (e: WheelEvent) => {
      const delta = wheelVolumeStep(e.deltaY, e);
      if (!delta) return;
      e.preventDefault();
      const { gain: current, curve: activeCurve, onGainChange: send } = latestRef.current;
      send(stepVolumeGain(current, delta, activeCurve));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <RangeSlider
      ref={inputRef}
      aria-label={ariaLabel}
      min={0}
      max={1}
      step={0.001}
      value={gainToPosition(gain, curve)}
      onChange={(position) => onGainChange(positionToGain(position, curve))}
      onDoubleClick={() => onGainChange(positionToGain(DEFAULT_VOLUME_POSITION, curve))}
      onPointerUp={(e) => e.currentTarget.blur()}
      onKeyDown={(e) => {
        // Hand the arrow keys and Space back to the global shortcuts.
        if (SHORTCUT_KEYS.includes(e.key)) e.currentTarget.blur();
      }}
      title={title}
      className={className}
    />
  );
}

export interface VolumeIconProps {
  /** Linear gain (0..1); the icon follows the slider position on the active curve. */
  gain: number;
  size?: number;
  className?: string;
}

/** Speaker icon with 0 / 1 / 2 waves by slider position, crossed out when muted. */
export function VolumeIcon({ gain, size, className }: VolumeIconProps) {
  const [curve] = useVolumeCurve();
  const level = volumeIconFor(gainToPosition(gain, curve));
  const Icon = level === 'mute' ? VolumeX : level === 'low' ? Volume : level === 'mid' ? Volume1 : Volume2;
  return <Icon size={size} className={className} data-volume-level={level} />;
}
