import React, { useEffect, useRef, useState } from 'react';
import { Gauge } from '../ui/icons';
import { cn } from '../../utils/cn';
import { Chip, type Tone } from '../ui';
import { useCanvasLoop } from '../../hooks/useCanvasLoop';
import { livePlayback } from '../../state/livePlayback';
import { drawVuDynamic, renderVuFaceLayer } from './vuFace';
import {
  VU_THEMES,
  computeVuLevels,
  isVuSettled,
  stepVuChannel,
  type VuChannelState,
  type VuTheme,
} from './vuMeterMath';

/** Backlight theme pills: label, tooltip and the tone of the pressed state. */
const VU_THEME_CHIPS: readonly { id: VuTheme; label: string; title: string; tone: Tone }[] = [
  { id: 'amber', label: 'Amber', title: 'Amber 70s', tone: 'amber' },
  { id: 'sakura', label: 'Sakura', title: 'Sakura Glow', tone: 'pink' },
  { id: 'cyber', label: 'Cyan', title: 'Cyber Neon', tone: 'cyan' },
];

interface VuMeterWidgetProps {
  spectrum?: number[];
  volume?: number;
  isPlaying: boolean;
  style?: React.CSSProperties;
  className?: string;
  theme?: VuTheme;
}

export const VuMeterWidget: React.FC<VuMeterWidgetProps> = ({
  spectrum = [],
  volume = 1.0,
  isPlaying,
  style,
  className,
  theme: initialTheme = 'sakura',
}) => {
  const [theme, setTheme] = useState<VuTheme>(() => {
    try {
      const saved = localStorage.getItem('auralune_vumeter_theme');
      if (saved === 'amber' || saved === 'sakura' || saved === 'cyber') return saved;
    } catch {}
    return initialTheme;
  });

  const handleSelectTheme = (newTheme: VuTheme) => {
    setTheme(newTheme);
    try {
      localStorage.setItem('auralune_vumeter_theme', newTheme);
    } catch {}
  };

  // The latest values for the drawing loop (without restarting it on every 100 ms spectrum tick)
  const propsRef = useRef({ spectrum, volume, isPlaying });
  useEffect(() => {
    propsRef.current = { spectrum, volume, isPlaying };
  });

  const leftRef = useRef<VuChannelState>({ level: 0, peak: 0 });
  const rightRef = useRef<VuChannelState>({ level: 0, peak: 0 });
  const faceRef = useRef<{ layer: HTMLCanvasElement | null; key: string }>({ layer: null, key: '' });

  const { canvasRef, invalidate } = useCanvasLoop(
    ({ ctx, width, height, dt }) => {
      const { spectrum: spectrumProp, volume: vol, isPlaying: playing } = propsRef.current;

      // Spectrum straight from the store (the prop is only a fallback before the first status)
      const live = livePlayback.getSnapshot();
      const spec = live.ready && live.spectrum.length > 0 ? live.spectrum : spectrumProp;
      const raw = computeVuLevels(spec, vol, playing);
      leftRef.current = stepVuChannel(leftRef.current, raw.left, dt);
      rightRef.current = stepVuChannel(rightRef.current, raw.right, dt);

      const colors = VU_THEMES[theme];
      const canvas = ctx.canvas;
      const key = `${theme}|${canvas.width}x${canvas.height}|${width}x${height}`;
      if (faceRef.current.key !== key || !faceRef.current.layer) {
        faceRef.current = { layer: renderVuFaceLayer(canvas.width, canvas.height, width, height, colors), key };
      }

      // The static layer is copied 1:1 (identity transform), the dynamic part is drawn in CSS pixels
      const layer = faceRef.current.layer;
      if (layer) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(layer, 0, 0);
        ctx.restore();
      }
      drawVuDynamic(ctx, width, height, leftRef.current, rightRef.current, colors);

      // Settled state without playback → the loop can sleep until the next invalidate()
      return !(isVuSettled(leftRef.current, playing) && isVuSettled(rightRef.current, playing));
    },
    {
      onResize: () => {
        faceRef.current = { layer: null, key: '' };
      },
    },
  );

  // A theme / playback change wakes the loop (prop changes do not restart the effect)
  useEffect(() => {
    invalidate();
  }, [theme, isPlaying, invalidate]);

  return (
    <div
      className={cn('glass-card flex flex-col gap-1.5 rounded-2xl border-line bg-ink/80 px-2.5 py-2', className)}
      style={style}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <Gauge size={13} className="text-accent-pink" />
          <span className="text-xs font-extrabold tracking-wider whitespace-nowrap text-fg">
            VU-METER
          </span>
          <span className="font-mono text-2xs whitespace-nowrap text-fg-muted">
            L/R
          </span>
        </div>

        {/* Meter backlight theme selector (compact pills) */}
        <div className="flex shrink-0 gap-1">
          {VU_THEME_CHIPS.map((th) => (
            <Chip
              key={th.id}
              size="xs"
              tone={th.tone}
              pressed={theme === th.id}
              onClick={() => handleSelectTheme(th.id)}
              title={th.title}
              className="px-1.5 text-2xs"
            >
              {th.label}
            </Chip>
          ))}
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="block min-h-0 w-full flex-1 rounded-lg"
      />
    </div>
  );
};
