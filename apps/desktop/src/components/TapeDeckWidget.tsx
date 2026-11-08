import React, { useState, useEffect, useRef } from 'react';
import { CassetteTape } from 'lucide-react';

interface TapeDeckWidgetProps {
  isPlaying: boolean;
  positionMs?: number;
  durationMs?: number;
  tempo?: number;
  rate?: number;
  engine?: string;
  isDspActive?: boolean;
  trackTitle?: string;
  artistName?: string;
  style?: React.CSSProperties;
  className?: string;
  size?: number;
}

export type TapeType = 'TYPE_I' | 'TYPE_II' | 'METAL';

export const TapeDeckWidget: React.FC<TapeDeckWidgetProps> = ({
  isPlaying,
  positionMs = 0,
  durationMs = 180000,
  tempo = 1.0,
  rate = 1.0,
  engine = 'Bypass',
  isDspActive,
  trackTitle = 'Nieznany utwór',
  artistName = 'Auralune Master Tape',
  style,
  className,
  size = 230,
}) => {
  const [tapeType, setTapeType] = useState<TapeType>('TYPE_II');
  const [tapeSpeed, setTapeSpeed] = useState<'7.5' | '3.75'>('7.5');

  const dspActive =
    isDspActive !== undefined
      ? isDspActive
      : engine !== 'Bypass' && Boolean(engine);

  const effectiveSpeed = dspActive
    ? Math.max(0.1, Math.min(4.0, (tempo || 1.0) * (rate || 1.0)))
    : 1.0;

  // Procent postępu odtwarzania (0.0 do 1.0)
  const progress = durationMs > 0 ? Math.min(1.0, Math.max(0.0, positionMs / durationMs)) : 0.0;

  // Kąty obrotu obu szpul
  const leftAngleRef = useRef<number>(0);
  const rightAngleRef = useRef<number>(0);
  const leftSpeedRef = useRef<number>(0);
  const rightSpeedRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(performance.now());

  const leftSpoolRef = useRef<SVGGElement | null>(null);
  const rightSpoolRef = useRef<SVGGElement | null>(null);
  const pinchRollerRef = useRef<SVGGElement | null>(null);

  // Promienie nawoju taśmy (lewa ubywa, prawa przybywa)
  const leftTapeRadius = 38 - progress * 20; // 38 -> 18
  const rightTapeRadius = 18 + progress * 20; // 18 -> 38

  useEffect(() => {
    let animId: number;
    lastTimeRef.current = performance.now();

    const speedMultiplier = tapeSpeed === '7.5' ? 1.0 : 0.5;
    const baseLinearVelocity = 220 * effectiveSpeed * speedMultiplier;

    const animateTape = (now: number) => {
      const dt = Math.min(0.1, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;

      // Zgodnie z mechaniką szpulowca: prędkość kątowa ω = v / r
      const targetLeftSpeed = isPlaying ? (baseLinearVelocity / leftTapeRadius) * 32 : 0;
      const targetRightSpeed = isPlaying ? (baseLinearVelocity / rightTapeRadius) * 32 : 0;

      // Bezwładność szpul (lerp)
      const lerp = isPlaying ? 0.09 : 0.05;
      leftSpeedRef.current += (targetLeftSpeed - leftSpeedRef.current) * lerp;
      rightSpeedRef.current += (targetRightSpeed - rightSpeedRef.current) * lerp;

      if (!isPlaying && Math.abs(leftSpeedRef.current) < 0.1) leftSpeedRef.current = 0;
      if (!isPlaying && Math.abs(rightSpeedRef.current) < 0.1) rightSpeedRef.current = 0;

      if (leftSpeedRef.current > 0.01) {
        leftAngleRef.current = (leftAngleRef.current + leftSpeedRef.current * dt) % 360;
        if (leftSpoolRef.current) {
          leftSpoolRef.current.setAttribute('transform', `rotate(${leftAngleRef.current.toFixed(2)} 65 75)`);
        }
      }

      if (rightSpeedRef.current > 0.01) {
        rightAngleRef.current = (rightAngleRef.current + rightSpeedRef.current * dt) % 360;
        if (rightSpoolRef.current) {
          rightSpoolRef.current.setAttribute('transform', `rotate(${rightAngleRef.current.toFixed(2)} 175 75)`);
        }
      }

      if (pinchRollerRef.current && (leftSpeedRef.current > 0.01 || rightSpeedRef.current > 0.01)) {
        pinchRollerRef.current.setAttribute(
          'transform',
          `rotate(${((rightAngleRef.current * 1.8) % 360).toFixed(2)} 158 135)`
        );
      }

      animId = requestAnimationFrame(animateTape);
    };

    animId = requestAnimationFrame(animateTape);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, effectiveSpeed, tapeSpeed, leftTapeRadius, rightTapeRadius]);

  // Licznik obrotów taśmy (Tape Counter 4-cyfrowy)
  const tapeCounterVal = Math.floor((positionMs / 1000) * (tapeSpeed === '7.5' ? 2.8 : 1.4));
  const counterFormatted = String(tapeCounterVal % 10000).padStart(4, '0');

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(145deg, rgba(28, 22, 45, 0.95), rgba(14, 11, 24, 0.98))',
        border: '1px solid rgba(168, 85, 247, 0.35)',
        borderRadius: '16px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxShadow: '0 12px 35px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
        ...style,
      }}
    >
      {/* Header Decka */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.68rem',
          fontWeight: 700,
          color: '#cbd5e1',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <CassetteTape size={14} style={{ color: 'var(--accent-pink, #ec4899)' }} />
          <span style={{ letterSpacing: '0.08em', color: '#f8fafc' }}>STUDIO TAPE DECK</span>
        </div>

        {/* Mechaniczny licznik cyfrowy */}
        <div
          style={{
            background: '#09070f',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '4px',
            padding: '1px 6px',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.74rem',
            color: '#34d399',
            letterSpacing: '0.12em',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8)',
          }}
          title="Licznik taśmy magnetycznej"
        >
          {counterFormatted}
        </div>
      </div>

      {/* Widok szpul i głowicy (SVG) */}
      <div style={{ position: 'relative', width: '100%', height: '145px', display: 'flex', justifyContent: 'center' }}>
        <svg
          viewBox="0 0 240 155"
          style={{ width: '100%', height: '100%', overflow: 'visible' }}
        >
          <defs>
            {/* Gradient studyjnej taśmy magnetycznej (ciemny tlenek żelaza/chromu) */}
            <radialGradient id="tapePackGrad" cx="50%" cy="50%" r="50%">
              <stop offset="60%" stopColor="#1a0f0a" />
              <stop offset="90%" stopColor="#2c1810" />
              <stop offset="100%" stopColor="#3d2116" />
            </radialGradient>

            {/* Szpula aluminiowa NAB */}
            <linearGradient id="metalSpool" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#94a3b8" />
              <stop offset="50%" stopColor="#cbd5e1" />
              <stop offset="100%" stopColor="#64748b" />
            </linearGradient>
          </defs>

          {/* Podstawa mechanizmu głowic */}
          <rect x="30" y="20" width="180" height="120" rx="8" fill="rgba(10, 8, 18, 0.6)" stroke="rgba(255,255,255,0.06)" />

          {/* Naklejka etykiety taśmy studyjnej (Tape Label Badge) */}
          <rect x="96" y="30" width="48" height="26" rx="3" fill="#1e182f" stroke="#6b21a8" strokeWidth="0.8" />
          <line x1="96" y1="42" x2="144" y2="42" stroke="#4c1d95" strokeWidth="0.6" />
          <text x="120" y="39" textAnchor="middle" fill="#d8b4fe" fontSize="5.5" fontWeight="bold" fontFamily="var(--font-mono, monospace)">
            {artistName.length > 12 ? `${artistName.slice(0, 10)}...` : artistName}
          </text>
          <text x="120" y="50" textAnchor="middle" fill="#f8fafc" fontSize="6.2" fontWeight="bold" fontFamily="var(--font-mono, monospace)">
            {trackTitle.length > 11 ? `${trackTitle.slice(0, 9)}...` : trackTitle}
          </text>

          {/* Ścieżka taśmy łącząca szpule i głowice */}
          <path
            d="M 65 110 L 85 132 L 120 130 L 155 132 L 175 110"
            fill="none"
            stroke="#452317"
            strokeWidth="3.2"
            strokeLinecap="round"
          />

          {/* --- LEWA SZPULA (Podająca / Feed Reel) --- */}
          {/* Nawinięta taśma (zmienna grubość) */}
          <circle cx="65" cy="75" r={leftTapeRadius} fill="url(#tapePackGrad)" stroke="#5c2e1c" strokeWidth="0.8" />
          {/* Obrotowa szpula NAB */}
          <g ref={leftSpoolRef}>
            {/* Korpus szpuli */}
            <circle cx="65" cy="75" r="42" fill="none" stroke="url(#metalSpool)" strokeWidth="1.8" />
            <circle cx="65" cy="75" r="14" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
            <circle cx="65" cy="75" r="4" fill="#0f172a" />
            {/* 3 wycięcia szpuli studyjnej NAB */}
            <path d="M 65 61 L 62 42 L 68 42 Z" fill="url(#metalSpool)" />
            <path d="M 53 82 L 36 92 L 39 97 Z" fill="url(#metalSpool)" />
            <path d="M 77 82 L 94 92 L 91 97 Z" fill="url(#metalSpool)" />
          </g>

          {/* --- PRAWA SZPULA (Odbierająca / Take-up Reel) --- */}
          {/* Nawinięta taśma (zmienna grubość) */}
          <circle cx="175" cy="75" r={rightTapeRadius} fill="url(#tapePackGrad)" stroke="#5c2e1c" strokeWidth="0.8" />
          {/* Obrotowa szpula NAB */}
          <g ref={rightSpoolRef}>
            {/* Korpus szpuli */}
            <circle cx="175" cy="75" r="42" fill="none" stroke="url(#metalSpool)" strokeWidth="1.8" />
            <circle cx="175" cy="75" r="14" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
            <circle cx="175" cy="75" r="4" fill="#0f172a" />
            {/* 3 wycięcia szpuli studyjnej NAB */}
            <path d="M 175 61 L 172 42 L 178 42 Z" fill="url(#metalSpool)" />
            <path d="M 163 82 L 146 92 L 149 97 Z" fill="url(#metalSpool)" />
            <path d="M 187 82 L 204 92 L 201 97 Z" fill="url(#metalSpool)" />
          </g>

          {/* Rolki prowadzące i głowica studyjna (Head Block) */}
          {/* Rolka lewa */}
          <circle cx="85" cy="132" r="6" fill="#475569" stroke="#94a3b8" strokeWidth="1.2" />
          <circle cx="85" cy="132" r="2" fill="#0f172a" />

          {/* Głowica odczytu (Playback Head) */}
          <rect x="111" y="123" width="18" height="14" rx="2" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1.2" />
          <line x1="120" y1="123" x2="120" y2="137" stroke="var(--accent-pink, #ec4899)" strokeWidth="1.2" />

          {/* Capstan i gumowa rolka dociskowa (Pinch Roller) */}
          <circle cx="147" cy="128" r="3" fill="#cbd5e1" />
          <g ref={pinchRollerRef}>
            <circle cx="158" cy="135" r="7" fill="#18181b" stroke="#52525b" strokeWidth="1.5" />
            <circle cx="158" cy="135" r="2" fill="#a1a1aa" />
          </g>
        </svg>
      </div>

      {/* Dolny pasek kontrolny i selektory szpulowca */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.66rem',
          fontWeight: 700,
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          paddingTop: '6px',
        }}
      >
        {/* Wybór prędkości taśmy */}
        <div style={{ display: 'flex', gap: '3px', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '4px' }}>
          <button
            type="button"
            onClick={() => setTapeSpeed('7.5')}
            title="Prędkość studyjna 7½ IPS (19 cm/s)"
            style={{
              padding: '2px 5px',
              borderRadius: '3px',
              border: 'none',
              background: tapeSpeed === '7.5' ? 'var(--accent-purple, #a855f7)' : 'transparent',
              color: tapeSpeed === '7.5' ? '#fff' : 'var(--text-muted, #94a3b8)',
              fontSize: '0.62rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            7½ IPS
          </button>
          <button
            type="button"
            onClick={() => setTapeSpeed('3.75')}
            title="Prędkość standardowa 3¾ IPS (9.5 cm/s)"
            style={{
              padding: '2px 5px',
              borderRadius: '3px',
              border: 'none',
              background: tapeSpeed === '3.75' ? 'var(--accent-purple, #a855f7)' : 'transparent',
              color: tapeSpeed === '3.75' ? '#fff' : 'var(--text-muted, #94a3b8)',
              fontSize: '0.62rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            3¾ IPS
          </button>
        </div>

        {/* Wskaźnik typu taśmy */}
        <div style={{ display: 'flex', gap: '3px', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '4px' }}>
          <button
            type="button"
            onClick={() => setTapeType('TYPE_I')}
            style={{
              padding: '2px 4px',
              borderRadius: '3px',
              border: 'none',
              background: tapeType === 'TYPE_I' ? 'var(--accent-pink, #ec4899)' : 'transparent',
              color: tapeType === 'TYPE_I' ? '#fff' : 'var(--text-muted, #94a3b8)',
              fontSize: '0.6rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            FE-I
          </button>
          <button
            type="button"
            onClick={() => setTapeType('TYPE_II')}
            style={{
              padding: '2px 4px',
              borderRadius: '3px',
              border: 'none',
              background: tapeType === 'TYPE_II' ? 'var(--accent-pink, #ec4899)' : 'transparent',
              color: tapeType === 'TYPE_II' ? '#fff' : 'var(--text-muted, #94a3b8)',
              fontSize: '0.6rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            CR-II
          </button>
          <button
            type="button"
            onClick={() => setTapeType('METAL')}
            style={{
              padding: '2px 4px',
              borderRadius: '3px',
              border: 'none',
              background: tapeType === 'METAL' ? 'var(--accent-pink, #ec4899)' : 'transparent',
              color: tapeType === 'METAL' ? '#fff' : 'var(--text-muted, #94a3b8)',
              fontSize: '0.6rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            METAL
          </button>
        </div>

        {/* Dioda Play / Rec State */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: isPlaying ? '#10b981' : '#64748b',
              boxShadow: isPlaying ? '0 0 6px #10b981' : 'none',
              transition: 'all 0.2s ease',
            }}
          />
          <span style={{ fontSize: '0.62rem', color: isPlaying ? '#34d399' : '#64748b' }}>
            {isPlaying ? (effectiveSpeed !== 1.0 ? `${effectiveSpeed.toFixed(2)}x` : 'PLAY') : 'STOP'}
          </span>
        </div>
      </div>
    </div>
  );
};
