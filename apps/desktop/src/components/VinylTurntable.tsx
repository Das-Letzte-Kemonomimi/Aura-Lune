import React, { useState, useEffect, useRef } from 'react';
import { Disc, Sparkles, X } from 'lucide-react';
import { vinylSimulator, type VinylSimConfig } from '../utils/vinylSimulator';

interface VinylTurntableProps {
  coverUrl?: string | null;
  isPlaying: boolean;
  tempo?: number; // mnożnik tempa DSP (np. 0.35x - 3.00x)
  rate?: number;  // mnożnik szybkości odtwarzania (np. 1.0x)
  engine?: string; // aktualny silnik DSP: 'Bypass' | 'RubberBand' | 'SoundTouch'
  isDspActive?: boolean; // czy DSP aktywnie przetwarza (nie jest w Direct Bypass)
  bpm?: number | null;
  trackTitle?: string;
  artistName?: string;
  onTogglePlayPause?: () => void;
  style?: React.CSSProperties;
  className?: string;
  size?: number;
}

export const VinylTurntable: React.FC<VinylTurntableProps> = ({
  coverUrl,
  isPlaying,
  tempo = 1.0,
  rate = 1.0,
  engine = 'Bypass',
  isDspActive,
  bpm,
  trackTitle = 'Nieznany utwór',
  artistName = 'Auralune Player',
  onTogglePlayPause,
  style,
  className,
  size = 280,
}) => {
  const [rpm, setRpm] = useState<33 | 45>(33);
  const [simConfig, setSimConfig] = useState<VinylSimConfig>(() => vinylSimulator.getConfig());
  const [showFxPopover, setShowFxPopover] = useState(false);

  useEffect(() => {
    const unsub = vinylSimulator.subscribe(setSimConfig);
    return unsub;
  }, []);

  useEffect(() => {
    vinylSimulator.setPlaybackState(isPlaying);
  }, [isPlaying]);

  useEffect(() => {
    vinylSimulator.setRpm(rpm);
  }, [rpm]);

  // Weryfikacja czy DSP aktywnie moduluje strumień audio, czy działa Direct Bypass:
  // W trybie Direct Bypass dźwięk płynie bit-perfect z prędkością 1.0x, więc płyta obraca się z nominalną prędkością!
  const dspActive = isDspActive !== undefined
    ? isDspActive
    : (engine !== 'Bypass' && Boolean(engine));

  // Efektywny mnożnik prędkości obrotu płyty zsynchronizowany z DSP (Tempo + Rate)
  const effectiveSpeed = dspActive
    ? Math.max(0.1, Math.min(4.0, (tempo || 1.0) * (rate || 1.0)))
    : 1.0;

  // Obliczenie aktualnej fizycznej prędkości obrotowej (RPM)
  const currentRpm = (rpm * effectiveSpeed).toFixed(1);

  // Kąt obrotu płyty i fizyczna prędkość kątowa z płynną bezwładnością (Direct-Drive motor inertia)
  const platterRef = useRef<HTMLDivElement | null>(null);
  const angleRef = useRef<number>(0);
  const currentSpeedRef = useRef<number>(0); // w stopniach na sekundę
  const lastTimeRef = useRef<number>(performance.now());
  const [displayRpm, setDisplayRpm] = useState<string>(currentRpm);

  // Docelowa prędkość w stopniach na sekundę:
  // 33 1/3 RPM = 33.333 * 360 / 60 = 200 deg/s
  // 45 RPM = 45 * 360 / 60 = 270 deg/s
  const baseDegPerSec = rpm === 33 ? 200 : 270;
  const targetDegPerSec = isPlaying ? baseDegPerSec * effectiveSpeed : 0;

  useEffect(() => {
    setDisplayRpm(currentRpm);
  }, [currentRpm]);

  useEffect(() => {
    let animId: number;
    lastTimeRef.current = performance.now();

    const updatePlatter = (now: number) => {
      const dt = Math.min(0.1, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;

      // Płynne nabieranie i wytracanie prędkości (bezwładność silnika)
      const lerpFactor = isPlaying ? 0.08 : 0.04;
      currentSpeedRef.current += (targetDegPerSec - currentSpeedRef.current) * lerpFactor;

      // Jeśli prędkość jest bardzo mała i nie odtwarzamy, całkowicie zatrzymaj
      if (!isPlaying && Math.abs(currentSpeedRef.current) < 0.1) {
        currentSpeedRef.current = 0;
      }

      // Aktualizacja kąta obrotu
      if (currentSpeedRef.current > 0.01) {
        angleRef.current = (angleRef.current + currentSpeedRef.current * dt) % 360;
        if (platterRef.current) {
          platterRef.current.style.transform = `rotate(${angleRef.current.toFixed(2)}deg)`;
        }
      }

      animId = requestAnimationFrame(updatePlatter);
    };

    animId = requestAnimationFrame(updatePlatter);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isPlaying, targetDegPerSec]);

  // Kąt ramienia gramofonu:
  // Spoczynek (park): -28 stopni
  // Odtwarzanie (na płycie): ok. 18-24 stopni
  const tonearmAngle = isPlaying ? '20deg' : '-28deg';

  return (
    <div
      className={`glass-card ${className || ''}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '24px',
        padding: '16px',
        background: 'linear-gradient(145deg, #181528, #0d0a17)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: isPlaying
          ? '0 12px 36px rgba(244, 63, 94, 0.25), inset 0 0 20px rgba(0, 0, 0, 0.8)'
          : '0 8px 24px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(0, 0, 0, 0.8)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        userSelect: 'none',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* Talerz gramofonowy (Platter) z płytą winylową */}
      <div
        onClick={onTogglePlayPause}
        title={`${isPlaying ? 'Pauza' : 'Odtwarzaj'} • ${artistName} - ${trackTitle}`}
        style={{
          width: `${size - 56}px`,
          height: `${size - 56}px`,
          borderRadius: '50%',
          position: 'relative',
          cursor: 'pointer',
          background: 'radial-gradient(circle, #080a10 25%, #151922 45%, #05070a 75%, #020306 100%)',
          border: '4px solid #232a3b',
          boxShadow: '0 0 16px rgba(0,0,0,0.9), inset 0 0 12px rgba(0,0,0,0.95)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Obracająca się warstwa winylu (Grooves + Dynamic Highlights + Center Label) */}
        <div
          ref={platterRef}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            willChange: 'transform',
          }}
        >
          {/* Rowki płyty winylowej z teksturą mikrorowków */}
          <div
            style={{
              position: 'absolute',
              inset: '6px',
              borderRadius: '50%',
              background:
                'repeating-radial-gradient(circle, transparent 0, transparent 2px, rgba(255, 255, 255, 0.035) 3px, transparent 4px)',
              pointerEvents: 'none',
            }}
          />

          {/* Optyczny refleks światła na rowkach winylu (krzyż optyczny) */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background:
                'conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,0.08) 45deg, transparent 90deg, transparent 180deg, rgba(255,255,255,0.08) 225deg, transparent 270deg)',
              pointerEvents: 'none',
            }}
          />

          {/* Centralna etykieta płyty (Spindle Label) z okładką albumu */}
          <div
            style={{
              width: `${Math.round((size - 56) * 0.44)}px`,
              height: `${Math.round((size - 56) * 0.44)}px`,
              borderRadius: '50%',
              overflow: 'hidden',
              position: 'relative',
              border: '3px solid #1a1727',
              boxShadow: '0 0 8px rgba(0,0,0,0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: coverUrl
                ? `url("${coverUrl}") center/cover no-repeat`
                : 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
            }}
          >
            {!coverUrl && <Disc size={28} color="#fff" />}

            {/* Centralny trzpień (Spindle hole) */}
            <div
              style={{
                position: 'absolute',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: '#0a0812',
                border: '2px solid silver',
                boxShadow: 'inset 0 0 4px #000',
              }}
            />
          </div>
        </div>
      </div>

      {/* Ramię gramofonowe (Tonearm) */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          right: '18px',
          width: '50px',
          height: `${size - 40}px`,
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        {/* Podstawa ramienia (Tonearm Base & Gimbal) */}
        <div
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, #71717a 20%, #27272a 70%, #09090b 100%)',
            border: '2px solid #3f3f46',
            boxShadow: '0 4px 8px rgba(0,0,0,0.6)',
          }}
        />

        {/* Ruchome ramię z przeciwwagą i główką igły */}
        <div
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            width: '4px',
            height: `${size - 100}px`,
            transformOrigin: 'top center',
            transform: `rotate(${tonearmAngle})`,
            transition: 'transform 0.85s cubic-bezier(0.34, 1.56, 0.64, 1)',
            background: 'linear-gradient(to right, #d4d4d8, #a1a1aa, #71717a)',
            boxShadow: '2px 4px 8px rgba(0,0,0,0.5)',
            borderRadius: '2px',
          }}
        >
          {/* Przeciwwaga (Counterweight na górze) */}
          <div
            style={{
              position: 'absolute',
              top: '-12px',
              left: '-8px',
              width: '20px',
              height: '14px',
              borderRadius: '3px',
              background: '#27272a',
              border: '1px solid #52525b',
            }}
          />

          {/* Główka z wkładką i igłą (Headshell / Cartridge na dole) */}
          <div
            style={{
              position: 'absolute',
              bottom: '-14px',
              left: '-4px',
              width: '12px',
              height: '20px',
              borderRadius: '2px',
              background: '#e11d48',
              boxShadow: isPlaying ? '0 0 6px rgba(225, 29, 72, 0.8)' : 'none',
              border: '1px solid #9f1239',
              transform: 'rotate(15deg)',
            }}
          />
        </div>
      </div>

      {/* Dolny pasek kontrolny gramofonu: Przełącznik prędkości RPM i Strobe */}
      <div
        style={{
          position: 'absolute',
          bottom: '10px',
          left: '16px',
          right: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.7rem',
          fontWeight: 700,
        }}
      >
        {/* Przełącznik 33 / 45 RPM & Lo-Fi Analog FX */}
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.4)', padding: '2px', borderRadius: '6px', alignItems: 'center' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setRpm(33);
            }}
            title="Prędkość nominalna 33⅓ RPM"
            style={{
              padding: '2px 7px',
              borderRadius: '4px',
              border: 'none',
              background: rpm === 33 ? 'var(--accent-pink)' : 'transparent',
              color: rpm === 33 ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '0.68rem',
              fontWeight: 700,
              transition: 'all 0.15s ease',
            }}
          >
            33⅓
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setRpm(45);
            }}
            title="Prędkość nominalna 45 RPM"
            style={{
              padding: '2px 7px',
              borderRadius: '4px',
              border: 'none',
              background: rpm === 45 ? 'var(--accent-pink)' : 'transparent',
              color: rpm === 45 ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '0.68rem',
              fontWeight: 700,
              transition: 'all 0.15s ease',
            }}
          >
            45
          </button>

          {/* Przycisk i menu Lo-Fi Analog FX */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowFxPopover((prev) => !prev);
              }}
              title="Symulator analogowego szumu winylu i taśmy (Lo-Fi Analog FX)"
              style={{
                padding: '2px 8px',
                borderRadius: '4px',
                border: 'none',
                background: simConfig.enabled
                  ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.9), rgba(236, 72, 153, 0.9))'
                  : 'rgba(255, 255, 255, 0.08)',
                color: simConfig.enabled ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.66rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s ease',
                boxShadow: simConfig.enabled ? '0 0 10px rgba(236, 72, 153, 0.4)' : 'none',
              }}
            >
              <Sparkles size={11} style={{ color: simConfig.enabled ? '#ffd1f9' : 'currentColor' }} />
              <span>{simConfig.enabled ? `${simConfig.mode === 'vinyl' ? 'VINYL' : 'TAPE'} ${Math.round(simConfig.intensity * 100)}%` : 'LO-FI'}</span>
            </button>

            {/* Popover z regulacją parametrów Lo-Fi */}
            {showFxPopover && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  bottom: '32px',
                  left: '0',
                  width: '210px',
                  background: 'rgba(20, 16, 32, 0.96)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(168, 85, 247, 0.35)',
                  borderRadius: '10px',
                  padding: '12px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.6), 0 0 15px rgba(168, 85, 247, 0.25)',
                  zIndex: 50,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  color: '#f8fafc',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#f3e8ff' }}>
                    Analog Lo-Fi FX
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem' }}>
                  <span style={{ color: '#cbd5e1' }}>Efekt analogowy:</span>
                  <button
                    onClick={() => vinylSimulator.setEnabled(!simConfig.enabled)}
                    style={{
                      padding: '2px 10px',
                      borderRadius: '12px',
                      border: 'none',
                      background: simConfig.enabled ? 'var(--accent-pink)' : 'rgba(255,255,255,0.12)',
                      color: '#fff',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {simConfig.enabled ? 'WŁ' : 'WYŁ'}
                  </button>
                </div>

                {/* Wybór stylu: Winyl vs Taśma */}
                <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '6px' }}>
                  <button
                    onClick={() => vinylSimulator.setMode('vinyl')}
                    style={{
                      flex: 1,
                      padding: '3px 0',
                      borderRadius: '4px',
                      border: 'none',
                      background: simConfig.mode === 'vinyl' ? 'var(--accent-purple)' : 'transparent',
                      color: simConfig.mode === 'vinyl' ? '#fff' : '#94a3b8',
                      fontSize: '0.66rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    💿 Winyl
                  </button>
                  <button
                    onClick={() => vinylSimulator.setMode('tape')}
                    style={{
                      flex: 1,
                      padding: '3px 0',
                      borderRadius: '4px',
                      border: 'none',
                      background: simConfig.mode === 'tape' ? 'var(--accent-purple)' : 'transparent',
                      color: simConfig.mode === 'tape' ? '#fff' : '#94a3b8',
                      fontSize: '0.66rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    📼 Taśma
                  </button>
                </div>

                {/* Suwak intensywności szumu */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#cbd5e1', marginBottom: '4px' }}>
                    <span>Poziom szumu i trzasków:</span>
                    <strong style={{ color: 'var(--accent-pink)' }}>{Math.round(simConfig.intensity * 100)}%</strong>
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
                      accentColor: 'var(--accent-pink)',
                      cursor: 'pointer',
                      height: '4px',
                    }}
                  />
                </div>

                {/* Auto-sync z odtwarzaniem */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem', color: '#cbd5e1', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={simConfig.autoSync}
                    onChange={(e) => vinylSimulator.setAutoSync(e.target.checked)}
                    style={{ accentColor: 'var(--accent-purple)' }}
                  />
                  <span>Tylko podczas odtwarzania</span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Dynamiczny wskaźnik prędkości Direct Drive z uwzględnieniem DSP */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-muted)' }}>
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: isPlaying ? '#22c55e' : '#ef4444',
              boxShadow: isPlaying ? '0 0 6px #22c55e' : 'none',
              transition: 'background 0.3s ease',
            }}
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.66rem' }}>
            {isPlaying
              ? `${displayRpm} RPM • ${
                  dspActive && effectiveSpeed !== 1.0
                    ? `${effectiveSpeed.toFixed(2)}x ${engine || 'DSP'}`
                    : (dspActive ? 'DIRECT DRIVE' : 'BYPASS (1.0x)')
                }${bpm ? ` (${Math.round(bpm * effectiveSpeed)} BPM)` : ''}`
              : 'STANDBY'}
          </span>
        </div>
      </div>
    </div>
  );
};
