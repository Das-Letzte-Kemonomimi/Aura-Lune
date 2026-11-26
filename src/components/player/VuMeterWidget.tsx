import React, { useEffect, useRef, useState } from 'react';
import { Gauge } from 'lucide-react';
import { cn } from '../../utils/cn';
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
import { cssVars } from '../../utils/cssVars';

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

  // Najnowsze wartości dla pętli rysowania (bez jej restartu przy każdym ticku spektrum co 100 ms)
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

      // Spektrum prosto ze store'u (prop tylko jako zapas przed pierwszym statusem)
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

      // Statyczna warstwa kopiowana 1:1 (tożsama transformacja), dynamika rysowana w pikselach CSS
      const layer = faceRef.current.layer;
      if (layer) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(layer, 0, 0);
        ctx.restore();
      }
      drawVuDynamic(ctx, width, height, leftRef.current, rightRef.current, colors);

      // Ustalony stan bez odtwarzania → pętla może spać do następnego invalidate()
      return !(isVuSettled(leftRef.current, playing) && isVuSettled(rightRef.current, playing));
    },
    {
      onResize: () => {
        faceRef.current = { layer: null, key: '' };
      },
    },
  );

  // Zmiana motywu / odtwarzania budzi pętlę (zmiana propsów nie restartuje efektu)
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

        {/* Selektor motywu podświetlenia wskaźnika (kompaktowe pigułki) */}
        <div className="flex shrink-0 gap-1">
          {[
            { id: 'amber', label: 'Amber', color: '#f59e0b' },
            { id: 'sakura', label: 'Sakura', color: '#ec4899' },
            { id: 'cyber', label: 'Cyan', color: '#06b6d4' },
          ].map((th) => (
            <button
              key={th.id}
              onClick={() => handleSelectTheme(th.id as VuTheme)}
              title={th.id === 'amber' ? 'Amber 70s' : th.id === 'sakura' ? 'Sakura Glow' : 'Cyber Neon'}
              aria-pressed={theme === th.id}
              className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-2xs font-bold text-fg-muted transition-all duration-150 aria-pressed:border-(--vu) aria-pressed:bg-(--vu)/20 aria-pressed:text-(--vu)"
              style={cssVars({ '--vu': th.color })}
            >
              {th.label}
            </button>
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
