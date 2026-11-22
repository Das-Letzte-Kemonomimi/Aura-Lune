import React from 'react';
import { Disc } from 'lucide-react';
import type { BigScreenViewProps } from '../BigScreenView';

export type BigScreenVinylProps = Pick<BigScreenViewProps, 'isPlaying' | 'tempoRatio' | 'coverUrl'> & {
  showLyrics: boolean;
  progress: number;
};

export const BigScreenVinyl: React.FC<BigScreenVinylProps> = ({
  coverUrl,
  isPlaying,
  progress,
  showLyrics,
  tempoRatio,
}) => (
    <div
      style={{
        position: 'relative',
        width: showLyrics ? '340px' : '440px',
        height: showLyrics ? '340px' : '440px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Czarna płyta winylowa z mikro-rowkami */}
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          background: `repeating-radial-gradient(
            circle at center,
            #111116 0px,
            #111116 2px,
            #08080a 3px,
            #08080a 4px
          )`,
          border: '3px solid rgba(255, 255, 255, 0.12)',
          boxShadow: isPlaying
            ? '0 0 40px rgba(168, 85, 247, 0.45), 0 20px 50px rgba(0, 0, 0, 0.85)'
            : '0 20px 50px rgba(0, 0, 0, 0.85)',
          position: 'relative',
          overflow: 'hidden',
          animation: isPlaying
            ? `spin ${Math.max(1, 3.6 / (tempoRatio || 1.0))}s linear infinite`
            : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Stożkowe odbłyski światła na winylu (Vinyl sheen reflections) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: `conic-gradient(
              from 45deg,
              transparent 0deg,
              rgba(255, 255, 255, 0.08) 35deg,
              transparent 70deg,
              transparent 180deg,
              rgba(255, 255, 255, 0.08) 215deg,
              transparent 250deg,
              transparent 360deg
            )`,
            pointerEvents: 'none',
          }}
        />

        {/* Wewnętrzny rowek wybiegowy (Run-out groove) */}
        <div
          style={{
            position: 'absolute',
            width: '52%',
            height: '52%',
            borderRadius: '50%',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: 'inset 0 0 10px rgba(0,0,0,0.8)',
            pointerEvents: 'none',
          }}
        />

        {/* Centralna naklejka albumu z otworem wrzeciona */}
        <div
          style={{
            width: '38%',
            height: '38%',
            borderRadius: '50%',
            position: 'relative',
            overflow: 'hidden',
            border: '2px solid rgba(255, 255, 255, 0.25)',
            background: coverUrl
              ? `url("${coverUrl}") center/cover no-repeat`
              : 'radial-gradient(circle, #3b0764 0%, #1e1b4b 70%, #030712 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(0,0,0,0.6)',
          }}
        >
          {!coverUrl && <Disc size={36} color="var(--accent-pink)" />}
          {/* Otwór na wrzeciono gramofonu */}
          <div
            style={{
              position: 'absolute',
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              background: '#000',
              border: '2px solid rgba(255, 255, 255, 0.6)',
              boxShadow: 'inset 0 0 4px #000',
            }}
          />
        </div>
      </div>

      {/* Ramię gramofonowe (Tonearm) płynnie sunące po rowkach wraz z postępem utworu */}
      <div
        style={{
          position: 'absolute',
          top: '-15px',
          right: '-15px',
          width: '130px',
          height: '240px',
          pointerEvents: 'none',
          transformOrigin: '95px 25px',
          transform: isPlaying
            ? `rotate(${16 + (progress / 100) * 22}deg)`
            : 'rotate(0deg)',
          transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 10,
          filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.75))',
        }}
      >
        {/* Jednolita, ciągła konstrukcja ramienia gramofonowego SVG (eliminacja efektu złamania/rozłączenia) */}
        <svg
          width="130"
          height="240"
          viewBox="0 0 130 240"
          style={{ width: '100%', height: '100%', overflow: 'visible' }}
        >
          <defs>
            <linearGradient id="metalArmTube" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#e2e8f0" />
              <stop offset="50%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#64748b" />
            </linearGradient>
            <radialGradient id="pivotBaseGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#cbd5e1" />
              <stop offset="60%" stopColor="#475569" />
              <stop offset="100%" stopColor="#0f172a" />
            </radialGradient>
            <linearGradient id="cartridgeGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
          </defs>

          {/* Przeciwwaga (Counterweight) na górze osi */}
          <rect x="86" y="2" width="18" height="18" rx="3" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
          <rect x="93" y="1" width="4" height="20" rx="1" fill="#cbd5e1" />

          {/* Podstawa osi obrotu (Pivot Base & Gimbal Ring) */}
          <circle cx="95" cy="25" r="16" fill="url(#pivotBaseGrad)" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
          <circle cx="95" cy="25" r="6" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1.5" />

          {/* Ciągła, metalowa rurka ramienia J-shape (spójna ścieżka od osi aż po wkładkę) */}
          <path
            d="M 95 25 L 95 160 Q 95 180 82 195 L 75 208"
            fill="none"
            stroke="url(#metalArmTube)"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Wkładka gramofonowa (Cartridge) z igłą i neonowym podświetleniem */}
          <g transform="translate(75, 208) rotate(22)">
            <rect
              x="-8"
              y="0"
              width="16"
              height="22"
              rx="3"
              fill="url(#cartridgeGrad)"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="1"
            />
            {/* Igła / Stylus cantilever */}
            <line x1="0" y1="20" x2="0" y2="25" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" />
            <circle cx="0" cy="25" r="1.5" fill="#ffffff" />
          </g>
        </svg>
      </div>
    </div>
);
