import React, { useState, useEffect, useRef } from 'react';
import { Disc, Sparkles } from 'lucide-react';
import { vinylSimulator, type VinylSimConfig } from '../utils/vinylSimulator';
import { AnalogLoFiModal } from './AnalogLoFiModal';

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
  rpm?: 33 | 45;
  onRpmChange?: (rpm: 33 | 45) => void;
  onOpenLoFi?: () => void;
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
  rpm: controlledRpm,
  onRpmChange,
  onOpenLoFi,
  style,
  className,
  size = 265,
}) => {
  const [localRpm, setLocalRpm] = useState<33 | 45>(33);
  const rpm = controlledRpm !== undefined ? controlledRpm : localRpm;
  const setRpm = (newRpm: 33 | 45) => {
    setLocalRpm(newRpm);
    onRpmChange?.(newRpm);
  };

  const [simConfig, setSimConfig] = useState<VinylSimConfig>(() => vinylSimulator.getConfig());
  const [internalLoFiModalOpen, setInternalLoFiModalOpen] = useState(false);

  const handleOpenLoFi = () => {
    if (onOpenLoFi) {
      onOpenLoFi();
    } else {
      setInternalLoFiModalOpen(true);
    }
  };

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
  // 33⅓ RPM = ok. 190 deg/s
  // 45 RPM = ok. 285 deg/s (zauważalnie, 50% szybszy obrót fizyczny)
  const baseDegPerSec = rpm === 33 ? 190 : 285;
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
  // Spoczynek (park): 0deg (bezpiecznie wewnątrz plinty gramofonu, w uchwycie ramienia)
  // Odtwarzanie 33⅓ (standardowy 12" LP): ok. +20 stopni (ramię wychyla się w lewo na rowki płyty)
  // Odtwarzanie 45 RPM (format singla 7"): ok. +25 stopni (głębiej na rowki płyty)
  const tonearmAngle = isPlaying ? (rpm === 45 ? '25deg' : '20deg') : '0deg';

  return (
    <div
      className={`glass-card ${className || ''}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '24px',
        padding: '14px',
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
            top: '10px',
            right: '10px',
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, #71717a 20%, #27272a 70%, #09090b 100%)',
            border: '2px solid #3f3f46',
            boxShadow: '0 4px 8px rgba(0,0,0,0.6)',
          }}
        />

        {/* Uchwyt spoczynkowy ramienia (Tonearm Rest / Arm Cradle) */}
        <div
          title="Uchwyt spoczynkowy ramienia gramofonowego"
          style={{
            position: 'absolute',
            top: `${size - 130}px`,
            right: '20px',
            width: '8px',
            height: '14px',
            borderRadius: '2px',
            background: '#27272a',
            border: '1px solid #52525b',
            boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
          }}
        />

        {/* Ruchome ramię z przeciwwagą i główką igły */}
        <div
          style={{
            position: 'absolute',
            top: '23px',
            right: '23px',
            width: '4px',
            height: `${size - 110}px`,
            transformOrigin: 'top center',
            transform: `rotate(${tonearmAngle})`,
            transition: 'transform 0.85s cubic-bezier(0.34, 1.56, 0.64, 1)',
            background: 'linear-gradient(to right, #e4e4e7, #a1a1aa, #71717a)',
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
              transform: 'rotate(-12deg)',
            }}
          />
        </div>
      </div>

      {/* Dolny pasek kontrolny gramofonu: Przełącznik prędkości RPM i Strobe */}
      <div
        style={{
          position: 'absolute',
          bottom: '8px',
          left: '10px',
          right: '10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.7rem',
          fontWeight: 700,
          zIndex: 20,
        }}
      >
        {/* Przełącznik 33 / 45 RPM & Lo-Fi Analog FX */}
        <div style={{ display: 'flex', gap: '3px', background: 'rgba(0,0,0,0.5)', padding: '2px', borderRadius: '6px', alignItems: 'center' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setRpm(33);
            }}
            title="Prędkość nominalna 33⅓ RPM (Standardowy 12″ LP)"
            style={{
              padding: '2px 6px',
              borderRadius: '4px',
              border: 'none',
              background: rpm === 33 ? 'var(--accent-pink)' : 'transparent',
              color: rpm === 33 ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '0.66rem',
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
            title="Prędkość nominalna 45 RPM (Singiel 7″, szybszy obrót fizyczny)"
            style={{
              padding: '2px 6px',
              borderRadius: '4px',
              border: 'none',
              background: rpm === 45 ? 'var(--accent-pink)' : 'transparent',
              color: rpm === 45 ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '0.66rem',
              fontWeight: 700,
              transition: 'all 0.15s ease',
            }}
          >
            45
          </button>

          {/* Przycisk Lo-Fi Analog FX — otwiera pełne okno dialogowe Popup */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenLoFi();
            }}
            title="Otwórz studio analogowego szumu winylu i taśmy (Lo-Fi Analog FX Popup)"
            style={{
              padding: '2px 7px',
              borderRadius: '4px',
              border: 'none',
              background: simConfig.enabled
                ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.9), rgba(236, 72, 153, 0.9))'
                : 'rgba(255, 255, 255, 0.08)',
              color: simConfig.enabled ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '0.64rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              transition: 'all 0.15s ease',
              boxShadow: simConfig.enabled ? '0 0 10px rgba(236, 72, 153, 0.4)' : 'none',
            }}
          >
            <Sparkles size={10} style={{ color: simConfig.enabled ? '#ffd1f9' : 'currentColor' }} />
            <span>{simConfig.enabled ? `${simConfig.mode === 'vinyl' ? 'VINYL' : 'TAPE'} ${Math.round(simConfig.intensity * 100)}%` : 'LO-FI'}</span>
          </button>
        </div>

        {/* Dynamiczny wskaźnik prędkości Direct Drive z uwzględnieniem DSP */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', minWidth: 0 }}>
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: isPlaying ? (rpm === 45 ? '#ec4899' : '#22c55e') : '#ef4444',
              boxShadow: isPlaying ? `0 0 6px ${rpm === 45 ? '#ec4899' : '#22c55e'}` : 'none',
              transition: 'background 0.3s ease',
              flexShrink: 0,
            }}
          />
          <span
            title={bpm ? `Tempo utworu: ${bpm} BPM (wypadkowo: ${Math.round(bpm * effectiveSpeed)} BPM)` : undefined}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', whiteSpace: 'nowrap' }}
          >
            {isPlaying
              ? `${displayRpm} RPM`
              : (rpm === 33 ? '33⅓ RPM' : '45 RPM')}
          </span>
        </div>
      </div>

      {/* Samodzielny modal Pop-up (jeśli brak nadrzędnego handlera) */}
      {internalLoFiModalOpen && (
        <AnalogLoFiModal
          isOpen={internalLoFiModalOpen}
          onClose={() => setInternalLoFiModalOpen(false)}
          isPlaying={isPlaying}
        />
      )}
    </div>
  );
};
