import React, { useState, useEffect, useId, useRef } from 'react';
import { CassetteTape, Sparkles } from '../ui/icons';
import { vinylSimulator, type VinylSimConfig } from '../../utils/vinylSimulator';
import { getTranslations, type Language } from '../../i18n';
import { useInertialSpin } from '../../hooks/useInertialSpin';
import { playbackSpeed } from '../../utils/playbackSpeed';
import { tauFromFrameLerp } from '../../utils/smoothing';
import { cn } from '../../utils/cn';

// Former reel inertia: 0.09 (spin-up) / 0.05 (braking) per 60 Hz frame => ~0.18 s / ~0.33 s
const REEL_TAU_UP = tauFromFrameLerp(0.09);
const REEL_TAU_DOWN = tauFromFrameLerp(0.05);

const AnalogLoFiModal = React.lazy(() =>
  import('../modals/AnalogLoFiModal').then((m) => ({ default: m.AnalogLoFiModal }))
);

export type TapeType = 'TYPE_I' | 'TYPE_II' | 'METAL';

interface TapeDeckWidgetProps {
  currentLang?: Language;
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
  onOpenLoFi?: () => void;
  style?: React.CSSProperties;
  className?: string;
  size?: number;
}

export const TapeDeckWidget: React.FC<TapeDeckWidgetProps> = ({
  currentLang,
  isPlaying,
  positionMs = 0,
  durationMs = 180000,
  tempo = 1.0,
  rate = 1.0,
  engine = 'Bypass',
  isDspActive,
  trackTitle,
  artistName,
  tapeType: controlledTapeType,
  onTapeTypeChange,
  tapeSpeed: controlledTapeSpeed,
  onTapeSpeedChange,
  onOpenLoFi,
  style,
  className,
  size = 265,
}) => {
  const t = getTranslations(currentLang);
  const displayTitle = trackTitle || t.stems.modalTrackDefault || 'Track';
  const displayArtist = artistName || 'Auralune Master Tape';
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

  const effectiveSpeed = playbackSpeed({ engine, tempo, rate, isDspActive });

  // Visual variants for the 3 studio tape types
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

  // Playback progress (0.0 to 1.0)
  const progress = durationMs > 0 ? Math.min(1.0, Math.max(0.0, positionMs / durationMs)) : 0.0;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const leftSpoolRef = useRef<SVGGElement | null>(null);
  const rightSpoolRef = useRef<SVGGElement | null>(null);
  const pinchRollerRef = useRef<SVGGElement | null>(null);

  // Tape wind radii (the left one shrinks, the right one grows)
  const leftTapeRadius = 38 - progress * 20; // 38 -> 18
  const rightTapeRadius = 18 + progress * 20; // 18 -> 38

  // 7½ IPS turns twice as fast as the standard 3¾ IPS
  const speedMultiplier = tapeSpeed === '7.5' ? 1.0 : 0.5;
  const baseLinearVelocity = 280 * effectiveSpeed * speedMultiplier;

  // As on a reel-to-reel deck: angular speed ω = v / r. Both reels turn left
  // (the tape runs along the bottom from left to right). The parameters reach the loop through a ref, so changing the radius,
  // tempo or tape speed does not restart it, and the loop sleeps once stopped.
  useInertialSpin({
    targetDegPerSec: isPlaying ? (baseLinearVelocity / leftTapeRadius) * 36 : 0,
    playing: isPlaying,
    tauUp: REEL_TAU_UP,
    tauDown: REEL_TAU_DOWN,
    direction: -1,
    target: rootRef,
    apply: (angle) => {
      leftSpoolRef.current?.setAttribute('transform', `rotate(${angle.toFixed(2)} 65 75)`);
    },
  });
  useInertialSpin({
    targetDegPerSec: isPlaying ? (baseLinearVelocity / rightTapeRadius) * 36 : 0,
    playing: isPlaying,
    tauUp: REEL_TAU_UP,
    tauDown: REEL_TAU_DOWN,
    direction: -1,
    target: rootRef,
    apply: (angle) => {
      rightSpoolRef.current?.setAttribute('transform', `rotate(${angle.toFixed(2)} 175 75)`);
      // Pinch roller driven from the right reel
      pinchRollerRef.current?.setAttribute(
        'transform',
        `rotate(${((angle * (tapeSpeed === '7.5' ? 2.4 : 1.2)) % 360).toFixed(2)} 158 135)`
      );
    },
  });

  // Tape counter (4 digits): ticks 2x faster at 7.5 IPS
  const tapeCounterVal = Math.floor((positionMs / 1000) * (tapeSpeed === '7.5' ? 3.2 : 1.6));
  const counterFormatted = String(tapeCounterVal % 10000).padStart(4, '0');

  const uid = useId().replace(/:/g, '');
  const packGradId = `${uid}-tapePackGrad`;
  const spoolGradId = `${uid}-metalSpool`;

  return (
    <div
      ref={rootRef}
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
        overflow: 'hidden',
        userSelect: 'none',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* Header Decka */}
      <div
        className="flex items-center justify-between border-b border-white/8 pb-1.5 text-xxs font-bold text-slate-300"
      >
        <div className="flex items-center gap-1.5">
          <CassetteTape size={14} style={{ color: currentTheme.accentColor }} />
          <span className="tracking-label text-fg">{t.player.tapeDeckTitle}</span>
          <span className="text-2xs font-extrabold" style={{ color: currentTheme.accentColor }}>
            {currentTheme.name}
          </span>
        </div>

        {/* Mechanical digital counter */}
        <div
          className="rounded-sm px-1.5 py-px font-mono text-xs tracking-widest"
          style={{
            background: '#09070f',
            border: `1px solid ${currentTheme.accentColor}88`,
            color: currentTheme.accentColor,
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8)',
          }}
          title={t.player.tapeCounter}
        >
          {counterFormatted}
        </div>
      </div>

      {/* Reels and head view (SVG) */}
      <div className="relative flex h-36.5 w-full justify-center">
        <svg
          viewBox="0 0 240 155"
          className="h-full w-full overflow-visible"
        >
          <defs>
            {/* Dynamic magnetic tape gradient (FE-I vs CR-II vs METAL) */}
            <radialGradient id={packGradId} cx="50%" cy="50%" r="50%">
              <stop offset="60%" stopColor={currentTheme.tapePackStart} />
              <stop offset="90%" stopColor={currentTheme.tapePackMid} />
              <stop offset="100%" stopColor={currentTheme.tapePackEnd} />
            </radialGradient>

            {/* Dynamic NAB reel gradient (aluminium vs titanium vs gold) */}
            <linearGradient id={spoolGradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={currentTheme.spoolStart} />
              <stop offset="50%" stopColor={currentTheme.spoolMid} />
              <stop offset="100%" stopColor={currentTheme.spoolEnd} />
            </linearGradient>
          </defs>

          {/* Head mechanism base */}
          <rect x="30" y="20" width="180" height="120" rx="8" fill="rgba(10, 8, 18, 0.6)" stroke="rgba(255,255,255,0.06)" />

          {/* Studio tape label badge */}
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
          <text x="120" y="38" textAnchor="middle" fill={currentTheme.badgeText} fontSize="5.2" fontWeight="bold" className="font-mono">
            {displayArtist.length > 14 ? `${displayArtist.slice(0, 12)}...` : displayArtist}
          </text>
          <text x="120" y="48" textAnchor="middle" fontSize="5.8" fontWeight="bold" className="font-mono fill-fg">
            {displayTitle.length > 13 ? `${displayTitle.slice(0, 11)}...` : displayTitle}
          </text>
          <text x="120" y="54" textAnchor="middle" fill={currentTheme.accentColor} fontSize="4.2" fontWeight="bold" className="font-mono">
            {currentTheme.biasLabel}
          </text>

          {/* Tape path joining the reels and heads */}
          <path
            d="M 65 110 L 85 132 L 120 130 L 155 132 L 175 110"
            fill="none"
            stroke={currentTheme.tapePath}
            strokeWidth="3.2"
            strokeLinecap="round"
          />

          {/* --- LEFT REEL (feed reel) --- */}
          <circle cx="65" cy="75" r={leftTapeRadius} fill={`url(#${packGradId})`} stroke={currentTheme.badgeBorder} strokeWidth="0.6" />
          <g ref={leftSpoolRef}>
            <circle cx="65" cy="75" r="42" fill="none" stroke={`url(#${spoolGradId})`} strokeWidth="1.8" />
            <circle cx="65" cy="75" r="14" fill={currentTheme.spoolHub} stroke={currentTheme.spoolMid} strokeWidth="1.5" />
            <circle cx="65" cy="75" r="4" fill="#0f172a" />
            <path d="M 65 61 L 62 42 L 68 42 Z" fill={`url(#${spoolGradId})`} />
            <path d="M 53 82 L 36 92 L 39 97 Z" fill={`url(#${spoolGradId})`} />
            <path d="M 77 82 L 94 92 L 91 97 Z" fill={`url(#${spoolGradId})`} />
          </g>

          {/* --- RIGHT REEL (take-up reel) --- */}
          <circle cx="175" cy="75" r={rightTapeRadius} fill={`url(#${packGradId})`} stroke={currentTheme.badgeBorder} strokeWidth="0.6" />
          <g ref={rightSpoolRef}>
            <circle cx="175" cy="75" r="42" fill="none" stroke={`url(#${spoolGradId})`} strokeWidth="1.8" />
            <circle cx="175" cy="75" r="14" fill={currentTheme.spoolHub} stroke={currentTheme.spoolMid} strokeWidth="1.5" />
            <circle cx="175" cy="75" r="4" fill="#0f172a" />
            <path d="M 175 61 L 172 42 L 178 42 Z" fill={`url(#${spoolGradId})`} />
            <path d="M 163 82 L 146 92 L 149 97 Z" fill={`url(#${spoolGradId})`} />
            <path d="M 187 82 L 204 92 L 201 97 Z" fill={`url(#${spoolGradId})`} />
          </g>

          {/* Guide rollers and the studio head block */}
          <circle cx="85" cy="132" r="6" fill="#475569" stroke="#94a3b8" strokeWidth="1.2" />
          <circle cx="85" cy="132" r="2" fill="#0f172a" />

          {/* Playback head */}
          <rect x="111" y="123" width="18" height="14" rx="2" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1.2" />
          <line x1="120" y1="123" x2="120" y2="137" stroke={currentTheme.accentColor} strokeWidth="1.4" />

          {/* Capstan and rubber pinch roller */}
          <circle cx="147" cy="128" r="3" fill="#cbd5e1" />
          <g ref={pinchRollerRef}>
            <circle cx="158" cy="135" r="7" fill="#18181b" stroke="#52525b" strokeWidth="1.5" />
            <circle cx="158" cy="135" r="2" fill="#a1a1aa" />
          </g>
        </svg>
      </div>

      {/* Bottom control bar and reel-to-reel selectors */}
      <div className="z-20 flex items-center justify-between border-t border-white/8 pt-1.5 text-xxs font-bold">
        {/* Tape speed choice & Lo-Fi */}
        <div className="flex items-center gap-1 rounded-md bg-black/50 p-0.5">
          <button
            type="button"
            onClick={() => setTapeSpeed('7.5')}
            title={t.player.tapeSpeedStudio}
            className={cn(
              'rounded-sm border-0 px-1.5 py-0.5 text-2xs font-bold transition-all duration-150',
              tapeSpeed === '7.5' ? 'bg-accent-purple text-fg' : 'bg-transparent text-fg-muted',
            )}
          >
            7½ IPS
          </button>
          <button
            type="button"
            onClick={() => setTapeSpeed('3.75')}
            title={t.player.tapeSpeedStandard}
            className={cn(
              'rounded-sm border-0 px-1.5 py-0.5 text-2xs font-bold transition-all duration-150',
              tapeSpeed === '3.75' ? 'bg-accent-purple text-fg' : 'bg-transparent text-fg-muted',
            )}
          >
            3¾ IPS
          </button>

          {/* Lo-Fi Tape FX button: opens the full pop-up dialog */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenLoFi();
            }}
            title={t.player.tapeLoFiTooltip}
            className={cn(
              'flex items-center gap-1 rounded-sm border-0 px-1.5 py-0.5 text-2xs font-bold transition-all duration-150',
              simConfig.enabled ? 'text-fg' : 'text-fg-muted',
              simConfig.enabled ? 'bg-linear-135 from-accent-purple/90 to-pink-500/90' : 'bg-white/8',
            )}
          >
            <Sparkles size={10} style={{ color: simConfig.enabled ? '#ffd1f9' : 'currentColor' }} />
            <span>{simConfig.enabled ? `${Math.round(simConfig.intensity * 100)}%` : 'FX'}</span>
          </button>
        </div>

        {/* Tape type selector (FE-I, CR-II, METAL) */}
        <div className="flex gap-0.5 rounded-md bg-black/50 p-0.5">
          <button
            type="button"
            onClick={() => setTapeType('TYPE_I')}
            title={t.player.tapeTypeFerric}
            className={cn(
              'rounded-sm border-0 px-1 py-0.5 text-2xs font-extrabold transition-all duration-150',
              tapeType === 'TYPE_I' ? 'bg-accent-amber text-black' : 'bg-transparent text-fg-muted',
            )}
          >
            FE-I
          </button>
          <button
            type="button"
            onClick={() => setTapeType('TYPE_II')}
            title={t.player.tapeTypeChrome}
            className={cn(
              'rounded-sm border-0 px-1 py-0.5 text-2xs font-extrabold transition-all duration-150',
              tapeType === 'TYPE_II' ? 'bg-accent-cyan text-black' : 'bg-transparent text-fg-muted',
            )}
          >
            CR-II
          </button>
          <button
            type="button"
            onClick={() => setTapeType('METAL')}
            title={t.player.tapeTypeMetal}
            className={cn(
              'rounded-sm border-0 px-1 py-0.5 text-2xs font-extrabold transition-all duration-150',
              tapeType === 'METAL' ? 'bg-yellow-500 text-black' : 'bg-transparent text-fg-muted',
            )}
          >
            METAL
          </button>
        </div>

        {/* Play / Rec state LED */}
        <div className="flex items-center gap-1">
          <span
            className="h-1.5 w-1.5 rounded-full transition-all duration-200"
            style={{
              background: isPlaying ? currentTheme.accentColor : '#64748b',
              boxShadow: isPlaying ? `0 0 6px ${currentTheme.accentColor}` : 'none',
            }}
          />
          <span className="text-2xs font-bold" style={{ color: isPlaying ? currentTheme.accentColor : '#64748b' }}>
            {isPlaying ? (tapeSpeed === '7.5' ? '7.5 IPS' : '3.75 IPS') : 'STOP'}
          </span>
        </div>
      </div>

      {/* Standalone pop-up modal (when there is no parent handler) */}
      {internalLoFiModalOpen && (
        <React.Suspense fallback={null}>
          <AnalogLoFiModal
            isOpen={internalLoFiModalOpen}
            onClose={() => setInternalLoFiModalOpen(false)}
            isPlaying={isPlaying}
            currentLang={currentLang}
          />
        </React.Suspense>
      )}
    </div>
  );
};
