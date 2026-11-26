import React from 'react';
import type { Translations } from '../../../i18n';
import type { BigScreenViewProps } from '../BigScreenView';
import { cn } from '../../../utils/cn';

export type BigScreenTapeDeckProps = Pick<BigScreenViewProps, 'isPlaying' | 'title' | 'artist' | 'tempoRatio'> & {
  showLyrics: boolean;
  t: Translations;
  progress: number;
};

export const BigScreenTapeDeck: React.FC<BigScreenTapeDeckProps> = ({
  artist,
  isPlaying,
  progress,
  showLyrics,
  t,
  tempoRatio,
  title,
}) => (
    <div
      className="relative flex select-none flex-col justify-between overflow-hidden rounded-2xl border-2 border-white/15 p-3.5"
      style={{
        width: showLyrics ? 'min(360px, 100%)' : 'min(440px, 100%)',
        height: showLyrics ? 'min(230px, 30vh)' : 'min(280px, 34vh)',
        background: 'linear-gradient(145deg, #181926 0%, #0d0e17 100%)',
        boxShadow: isPlaying
          ? '0 0 35px rgba(244, 63, 94, 0.35), 0 20px 45px rgba(0, 0, 0, 0.85)'
          : '0 20px 45px rgba(0, 0, 0, 0.85)',
      }}
    >
      {/* 4 corner screws */}
      {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((corner) => (
        <div
          key={corner}
          className={cn(
            'absolute h-2 w-2 rounded-full border border-slate-600 bg-fg-secondary',
            corner.includes('top') ? 'top-1.5' : 'top-auto',
            corner.includes('bottom') ? 'bottom-1.5' : 'bottom-auto',
            corner.includes('left') ? 'left-1.5' : 'left-auto',
            corner.includes('right') ? 'right-1.5' : 'right-auto',
          )}
          style={{ boxShadow: 'inset 0 0 2px #000' }}
        />
      ))}

      {/* Cassette label (vintage paper label) */}
      <div
        className="flex flex-col gap-0.5 rounded-lg border border-purple-200 bg-linear-135 from-fuchsia-50 to-fuchsia-100 px-3.5 py-2 text-indigo-950 shadow-md shadow-black/30"
      >
        <div className="flex items-center justify-between">
          <span className="text-xxs font-extrabold tracking-label text-accent-pink">
            {t.bigScreenModes.sideA}
          </span>
          <span className="text-2xs font-bold text-purple-800">
            {t.bigScreenModes.stereo}
          </span>
        </div>
        <div className="truncate font-mono text-sm font-extrabold text-gray-900">
          {title || 'Auralune Track'}
        </div>
        <div className="truncate text-xs font-semibold text-gray-600">
          {artist || 'Unknown Artist'}
        </div>
      </div>

      {/* Clear central tape window with the reels */}
      <div
        className="relative mx-0 my-2.5 flex flex-1 items-center justify-around overflow-hidden rounded-xl border border-line bg-black/65"
        style={{ boxShadow: 'inset 0 0 15px rgba(0,0,0,0.9)' }}
      >
        {/* Tape scale: 100 • 50 • 0 */}
        <div className="pointer-events-none absolute top-1 font-mono text-2xs tracking-widest text-white/40">
          100 • 50 • 0
        </div>

        {/* Left reel (feed reel): the tape shrinks from 100% to 0% */}
        <div className="relative flex items-center justify-center">
          <div
            className="absolute rounded-full shadow-halo-sm shadow-black/80 transition-[width,height] duration-200"
            style={{
              width: `${Math.max(32, 70 - (progress / 100) * 36)}px`,
              height: `${Math.max(32, 70 - (progress / 100) * 36)}px`,
              background: 'radial-gradient(circle, #271a15 30%, #451a03 70%, #1e130c 100%)',
            }}
          />
          <div
            className={cn(
              'z-2 flex size-8 items-center justify-center rounded-full border-2 border-slate-300 bg-fg',
              isPlaying && 'motion-safe:animate-spin',
            )}
            style={{
              boxShadow: 'inset 0 0 6px #64748b',
              animationDuration: `${Math.max(0.8, 2.5 / (tempoRatio || 1.0))}s`,
            }}
          >
            {[0, 60, 120].map((deg) => (
              <div
                key={deg}
                className="absolute h-6 w-1 rounded-xs bg-slate-600"
                style={{ transform: `rotate(${deg}deg)` }}
              />
            ))}
            <div className="z-3 h-3 w-3 rounded-full bg-slate-900" />
          </div>
        </div>

        {/* Passing magnetic tape strip */}
        <div
          className="absolute bottom-3 h-1.5 shadow-sm shadow-black/70"
          style={{ width: '65%', background: 'linear-gradient(90deg, #451a03, #78350f, #451a03)' }}
        />

        {/* Right reel (take-up reel): the tape grows from 0% to 100% */}
        <div className="relative flex items-center justify-center">
          <div
            className="absolute rounded-full shadow-halo-sm shadow-black/80 transition-[width,height] duration-200"
            style={{
              width: `${Math.max(32, 34 + (progress / 100) * 36)}px`,
              height: `${Math.max(32, 34 + (progress / 100) * 36)}px`,
              background: 'radial-gradient(circle, #271a15 30%, #451a03 70%, #1e130c 100%)',
            }}
          />
          <div
            className={cn(
              'z-2 flex size-8 items-center justify-center rounded-full border-2 border-slate-300 bg-fg',
              isPlaying && 'motion-safe:animate-spin',
            )}
            style={{
              boxShadow: 'inset 0 0 6px #64748b',
              animationDuration: `${Math.max(0.8, 2.5 / (tempoRatio || 1.0))}s`,
            }}
          >
            {[0, 60, 120].map((deg) => (
              <div
                key={deg}
                className="absolute h-6 w-1 rounded-xs bg-slate-600"
                style={{ transform: `rotate(${deg}deg)` }}
              />
            ))}
            <div className="z-3 h-3 w-3 rounded-full bg-slate-900" />
          </div>
        </div>
      </div>

      {/* Bottom cassette profile with the guide rollers */}
      <div className="flex items-center justify-between px-7.5 py-0">
        <div className="h-3 w-3 rounded-full border border-fg-secondary bg-fg-muted" />
        <div className="h-2.5 w-7 rounded-xs border border-slate-600 bg-slate-700" />
        <div className="h-3 w-3 rounded-full border border-fg-secondary bg-fg-muted" />
      </div>
    </div>
);
