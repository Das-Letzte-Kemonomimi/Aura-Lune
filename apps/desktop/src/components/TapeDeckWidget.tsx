import React, { useState, useEffect, useRef } from 'react';
import { CassetteTape, Sparkles, X } from 'lucide-react';
import { vinylSimulator, type VinylSimConfig } from '../utils/vinylSimulator';

export type TapeType = 'TYPE_I' | 'TYPE_II' | 'METAL';

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
  tapeType?: TapeType;
  onTapeTypeChange?: (type: TapeType) => void;
  tapeSpeed?: '7.5' | '3.75';
  onTapeSpeedChange?: (speed: '7.5' | '3.75') => void;
  style?: React.CSSProperties;
  className?: string;
  size?: number;
}

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
  tapeType: controlledTapeType,
  onTapeTypeChange,
  tapeSpeed: controlledTapeSpeed,
  onTapeSpeedChange,
  style,
  className,
  size = 265,
}) => {
  const [localTapeType, setLocalTapeType] = useState<TapeType>('TYPE_II');
  const tapeType = controlledTapeType !== undefined ? controlledTapeType : localTapeType;
  const setTapeType = (type: TapeType) => {
    setLocalTapeType(type);
    onTapeTypeChange?.(type);
    vinylSimulator.setMode('tape');
  };

  const [localTapeSpeed, setLocalTapeSpeed] = useState<'7.5' | '3.75'>('7.5');
  const tapeSpeed = controlledTapeSpeed !== undefined ? controlledTapeSpeed : localTapeSpeed;
  const setTapeSpeed = (speed: '7.5' | '3.75') => {
    setLocalTapeSpeed(speed);
    onTapeSpeedChange?.(speed);
  };

  const [simConfig, setSimConfig] = useState<VinylSimConfig>(() => vinylSimulator.getConfig());
  const [showFxPopover, setShowFxPopover] = useState(false);

  useEffect(() => {
    const unsub = vinylSimulator.subscribe(setSimConfig);
    return unsub;
  }, []);

  useEffect(() => {
    vinylSimulator.setPlaybackState(isPlaying);
  }, [isPlaying]);

  const dspActive =
    isDspActive !== undefined
      ? isDspActive
      : engine !== 'Bypass' && Boolean(engine);

  const effectiveSpeed = dspActive
    ? Math.max(0.1, Math.min(4.0, (tempo || 1.0) * (rate || 1.0)))
    : 1.0;

  // Tematyczne warianty wizualne dla 3 typów taśmy studyjnej
  const currentTheme = {
    TYPE_I: {
      name: 'FE-I',
      biasLabel: 'NORMAL BIAS 120µs',
      tapePackStart: '#200e07',
      tapePackMid: '#38190c',
      tapePackEnd: '#542614',
      tapePath: '#542614',
      spoolStart: '#94a3b8',
      spoolMid: '#cbd5e1',
      spoolEnd: '#64748b',
      spoolHub: '#334155',
      badgeBg: '#2a1a12',
      badgeBorder: '#b45309',
      badgeText: '#fde68a',
      accentColor: '#f59e0b',
      accentGlow: 'rgba(245, 158, 11, 0.45)',
    },
    TYPE_II: {
      name: 'CR-II',
      biasLabel: 'HIGH BIAS 70µs',
      tapePackStart: '#050912',
      tapePackMid: '#0e1726',
      tapePackEnd: '#1b2a42',
      tapePath: '#1b2a42',
      spoolStart: '#1e293b',
      spoolMid: '#475569',
      spoolEnd: '#0f172a',
      spoolHub: '#1e293b',
      badgeBg: '#091e2b',
      badgeBorder: '#0284c7',
      badgeText: '#7dd3fc',
      accentColor: '#06b6d4',
      accentGlow: 'rgba(6, 182, 212, 0.45)',
    },
    METAL: {
      name: 'METAL',
      biasLabel: 'TYPE IV 70µs',
      tapePackStart: '#14121a',
      tapePackMid: '#24202e',
      tapePackEnd: '#3d374d',
      tapePath: '#3d374d',
      spoolStart: '#b45309',
      spoolMid: '#fde047',
      spoolEnd: '#78350f',
      spoolHub: '#451a03',
      badgeBg: '#271f0c',
      badgeBorder: '#eab308',
      badgeText: '#fef08a',
      accentColor: '#eab308',
      accentGlow: 'rgba(234, 179, 8, 0.45)',
    },
  }[tapeType];

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

    // 7½ IPS obraca się dwukrotnie szybciej niż standardowe 3¾ IPS
    const speedMultiplier = tapeSpeed === '7.5' ? 1.0 : 0.5;
    const baseLinearVelocity = 280 * effectiveSpeed * speedMultiplier;

    const animateTape = (now: number) => {
      const dt = Math.min(0.1, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;

      // Zgodnie z mechaniką szpulowca: prędkość kątowa ω = v / r
      const targetLeftSpeed = isPlaying ? (baseLinearVelocity / leftTapeRadius) * 36 : 0;
      const targetRightSpeed = isPlaying ? (baseLinearVelocity / rightTapeRadius) * 36 : 0;

      // Płynna bezwładność szpul (lerp)
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
          `rotate(${((rightAngleRef.current * (tapeSpeed === '7.5' ? 2.4 : 1.2)) % 360).toFixed(2)} 158 135)`
        );
      }

      animId = requestAnimationFrame(animateTape);
    };

    animId = requestAnimationFrame(animateTape);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, effectiveSpeed, tapeSpeed, leftTapeRadius, rightTapeRadius]);

  // Licznik obrotów taśmy (Tape Counter 4-cyfrowy) — na 7.5 IPS tyka 2x szybciej
  const tapeCounterVal = Math.floor((positionMs / 1000) * (tapeSpeed === '7.5' ? 3.2 : 1.6));
  const counterFormatted = String(tapeCounterVal % 10000).padStart(4, '0');

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(145deg, rgba(28, 22, 45, 0.98), rgba(14, 11, 24, 0.98))',
        border: `1px solid ${currentTheme.badgeBorder}66`,
        borderRadius: '20px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxShadow: `0 12px 35px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 0 15px ${currentTheme.accentGlow}`,
        position: 'relative',
        overflow: 'visible',
        userSelect: 'none',
        boxSizing: 'border-box',
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
          paddingBottom: '5px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <CassetteTape size={14} style={{ color: currentTheme.accentColor }} />
          <span style={{ letterSpacing: '0.08em', color: '#f8fafc' }}>STUDIO TAPE DECK</span>
          <span style={{ fontSize: '0.60rem', color: currentTheme.accentColor, fontWeight: 800 }}>
            {currentTheme.name}
          </span>
        </div>

        {/* Mechaniczny licznik cyfrowy */}
        <div
          style={{
            background: '#09070f',
            border: `1px solid ${currentTheme.accentColor}88`,
            borderRadius: '4px',
            padding: '1px 6px',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.74rem',
            color: currentTheme.accentColor,
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
            {/* Dynamiczny gradient taśmy magnetycznej (FE-I vs CR-II vs METAL) */}
            <radialGradient id="tapePackGrad" cx="50%" cy="50%" r="50%">
              <stop offset="60%" stopColor={currentTheme.tapePackStart} />
              <stop offset="90%" stopColor={currentTheme.tapePackMid} />
              <stop offset="100%" stopColor={currentTheme.tapePackEnd} />
            </radialGradient>

            {/* Dynamiczny gradient szpuli NAB (Aluminium vs Tytan vs Złoto) */}
            <linearGradient id="metalSpool" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={currentTheme.spoolStart} />
              <stop offset="50%" stopColor={currentTheme.spoolMid} />
              <stop offset="100%" stopColor={currentTheme.spoolEnd} />
            </linearGradient>
          </defs>

          {/* Podstawa mechanizmu głowic */}
          <rect x="30" y="20" width="180" height="120" rx="8" fill="rgba(10, 8, 18, 0.6)" stroke="rgba(255,255,255,0.06)" />

          {/* Naklejka etykiety taśmy studyjnej (Tape Label Badge) */}
          <rect
            x="86"
            y="28"
            width="68"
            height="28"
            rx="3"
            fill={currentTheme.badgeBg}
            stroke={currentTheme.badgeBorder}
            strokeWidth="0.8"
          />
          <line x1="86" y1="42" x2="154" y2="42" stroke={currentTheme.badgeBorder} strokeWidth="0.5" strokeOpacity="0.5" />
          <text x="120" y="38" textAnchor="middle" fill={currentTheme.badgeText} fontSize="5.2" fontWeight="bold" fontFamily="var(--font-mono, monospace)">
            {artistName.length > 14 ? `${artistName.slice(0, 12)}...` : artistName}
          </text>
          <text x="120" y="48" textAnchor="middle" fill="#f8fafc" fontSize="5.8" fontWeight="bold" fontFamily="var(--font-mono, monospace)">
            {trackTitle.length > 13 ? `${trackTitle.slice(0, 11)}...` : trackTitle}
          </text>
          <text x="120" y="54" textAnchor="middle" fill={currentTheme.accentColor} fontSize="4.2" fontWeight="bold" fontFamily="var(--font-mono, monospace)">
            {currentTheme.biasLabel}
          </text>

          {/* Ścieżka taśmy łącząca szpule i głowice */}
          <path
            d="M 65 110 L 85 132 L 120 130 L 155 132 L 175 110"
            fill="none"
            stroke={currentTheme.tapePath}
            strokeWidth="3.2"
            strokeLinecap="round"
          />

          {/* --- LEWA SZPULA (Podająca / Feed Reel) --- */}
          <circle cx="65" cy="75" r={leftTapeRadius} fill="url(#tapePackGrad)" stroke={currentTheme.badgeBorder} strokeWidth="0.6" />
          <g ref={leftSpoolRef}>
            <circle cx="65" cy="75" r="42" fill="none" stroke="url(#metalSpool)" strokeWidth="1.8" />
            <circle cx="65" cy="75" r="14" fill={currentTheme.spoolHub} stroke={currentTheme.spoolMid} strokeWidth="1.5" />
            <circle cx="65" cy="75" r="4" fill="#0f172a" />
            <path d="M 65 61 L 62 42 L 68 42 Z" fill="url(#metalSpool)" />
            <path d="M 53 82 L 36 92 L 39 97 Z" fill="url(#metalSpool)" />
            <path d="M 77 82 L 94 92 L 91 97 Z" fill="url(#metalSpool)" />
          </g>

          {/* --- PRAWA SZPULA (Odbierająca / Take-up Reel) --- */}
          <circle cx="175" cy="75" r={rightTapeRadius} fill="url(#tapePackGrad)" stroke={currentTheme.badgeBorder} strokeWidth="0.6" />
          <g ref={rightSpoolRef}>
            <circle cx="175" cy="75" r="42" fill="none" stroke="url(#metalSpool)" strokeWidth="1.8" />
            <circle cx="175" cy="75" r="14" fill={currentTheme.spoolHub} stroke={currentTheme.spoolMid} strokeWidth="1.5" />
            <circle cx="175" cy="75" r="4" fill="#0f172a" />
            <path d="M 175 61 L 172 42 L 178 42 Z" fill="url(#metalSpool)" />
            <path d="M 163 82 L 146 92 L 149 97 Z" fill="url(#metalSpool)" />
            <path d="M 187 82 L 204 92 L 201 97 Z" fill="url(#metalSpool)" />
          </g>

          {/* Rolki prowadzące i głowica studyjna (Head Block) */}
          <circle cx="85" cy="132" r="6" fill="#475569" stroke="#94a3b8" strokeWidth="1.2" />
          <circle cx="85" cy="132" r="2" fill="#0f172a" />

          {/* Głowica odczytu (Playback Head) */}
          <rect x="111" y="123" width="18" height="14" rx="2" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1.2" />
          <line x1="120" y1="123" x2="120" y2="137" stroke={currentTheme.accentColor} strokeWidth="1.4" />

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
          zIndex: 20,
        }}
      >
        {/* Wybór prędkości taśmy & Lo-Fi */}
        <div style={{ display: 'flex', gap: '3px', background: 'rgba(0,0,0,0.5)', padding: '2px', borderRadius: '5px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setTapeSpeed('7.5')}
            title="Prędkość studyjna 7½ IPS (19 cm/s — 2x szybszy obrót szpul)"
            style={{
              padding: '2px 5px',
              borderRadius: '3px',
              border: 'none',
              background: tapeSpeed === '7.5' ? 'var(--accent-purple, #a855f7)' : 'transparent',
              color: tapeSpeed === '7.5' ? '#fff' : 'var(--text-muted, #94a3b8)',
              fontSize: '0.62rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            7½ IPS
          </button>
          <button
            type="button"
            onClick={() => setTapeSpeed('3.75')}
            title="Prędkość standardowa 3¾ IPS (9.5 cm/s — połowa prędkości)"
            style={{
              padding: '2px 5px',
              borderRadius: '3px',
              border: 'none',
              background: tapeSpeed === '3.75' ? 'var(--accent-purple, #a855f7)' : 'transparent',
              color: tapeSpeed === '3.75' ? '#fff' : 'var(--text-muted, #94a3b8)',
              fontSize: '0.62rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            3¾ IPS
          </button>

          {/* Przycisk Lo-Fi Tape FX */}
          <button
            type="button"
            onClick={() => setShowFxPopover((prev) => !prev)}
            title="Symulator analogowego szumu taśmy (Tape Hiss & Saturation)"
            style={{
              padding: '2px 6px',
              borderRadius: '3px',
              border: 'none',
              background: simConfig.enabled
                ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.9), rgba(236, 72, 153, 0.9))'
                : 'rgba(255, 255, 255, 0.08)',
              color: simConfig.enabled ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '0.62rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              transition: 'all 0.15s ease',
            }}
          >
            <Sparkles size={10} style={{ color: simConfig.enabled ? '#ffd1f9' : 'currentColor' }} />
            <span>{simConfig.enabled ? `${Math.round(simConfig.intensity * 100)}%` : 'FX'}</span>
          </button>
        </div>

        {/* Selektor typu taśmy (FE-I, CR-II, METAL) */}
        <div style={{ display: 'flex', gap: '2px', background: 'rgba(0,0,0,0.5)', padding: '2px', borderRadius: '5px' }}>
          <button
            type="button"
            onClick={() => setTapeType('TYPE_I')}
            title="Taśma żelazowa (Type I / Ferric Oxide — ciepły analogowy szum, brązowa taśma, srebrne szpule)"
            style={{
              padding: '2px 4px',
              borderRadius: '3px',
              border: 'none',
              background: tapeType === 'TYPE_I' ? '#f59e0b' : 'transparent',
              color: tapeType === 'TYPE_I' ? '#000' : 'var(--text-muted, #94a3b8)',
              fontSize: '0.60rem',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            FE-I
          </button>
          <button
            type="button"
            onClick={() => setTapeType('TYPE_II')}
            title="Taśma chromowa (Type II / Chrome Dioxide — czysta taśma węglowa, tytanowe szpule)"
            style={{
              padding: '2px 4px',
              borderRadius: '3px',
              border: 'none',
              background: tapeType === 'TYPE_II' ? '#06b6d4' : 'transparent',
              color: tapeType === 'TYPE_II' ? '#000' : 'var(--text-muted, #94a3b8)',
              fontSize: '0.60rem',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            CR-II
          </button>
          <button
            type="button"
            onClick={() => setTapeType('METAL')}
            title="Taśma metalowa (Type IV / Pure Metal Particle — luksusowe złote szpule NAB, minimalny szum)"
            style={{
              padding: '2px 4px',
              borderRadius: '3px',
              border: 'none',
              background: tapeType === 'METAL' ? '#eab308' : 'transparent',
              color: tapeType === 'METAL' ? '#000' : 'var(--text-muted, #94a3b8)',
              fontSize: '0.60rem',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            METAL
          </button>
        </div>

        {/* Dioda Play / Rec State */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: isPlaying ? currentTheme.accentColor : '#64748b',
              boxShadow: isPlaying ? `0 0 6px ${currentTheme.accentColor}` : 'none',
              transition: 'all 0.2s ease',
            }}
          />
          <span style={{ fontSize: '0.60rem', color: isPlaying ? currentTheme.accentColor : '#64748b', fontWeight: 700 }}>
            {isPlaying ? (tapeSpeed === '7.5' ? '7.5 IPS' : '3.75 IPS') : 'STOP'}
          </span>
        </div>
      </div>

      {/* Popover z regulacją parametrów Lo-Fi — zakotwiczony bezpośrednio do karty, NIGDY nie wychodzi poza krawędzie */}
      {showFxPopover && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: '36px',
            left: '10px',
            right: '10px',
            width: 'auto',
            background: 'rgba(18, 14, 28, 0.98)',
            backdropFilter: 'blur(16px)',
            border: `1px solid ${currentTheme.accentColor}88`,
            borderRadius: '12px',
            padding: '10px 12px',
            boxShadow: `0 16px 36px rgba(0,0,0,0.85), 0 0 20px ${currentTheme.accentGlow}`,
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            color: '#f8fafc',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: currentTheme.accentColor }}>
              Tape Deck Lo-Fi FX
            </span>
            <button
              onClick={() => setShowFxPopover(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '2px',
              }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Przełącznik Włącz / Wyłącz */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.70rem' }}>
            <span style={{ color: '#cbd5e1' }}>Szum taśmy magnetycznej:</span>
            <button
              onClick={() => {
                vinylSimulator.setMode('tape');
                vinylSimulator.setEnabled(!simConfig.enabled);
              }}
              style={{
                padding: '2px 10px',
                borderRadius: '10px',
                border: 'none',
                background: simConfig.enabled ? currentTheme.accentColor : 'rgba(255,255,255,0.12)',
                color: simConfig.enabled ? '#000' : '#fff',
                fontSize: '0.66rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {simConfig.enabled ? 'WŁ' : 'WYŁ'}
            </button>
          </div>

          {/* Suwak intensywności szumu taśmy */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#cbd5e1', marginBottom: '3px' }}>
              <span>Poziom szumu (Tape Hiss):</span>
              <strong style={{ color: currentTheme.accentColor }}>{Math.round(simConfig.intensity * 100)}%</strong>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={simConfig.intensity}
              onChange={(e) => vinylSimulator.setIntensity(parseFloat(e.target.value))}
              style={{
                width: '100%',
                accentColor: currentTheme.accentColor,
                cursor: 'pointer',
                height: '4px',
              }}
            />
          </div>

          {/* Auto-sync z odtwarzaniem */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.66rem', color: '#cbd5e1', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={simConfig.autoSync}
              onChange={(e) => vinylSimulator.setAutoSync(e.target.checked)}
              style={{ accentColor: currentTheme.accentColor }}
            />
            <span>Tylko podczas odtwarzania</span>
          </label>
        </div>
      )}
    </div>
  );
};
