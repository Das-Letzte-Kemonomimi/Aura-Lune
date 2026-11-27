import React, { useEffect, useRef, useState } from 'react';
import { type Language, getTranslations } from '../../i18n';
import { useCanvasLoop } from '../../hooks/useCanvasLoop';
import { usePersistedState } from '../../hooks/usePersistedState';
import { livePlayback, useSpectrumConsumer } from '../../state/livePlayback';
import { GradientCache } from '../../utils/canvasDraw';
import { foldBands, updateBands, type BandState } from '../../utils/spectrumBands';
import { cn } from '../../utils/cn';
import {
  MODE_DRAWERS,
  OSCILLOSCOPE_TIME_PER_SEC,
  ROTATION_RAD_PER_SEC,
  isVisualizerMode,
  nextVisualizerMode,
  type VisualizerMode,
} from './spectrumModes';

interface SpectrumVisualizerProps {
  spectrum?: number[];
  isPlaying: boolean;
  className?: string;
  style?: React.CSSProperties;
  currentLang?: Language;
}

export type { VisualizerMode } from './spectrumModes';

export const SpectrumVisualizer: React.FC<SpectrumVisualizerProps> = ({
  spectrum = [],
  isPlaying,
  className,
  style,
  currentLang = 'en',
}) => {
  useSpectrumConsumer();
  const loc = getTranslations(currentLang);
  // Shared by every visualizer on screen (player, BigScreen, DSP studio): a change in one shows in all.
  const [mode, setMode] = usePersistedState<VisualizerMode>('auralune_visualizer_mode', 'bars', {
    parse: (raw) => (isVisualizerMode(raw) ? raw : undefined),
  });

  // Animation state kept in refs (no React renders per frame)
  const bandStateRef = useRef<BandState>({ smoothed: [], peaks: [] });
  const foldedRef = useRef<number[]>([]);
  const rotationRef = useRef(0);
  const timeRef = useRef(0);
  const [gradients] = useState(() => new GradientCache());

  // The latest values for the drawing loop (without restarting it when props change)
  const propsRef = useRef({ spectrum, isPlaying, mode });
  useEffect(() => {
    propsRef.current = { spectrum, isPlaying, mode };
  });

  const { canvasRef, invalidate } = useCanvasLoop(
    ({ ctx, width, height, dt }) => {
      const { spectrum: spectrumProp, isPlaying: playing, mode: currentMode } = propsRef.current;

      // Spectrum straight from the store (the prop is only a fallback before the first status)
      const live = livePlayback.getSnapshot();
      const source = live.ready && live.spectrum.length > 0 ? live.spectrum : spectrumProp;
      const count = foldBands(source, foldedRef.current);
      const moving = updateBands(bandStateRef.current, foldedRef.current, count, playing, dt);

      // Rotation and the oscilloscope "time" advance only during playback (after a pause the visualisation freezes and sleeps)
      if (playing) {
        rotationRef.current += (ROTATION_RAD_PER_SEC[currentMode] ?? 0) * dt;
        timeRef.current += OSCILLOSCOPE_TIME_PER_SEC * dt;
      }

      MODE_DRAWERS[currentMode]({
        ctx,
        width,
        height,
        bands: bandStateRef.current.smoothed,
        peaks: bandStateRef.current.peaks,
        count,
        isPlaying: playing,
        rotation: rotationRef.current,
        time: timeRef.current,
        gradients,
      });

      // The loop sleeps when nothing moves any more (paused + faded bands); `invalidate()` wakes it
      return playing || moving;
    },
    {
      pixelRatio: 'device',
      onResize: () => gradients.clear(),
    },
  );

  // A playback/mode change wakes the loop
  useEffect(() => {
    invalidate();
  }, [isPlaying, mode, invalidate]);

  const cycleMode = () => {
    setMode(nextVisualizerMode(mode));
  };

  return (
    <div
      className={cn(
        'relative inset-shadow-well h-22 transform-gpu cursor-pointer overflow-hidden rounded-xl border border-line bg-black/45 will-change-transform',
        className,
      )}
      style={style}
      onClick={cycleMode}
      title={loc.dsp.spectrumCycleTooltip}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
      <div
        className="pointer-events-none absolute top-1 right-2 font-mono text-2xs font-bold tracking-wider text-fg-muted uppercase opacity-60"
      >
        {mode}
      </div>
    </div>
  );
};
