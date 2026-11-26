import React, { useEffect, useRef, useState } from 'react';
import { type Language, getTranslations } from '../../i18n';
import { useCanvasLoop } from '../../hooks/useCanvasLoop';
import { livePlayback } from '../../state/livePlayback';
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
  const loc = getTranslations(currentLang);
  const [mode, setMode] = useState<VisualizerMode>(() => {
    try {
      const saved = localStorage.getItem('auralune_visualizer_mode');
      if (isVisualizerMode(saved)) return saved;
    } catch {}
    return 'bars';
  });

  // Stan animacji trzymany w refach (bez renderów Reacta na klatkę)
  const bandStateRef = useRef<BandState>({ smoothed: [], peaks: [] });
  const foldedRef = useRef<number[]>([]);
  const rotationRef = useRef(0);
  const timeRef = useRef(0);
  const [gradients] = useState(() => new GradientCache());

  // Najnowsze wartości dla pętli rysowania (bez jej restartu przy zmianie propsów)
  const propsRef = useRef({ spectrum, isPlaying, mode });
  useEffect(() => {
    propsRef.current = { spectrum, isPlaying, mode };
  });

  const { canvasRef, invalidate } = useCanvasLoop(
    ({ ctx, width, height, dt }) => {
      const { spectrum: spectrumProp, isPlaying: playing, mode: currentMode } = propsRef.current;

      // Widmo prosto ze store'u (prop tylko jako zapas przed pierwszym statusem)
      const live = livePlayback.getSnapshot();
      const source = live.ready && live.spectrum.length > 0 ? live.spectrum : spectrumProp;
      const count = foldBands(source, foldedRef.current);
      const moving = updateBands(bandStateRef.current, foldedRef.current, count, playing, dt);

      // Obrót i „czas” oscyloskopu postępują tylko podczas odtwarzania (po pauzie wizualizacja zastyga i śpi)
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

      // Pętla śpi, gdy nic się już nie rusza (pauza + wygaszone pasma); budzi ją `invalidate()`
      return playing || moving;
    },
    {
      pixelRatio: 'device',
      onResize: () => gradients.clear(),
    },
  );

  // Zmiana odtwarzania/trybu budzi pętlę
  useEffect(() => {
    invalidate();
  }, [isPlaying, mode, invalidate]);

  const cycleMode = () => {
    const next = nextVisualizerMode(mode);
    setMode(next);
    try {
      localStorage.setItem('auralune_visualizer_mode', next);
    } catch {}
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
