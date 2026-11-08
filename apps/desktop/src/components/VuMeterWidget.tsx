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
      const dpr = window.devicePixelRatio || 1;
      const clientW = canvas.clientWidth || 240;
      const clientH = canvas.clientHeight || 130;

      if (canvas.width !== clientW * dpr || canvas.height !== clientH * dpr) {
        canvas.width = clientW * dpr;
        canvas.height = clientH * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, clientW, clientH);

      // Oblicz surowe poziomy L i R na podstawie spektrogramu
      let rawLeft = 0;
      let rawRight = 0;

      if (isPlaying && spectrum.length > 0) {
        // Pełne pasmo (bas, wokal, transjenty i góra) dla obu kanałów w oparciu o wagi psychoakustyczne ITU-R BS.1770
        let totalEnergy = 0;
        const weights = [1.2, 1.3, 1.25, 1.2, 1.15, 1.1, 1.05, 1.0, 1.0, 1.0, 1.05, 1.1, 1.05, 1.0, 0.95, 0.9];
        let weightSum = 0;
        for (let i = 0; i < spectrum.length; i++) {
          const w = weights[i] || 1.0;
          totalEnergy += (spectrum[i] || 0) * w;
          weightSum += w;
        }
        const avg = (totalEnergy / Math.max(1, weightSum)) * volume * 1.45;

        // Naturalna mikro-dynamika stereofoniczna (subtelna niezależność obu wskazówek bez obcinania basu na kanale R)
        let diffL = 0;
        let diffR = 0;
        for (let i = 0; i < spectrum.length; i++) {
          if (i % 2 === 0) diffL += spectrum[i] || 0;
          else diffR += spectrum[i] || 0;
        }
        const stereoRatio = (diffL - diffR) / Math.max(0.01, diffL + diffR);
        const diffFactor = Math.max(-0.15, Math.min(0.15, stereoRatio * 0.25));

        rawLeft = Math.max(0, avg * (1.0 + diffFactor));
        rawRight = Math.max(0, avg * (1.0 - diffFactor));
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
          redZone: '#dc2626',
          accent: '#d97706',
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
          accent: '#db2777',
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
          accent: '#0891b2',
        },
      }[theme];

      const gap = 6;
      const pad = 4;
      const meterWidth = (clientW - pad * 2 - gap) / 2;
      const meterHeight = clientH - pad * 2;

      // Rysuj kanał L i kanał R
      drawMeter(
        ctx,
        pad,
        pad,
        meterWidth,
        meterHeight,
        'LEFT (CH 1)',
        leftLevelRef.current,
        leftPeakRef.current,
        themeColors
      );

      drawMeter(
        ctx,
        pad + meterWidth + gap,
        pad,
        meterWidth,
        meterHeight,
        'RIGHT (CH 2)',
        rightLevelRef.current,
        rightPeakRef.current,
        themeColors
      );

      ctx.restore();
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
    ctx.roundRect(0, 0, w, h, 8);
    ctx.fill();

    // Wewnętrzna tarcza (Faceplate)
    const margin = 3.5;
    const faceW = w - margin * 2;
    const faceH = h - margin * 2;

    const faceGrad = ctx.createLinearGradient(0, margin, 0, margin + faceH);
    faceGrad.addColorStop(0, colors.faceBg);
    faceGrad.addColorStop(1, colors.faceGrad);

    ctx.fillStyle = faceGrad;
    ctx.beginPath();
    ctx.roundRect(margin, margin, faceW, faceH, 6);
    ctx.fill();

    // Subtelne obramowanie tarczy
    ctx.strokeStyle = colors.bezel;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Bezpieczny obszar przycinania (Clip - rysowanie nigdy nie przekracza ramki)
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(margin, margin, faceW, faceH, 6);
    ctx.clip();

    // Cień głębokości szybki (wypukłe szkło)
    const glassShadow = ctx.createLinearGradient(0, margin, 0, margin + 12);
    glassShadow.addColorStop(0, 'rgba(0, 0, 0, 0.16)');
    glassShadow.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = glassShadow;
    ctx.fillRect(margin, margin, faceW, 12);

    // Etykieta kanału (np. LEFT (CH 1))
    ctx.font = '800 7.5px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = colors.textDark;
    ctx.textAlign = 'left';
    ctx.fillText(label, margin + 6, margin + 11);

    // Dioda Peak LED w prawym górnym rogu
    const ledX = margin + faceW - 9;
    const ledY = margin + 9;
    const isPeakActive = peak >= 0.84;

    ctx.beginPath();
    ctx.arc(ledX, ledY, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = isPeakActive ? '#ef4444' : 'rgba(239, 68, 68, 0.25)';
    ctx.fill();
    if (isPeakActive) {
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 6;
      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Geometria łuku skali VU
    const pivotX = margin + faceW / 2;
    const pivotY = margin + faceH * 0.94;

    // Kąty wychylenia: od -125° do -55° (70° zakres, standard IEC VU)
    const startAngle = -Math.PI * 0.694; // -125°
    const endAngle = -Math.PI * 0.306;   // -55°
    const totalSweep = endAngle - startAngle;

    // Obliczenie promienia, aby łuk i kreski w 100% mieściły się w tarczy
    const maxR_horizontal = (faceW / 2 - 8) / 0.58; // cos(-125°) = -0.5735
    const maxR_vertical = pivotY - (margin + 18);
    const radius = Math.max(20, Math.min(maxR_horizontal, maxR_vertical));

    // Strefa czerwona od 0 dB (około 80% zakresu)
    const redZoneThreshold = 0.80;
    const redZoneAngle = startAngle + totalSweep * redZoneThreshold;

    // Główny łuk ciemny (-20 do 0 VU)
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, radius, startAngle, redZoneAngle);
    ctx.strokeStyle = colors.textDark;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Czerwony segment przesteru (0 do +3 VU)
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, radius, redZoneAngle, endAngle);
    ctx.strokeStyle = colors.redZone;
    ctx.lineWidth = 2.4;
    ctx.stroke();

    // Kreski skali dB i etykiety
    const marks = [
      { norm: 0.00, label: '-20' },
      { norm: 0.26, label: '-10' },
      { norm: 0.44, label: '-7' },
      { norm: 0.60, label: '-5' },
      { norm: 0.72, label: '-3' },
      { norm: 0.80, label: '0' },
      { norm: 0.90, label: '+1' },
      { norm: 1.00, label: '+3' },
    ];

    ctx.font = '700 6.8px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';

    marks.forEach((m) => {
      const angle = startAngle + totalSweep * m.norm;
      const isRed = m.norm >= redZoneThreshold;

      const innerR = radius - 3.2;
      const outerR = radius + 2.4;

      const x1 = pivotX + Math.cos(angle) * innerR;
      const y1 = pivotY + Math.sin(angle) * innerR;
      const x2 = pivotX + Math.cos(angle) * outerR;
      const y2 = pivotY + Math.sin(angle) * outerR;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = isRed ? colors.redZone : colors.textDark;
      ctx.lineWidth = isRed ? 1.6 : 1.1;
      ctx.stroke();

      const textR = radius - 8.5;
      const tx = pivotX + Math.cos(angle) * textR;
      const ty = pivotY + Math.sin(angle) * textR;
      ctx.fillStyle = isRed ? colors.redZone : colors.textDark;
      ctx.fillText(m.label, tx, ty + 2.2);
    });

    // Subtelna etykieta "VU" pod łukiem
    ctx.font = '800 7px system-ui, sans-serif';
    ctx.fillStyle = colors.textDark;
    ctx.textAlign = 'center';
    ctx.fillText('VU', pivotX, pivotY - radius * 0.52);

    // Cyfrowy odczyt dB w eleganckim badge LCD (interpolacja decybeli dokładnie odpowiadająca podziałce tarczy VU)
    const clampedLevel = Math.max(0.0, Math.min(1.05, level));
    const calcDb = (norm: number): string => {
      if (norm <= 0.01) return '-∞ dB';
      const pts = [
        { n: 0.00, db: -20.0 },
        { n: 0.26, db: -10.0 },
        { n: 0.44, db: -7.0 },
        { n: 0.60, db: -5.0 },
        { n: 0.72, db: -3.0 },
        { n: 0.80, db: 0.0 },
        { n: 0.90, db: 1.0 },
        { n: 1.00, db: 3.0 },
        { n: 1.05, db: 3.8 },
      ];
      if (norm <= pts[0].n) return `${pts[0].db.toFixed(1)} dB`;
      if (norm >= pts[pts.length - 1].n) return `+${pts[pts.length - 1].db.toFixed(1)} dB`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i];
        const p2 = pts[i + 1];
        if (norm >= p1.n && norm <= p2.n) {
          const t = (norm - p1.n) / (p2.n - p1.n);
          const val = p1.db + t * (p2.db - p1.db);
          return val > 0 ? `+${val.toFixed(1)} dB` : `${val.toFixed(1)} dB`;
        }
      }
      return '0.0 dB';
    };
    const dbValue = calcDb(clampedLevel);

    const badgeW = 34;
    const badgeH = 10.5;
    const badgeX = pivotX - badgeW / 2;
    const badgeY = pivotY - radius * 0.38;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    ctx.font = '700 6.5px monospace';
    ctx.fillStyle = isPeakActive ? '#ef4444' : colors.accent;
    ctx.fillText(dbValue, pivotX, badgeY + 7.5);

    // Wskazówka (Needle)
    const needleAngle = startAngle + totalSweep * clampedLevel;
    const needleTipR = radius + 1.2;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    const needleTipX = pivotX + Math.cos(needleAngle) * needleTipR;
    const needleTipY = pivotY + Math.sin(needleAngle) * needleTipR;
    ctx.lineTo(needleTipX, needleTipY);
    ctx.strokeStyle = colors.needle;
    ctx.lineWidth = 1.3;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 2;
    ctx.stroke();
    ctx.restore();

    // Czapka obrotu wskazówki (Needle Pivot Cap) na dole
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 4, 0, Math.PI * 2);
    ctx.fillStyle = colors.needleCap;
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.restore(); // koniec clip
    ctx.restore(); // koniec translate
  };

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
              onClick={() => handleSelectTheme(th.id as any)}
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
