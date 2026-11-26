import React from 'react';
import { Disc } from 'lucide-react';
import type { BigScreenViewProps } from '../BigScreenView';
import { cn } from '../../../utils/cn';

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
      className="relative flex items-center justify-center"
      style={{
        width: showLyrics ? 'min(340px, 36vh)' : 'min(440px, 44vh)',
        height: showLyrics ? 'min(340px, 36vh)' : 'min(440px, 44vh)',
      }}
    >
      {/* Black vinyl record with micro-grooves */}
      <div
        className={cn(
          'relative flex size-full items-center justify-center overflow-hidden rounded-full border-3 border-white/10',
          isPlaying && 'motion-safe:animate-spin',
        )}
        style={{
          background: `repeating-radial-gradient(
            circle at center,
            #111116 0px,
            #111116 2px,
            #08080a 3px,
            #08080a 4px
          )`,
          boxShadow: isPlaying
            ? '0 0 40px rgba(168, 85, 247, 0.45), 0 20px 50px rgba(0, 0, 0, 0.85)'
            : '0 20px 50px rgba(0, 0, 0, 0.85)',
          animationDuration: `${Math.max(1, 3.6 / (tempoRatio || 1.0))}s`,
        }}
      >
        {/* Conical light reflections on the vinyl (vinyl sheen) */}
        <div
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
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
          }}
        />

        {/* Inner run-out groove */}
        <div
          className="pointer-events-none absolute rounded-full border border-white/8"
          style={{ width: '52%', height: '52%', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.8)' }}
        />

        {/* Centre album label with the spindle hole */}
        <div
          className="relative flex items-center justify-center overflow-hidden rounded-full border-2 border-white/25 shadow-halo-md shadow-black/60"
          style={{
            width: '38%',
            height: '38%',
            background: coverUrl
              ? `url("${coverUrl}") center/cover no-repeat`
              : 'radial-gradient(circle, #3b0764 0%, #1e1b4b 70%, #030712 100%)',
          }}
        >
          {!coverUrl && <Disc size={36} className="text-accent-pink" />}
          {/* Spindle hole */}
          <div
            className="absolute h-3.5 w-3.5 rounded-full border-2 border-white/60 bg-black"
            style={{ boxShadow: 'inset 0 0 4px #000' }}
          />
        </div>
      </div>

      {/* Tonearm gliding along the grooves as the track progresses */}
      <div
        className="pointer-events-none absolute -top-4 -right-4 z-10 h-60 w-32.5 transition-transform duration-500"
        style={{
          transformOrigin: '95px 25px',
          transform: isPlaying
            ? `rotate(${16 + (progress / 100) * 22}deg)`
            : 'rotate(0deg)',
          filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.75))',
        }}
      >
        {/* One continuous SVG tonearm (no broken or disconnected look) */}
        <svg
          width="130"
          height="240"
          viewBox="0 0 130 240"
          className="h-full w-full overflow-visible"
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

          {/* Counterweight at the top of the pivot */}
          <rect x="86" y="2" width="18" height="18" rx="3" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
          <rect x="93" y="1" width="4" height="20" rx="1" fill="#cbd5e1" />

          {/* Pivot base & gimbal ring */}
          <circle cx="95" cy="25" r="16" fill="url(#pivotBaseGrad)" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
          <circle cx="95" cy="25" r="6" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1.5" />

          {/* Continuous metal J-shaped arm tube (one path from the pivot to the cartridge) */}
          <path
            d="M 95 25 L 95 160 Q 95 180 82 195 L 75 208"
            fill="none"
            stroke="url(#metalArmTube)"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Cartridge with the stylus and a neon glow */}
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
            {/* Stylus cantilever */}
            <line x1="0" y1="20" x2="0" y2="25" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" />
            <circle cx="0" cy="25" r="1.5" fill="#ffffff" />
          </g>
        </svg>
      </div>
    </div>
);
