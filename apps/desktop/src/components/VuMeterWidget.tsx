import React, { useEffect, useRef, useState } from 'react';
import { Gauge } from 'lucide-react';

interface VuMeterWidgetProps {
  spectrum?: number[];
  volume?: number;
  isPlaying: boolean;
  style?: React.CSSProperties;
  className?: string;
  theme?: 'amber' | 'sakura' | 'cyber';
}

export const VuMeterWidget: React.FC<VuMeterWidgetProps> = ({
  spectrum = [],
  volume = 1.0,
  isPlaying,
  style,
  className,
  theme: initialTheme = 'sakura',
}) => {
  const [theme, setTheme] = useState<'amber' | 'sakura' | 'cyber'>(() => {
    try {
      const saved = localStorage.getItem('auralune_vumeter_theme');
      if (saved === 'amber' || saved === 'sakura' || saved === 'cyber') return saved;
    } catch (_) {}
    return initialTheme;
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const leftLevelRef = useRef<number>(0);
  const rightLevelRef = useRef<number>(0);
  const leftPeakRef = useRef<number>(0);
  const rightPeakRef = useRef<number>(0);

  const handleSelectTheme = (newTheme: 'amber' | 'sakura' | 'cyber') => {
    setTheme(newTheme);
    try {
      localStorage.setItem('auralune_vumeter_theme', newTheme);
    } catch (_) {}
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      if (canvas.clientWidth && canvas.width !== canvas.clientWidth) {
        canvas.width = canvas.clientWidth;
      }
      if (canvas.clientHeight && canvas.height !== canvas.clientHeight) {
        canvas.height = canvas.clientHeight;
      }

      const width = canvas.width || 480;
      const height = canvas.height || 180;
      ctx.clearRect(0, 0, width, height);

      // Oblicz surowe poziomy L i R na podstawie pasm spektrogramu
      let rawLeft = 0;
      let rawRight = 0;

      if (isPlaying && spectrum.length > 0) {
        // Pasma basowe i średnie dają główne ugięcie wskaźnika VU
        const half = Math.floor(spectrum.length / 2);
        for (let i = 0; i < half; i++) rawLeft += spectrum[i] || 0;
        for (let i = half; i < spectrum.length; i++) rawRight += spectrum[i] || 0;

        rawLeft = (rawLeft / Math.max(1, half)) * volume * 1.5;
        rawRight = (rawRight / Math.max(1, spectrum.length - half)) * volume * 1.5;
      }

      // Ballistyka analogowa VU: szybki narost (attack), płynne opadanie (decay)
      const attack = 0.35;
      const decay = 0.08;

      if (rawLeft > leftLevelRef.current) {
        leftLevelRef.current += (rawLeft - leftLevelRef.current) * attack;
      } else {
        leftLevelRef.current -= (leftLevelRef.current - rawLeft) * decay;
      }

      if (rawRight > rightLevelRef.current) {
        rightLevelRef.current += (rawRight - rightLevelRef.current) * attack;
      } else {
        rightLevelRef.current -= (rightLevelRef.current - rawRight) * decay;
      }

      // Peak Hold
      if (leftLevelRef.current > leftPeakRef.current) {
        leftPeakRef.current = leftLevelRef.current;
      } else {
        leftPeakRef.current = Math.max(0, leftPeakRef.current - 0.015);
      }

      if (rightLevelRef.current > rightPeakRef.current) {
        rightPeakRef.current = rightLevelRef.current;
      } else {
        rightPeakRef.current = Math.max(0, rightPeakRef.current - 0.015);
      }

      // Motywy podświetlenia wskaźnika
      const themeColors = {
        amber: {
          bgGradStart: '#2d1b06',
          bgGradEnd: '#130c02',
          faceBg: '#fef3c7',
          faceGrad: '#fde68a',
          bezel: '#78350f',
          textDark: '#451a03',
          needle: '#b91c1c',
          needleCap: '#7f1d1d',
          glow: 'rgba(245, 158, 11, 0.45)',
          redZone: '#ef4444',
          accent: '#f59e0b',
        },
        sakura: {
          bgGradStart: '#2b091f',
          bgGradEnd: '#12040d',
          faceBg: '#fce7f3',
          faceGrad: '#fbcfe8',
          bezel: '#831843',
          textDark: '#500724',
          needle: '#e11d48',
          needleCap: '#881337',
          glow: 'rgba(244, 63, 94, 0.45)',
          redZone: '#e11d48',
          accent: '#ec4899',
        },
        cyber: {
          bgGradStart: '#04222a',
          bgGradEnd: '#020e12',
          faceBg: '#cffafe',
          faceGrad: '#a5f3fc',
          bezel: '#155e75',
          textDark: '#083344',
          needle: '#0284c7',
          needleCap: '#0369a1',
          glow: 'rgba(6, 182, 212, 0.45)',
          redZone: '#ef4444',
          accent: '#06b6d4',
        },
      }[theme];

      const meterWidth = (width - 24) / 2;
      const meterHeight = height - 16;

      // Rysuj kanał L i kanał R
      drawMeter(
        ctx,
        8,
        8,
        meterWidth,
        meterHeight,
        'LEFT (CH 1)',
        leftLevelRef.current,
        leftPeakRef.current,
        themeColors
      );

      drawMeter(
        ctx,
        8 + meterWidth + 8,
        8,
        meterWidth,
        meterHeight,
        'RIGHT (CH 2)',
        rightLevelRef.current,
        rightPeakRef.current,
        themeColors
      );

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [spectrum, volume, isPlaying, theme]);

  const drawMeter = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    level: number,
    peak: number,
    colors: any
  ) => {
    ctx.save();
    ctx.translate(x, y);

    // Zaokrąglona ramka wskaźnika (Vintage Bezel)
    ctx.fillStyle = colors.bgGradStart;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 12);
    ctx.fill();

    // Wewnętrzna tarcza (Faceplate)
    const margin = 5;
    const faceW = w - margin * 2;
    const faceH = h - margin * 2;
    const faceGrad = ctx.createLinearGradient(0, 0, 0, faceH);
    faceGrad.addColorStop(0, colors.faceBg);
    faceGrad.addColorStop(1, colors.faceGrad);

    ctx.fillStyle = faceGrad;
    ctx.beginPath();
    ctx.roundRect(margin, margin, faceW, faceH, 8);
    ctx.fill();

    // Subtelny cień tarczy
    ctx.strokeStyle = colors.bezel;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Punkt obrotu wskazówki na dole tarczy
    const pivotX = margin + faceW / 2;
    const pivotY = margin + faceH * 0.95;
    const radius = faceH * 0.78;

    // Łuk skali dB (od -45 stopni do +45 stopni)
    const startAngle = -Math.PI * 0.75;
    const endAngle = -Math.PI * 0.25;

    // Główny łuk czarny
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, radius, startAngle, startAngle + (endAngle - startAngle) * 0.75);
    ctx.strokeStyle = colors.textDark;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Czerwony segment przesteru (+0dB do +3dB)
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, radius, startAngle + (endAngle - startAngle) * 0.75, endAngle);
    ctx.strokeStyle = colors.redZone;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Kreski skali dB i etykiety
    const marks = [
      { norm: 0.0, label: '-20' },
      { norm: 0.25, label: '-10' },
      { norm: 0.45, label: '-7' },
      { norm: 0.60, label: '-5' },
      { norm: 0.75, label: '0' },
      { norm: 0.88, label: '+1' },
      { norm: 1.0, label: '+3' },
    ];

    ctx.font = '700 8px monospace';
    ctx.textAlign = 'center';

    marks.forEach((m) => {
      const angle = startAngle + (endAngle - startAngle) * m.norm;
      const isRed = m.norm >= 0.75;

      const innerR = radius - 5;
      const outerR = radius + 3;

      const x1 = pivotX + Math.cos(angle) * innerR;
      const y1 = pivotY + Math.sin(angle) * innerR;
      const x2 = pivotX + Math.cos(angle) * outerR;
      const y2 = pivotY + Math.sin(angle) * outerR;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = isRed ? colors.redZone : colors.textDark;
      ctx.lineWidth = isRed ? 2 : 1.5;
      ctx.stroke();

      const textR = radius - 13;
      const tx = pivotX + Math.cos(angle) * textR;
      const ty = pivotY + Math.sin(angle) * textR;
      ctx.fillStyle = isRed ? colors.redZone : colors.textDark;
      ctx.fillText(m.label, tx, ty + 3);
    });

    // Etykieta kanału
    ctx.font = '800 9px sans-serif';
    ctx.fillStyle = colors.textDark;
    ctx.fillText(label, pivotX, margin + 20);

    // Dioda Peak LED w prawym górnym rogu tarczy
    const ledX = margin + faceW - 14;
    const ledY = margin + 14;
    const isPeakActive = peak >= 0.82;

    ctx.beginPath();
    ctx.arc(ledX, ledY, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = isPeakActive ? '#ef4444' : 'rgba(239, 68, 68, 0.25)';
    ctx.fill();
    if (isPeakActive) {
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Wskazówka (Needle)
    const clampedLevel = Math.max(0.0, Math.min(1.05, level));
    const needleAngle = startAngle + (endAngle - startAngle) * clampedLevel;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    const needleTipX = pivotX + Math.cos(needleAngle) * (radius + 2);
    const needleTipY = pivotY + Math.sin(needleAngle) * (radius + 2);
    ctx.lineTo(needleTipX, needleTipY);
    ctx.strokeStyle = colors.needle;
    ctx.lineWidth = 1.8;
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 3;
    ctx.stroke();
    ctx.restore();

    // Czapka obrotu wskazówki (Needle Pivot Cap)
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 6, 0, Math.PI * 2);
    ctx.fillStyle = colors.needleCap;
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Cyfrowy odczyt dB w dolnym rogu
    const dbValue = clampedLevel <= 0.01 ? '-∞ dB' : `${((clampedLevel - 0.75) * 12).toFixed(1)} dB`;
    ctx.font = '700 8.5px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.textDark;
    ctx.fillText(dbValue, pivotX, faceH - 2);

    ctx.restore();
  };

  return (
    <div
      className={`glass-card ${className || ''}`}
      style={{
        padding: '12px 14px',
        borderRadius: '16px',
        background: 'rgba(15, 12, 28, 0.75)',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        ...style,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Gauge size={15} color="var(--accent-pink)" />
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', letterSpacing: '0.04em' }}>
            ANALOG STEREO VU-METER
          </span>
          <span
            style={{
              fontSize: '0.68rem',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              marginLeft: '4px',
            }}
          >
            BALANCED BALISTIC L/R
          </span>
        </div>

        {/* Selektor motywu podświetlenia wskaźnika */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {[
            { id: 'amber', label: 'Amber 70s', color: '#f59e0b' },
            { id: 'sakura', label: 'Sakura Glow', color: '#ec4899' },
            { id: 'cyber', label: 'Cyber Neon', color: '#06b6d4' },
          ].map((th) => (
            <button
              key={th.id}
              onClick={() => handleSelectTheme(th.id as any)}
              style={{
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '0.68rem',
                fontWeight: 600,
                background: theme === th.id ? `${th.color}33` : 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${theme === th.id ? th.color : 'var(--border-subtle)'}`,
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
          height: '140px',
          borderRadius: '10px',
          display: 'block',
        }}
      />
    </div>
  );
};
