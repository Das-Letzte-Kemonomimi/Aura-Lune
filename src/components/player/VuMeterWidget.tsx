import React, { useEffect, useRef, useState } from 'react';
import { Gauge } from 'lucide-react';
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
      className={`glass-card ${className || ''}`}
      style={{
        padding: '8px 10px',
        borderRadius: '14px',
        background: 'rgba(15, 12, 28, 0.78)',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
          <Gauge size={13} color="var(--accent-pink)" />
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#fff', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
            VU-METER
          </span>
          <span
            style={{
              fontSize: '0.62rem',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              whiteSpace: 'nowrap',
            }}
          >
            L/R
          </span>
        </div>

        {/* Selektor motywu podświetlenia wskaźnika (kompaktowe pigułki) */}
        <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
          {[
            { id: 'amber', label: 'Amber', color: '#f59e0b' },
            { id: 'sakura', label: 'Sakura', color: '#ec4899' },
            { id: 'cyber', label: 'Cyan', color: '#06b6d4' },
          ].map((th) => (
            <button
              key={th.id}
              onClick={() => handleSelectTheme(th.id as VuTheme)}
              title={th.id === 'amber' ? 'Amber 70s' : th.id === 'sakura' ? 'Sakura Glow' : 'Cyber Neon'}
              style={{
                padding: '2px 6px',
                borderRadius: '5px',
                fontSize: '0.62rem',
                fontWeight: 700,
                background: theme === th.id ? `${th.color}33` : 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${theme === th.id ? th.color : 'rgba(255, 255, 255, 0.1)'}`,
                color: theme === th.id ? th.color : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {th.label}
            </button>
          ))}
        </div>
      </div>

      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          flex: 1,
          minHeight: 0,
          borderRadius: '8px',
          display: 'block',
        }}
      />
    </div>
  );
};
