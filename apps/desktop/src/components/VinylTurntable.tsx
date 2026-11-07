import React, { useState } from 'react';
import { Disc } from 'lucide-react';

interface VinylTurntableProps {
  coverUrl?: string | null;
  isPlaying: boolean;
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
  trackTitle = 'Nieznany utwór',
  artistName = 'Auralune Player',
  onTogglePlayPause,
  style,
  className,
  size = 280,
}) => {
  const [rpm, setRpm] = useState<33 | 45>(33);

  // Czas obrotu: 33 1/3 RPM = ok. 1.8 sekundy na obrót, 45 RPM = 1.33 sekundy
  const spinDuration = rpm === 33 ? '1.8s' : '1.33s';

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
        {/* Rowki płyty winylowej z animowanym blaskiem refleksów światła */}
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

        {/* Dynamiczny optyczny refleks winylu wirujący z płytą */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background:
              'conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,0.08) 45deg, transparent 90deg, transparent 180deg, rgba(255,255,255,0.08) 225deg, transparent 270deg)',
            animation: isPlaying ? `spin ${spinDuration} linear infinite` : 'none',
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
            animation: isPlaying ? `spin ${spinDuration} linear infinite` : 'none',
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
              border: '2px solid #silver',
              boxShadow: 'inset 0 0 4px #000',
            }}
          />
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
        {/* Przełącznik 33 / 45 RPM */}
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.4)', padding: '2px', borderRadius: '6px' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setRpm(33);
            }}
            style={{
              padding: '2px 7px',
              borderRadius: '4px',
              border: 'none',
              background: rpm === 33 ? 'var(--accent-pink)' : 'transparent',
              color: rpm === 33 ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '0.68rem',
              fontWeight: 700,
            }}
          >
            33⅓
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setRpm(45);
            }}
            style={{
              padding: '2px 7px',
              borderRadius: '4px',
              border: 'none',
              background: rpm === 45 ? 'var(--accent-pink)' : 'transparent',
              color: rpm === 45 ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '0.68rem',
              fontWeight: 700,
            }}
          >
            45
          </button>
        </div>

        {/* Strobe Light status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-muted)' }}>
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: isPlaying ? '#22c55e' : '#ef4444',
              boxShadow: isPlaying ? '0 0 6px #22c55e' : 'none',
            }}
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.66rem' }}>
            {isPlaying ? 'HI-FI DIRECT DRIVE' : 'STANDBY'}
          </span>
        </div>
      </div>
    </div>
  );
};
