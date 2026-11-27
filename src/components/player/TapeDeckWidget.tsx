import React, { useState, useEffect, useId, useRef } from 'react';
import { CassetteTape, Sparkles } from '../ui/icons';
import { vinylSimulator, type VinylSimConfig } from '../../utils/vinylSimulator';
import { getTranslations, type Language } from '../../i18n';
import { useFrameLoop } from '../../hooks/useFrameLoop';
import { stepSpin, type SpinState } from '../../utils/inertialSpin';
import { playbackSpeed } from '../../utils/playbackSpeed';
import { tauFromFrameLerp } from '../../utils/smoothing';
import { Chip } from '../ui';

// Former reel inertia: 0.09 (spin-up) / 0.05 (braking) per 60 Hz frame => ~0.18 s / ~0.33 s
const REEL_TAU_UP = tauFromFrameLerp(0.09);
const REEL_TAU_DOWN = tauFromFrameLerp(0.05);
/** Reel animation cap: the spokes are 3-fold symmetric, so 30 fps reads as smooth and halves the work. */
const REEL_MAX_FPS = 30;

/** Rotation centre of an element inside the 240×155 SVG viewBox, as a CSS `transform-origin`. */
const viewBoxOrigin = (x: number, y: number) => `${(x / 240) * 100}% ${(y / 155) * 100}%`;

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
  // Reels and the pinch roller sit in HTML wrappers rotated with a CSS transform (compositor-only),
  // instead of rewriting an SVG `transform` attribute (a full SVG repaint) on every frame.
  const leftSpoolRef = useRef<HTMLDivElement | null>(null);
  const rightSpoolRef = useRef<HTMLDivElement | null>(null);
  const pinchRollerRef = useRef<HTMLDivElement | null>(null);

  // Tape wind radii (the left one shrinks, the right one grows)
  const leftTapeRadius = 38 - progress * 20; // 38 -> 18
  const rightTapeRadius = 18 + progress * 20; // 18 -> 38

  // 7½ IPS turns twice as fast as the standard 3¾ IPS
  const speedMultiplier = tapeSpeed === '7.5' ? 1.0 : 0.5;
  const baseLinearVelocity = 280 * effectiveSpeed * speedMultiplier;

  // As on a reel-to-reel deck: angular speed ω = v / r. Both reels turn left
  // (the tape runs along the bottom from left to right). The parameters reach the loop through a ref, so changing the radius,
  // tempo or tape speed does not restart it, and the loop sleeps once stopped. One loop drives both reels.
  const leftTargetDegPerSec = isPlaying ? (baseLinearVelocity / leftTapeRadius) * 36 : 0;
  const rightTargetDegPerSec = isPlaying ? (baseLinearVelocity / rightTapeRadius) * 36 : 0;
  const pinchRatio = tapeSpeed === '7.5' ? 2.4 : 1.2;
  const spinParamsRef = useRef({ leftTargetDegPerSec, rightTargetDegPerSec, isPlaying, pinchRatio });
  useEffect(() => {
    spinParamsRef.current = { leftTargetDegPerSec, rightTargetDegPerSec, isPlaying, pinchRatio };
  });
  const reelsRef = useRef<{ left: SpinState; right: SpinState }>({
    left: { angle: 0, speed: 0 },
    right: { angle: 0, speed: 0 },
  });

  const { wake: wakeReels } = useFrameLoop(
    ({ dt }) => {
      const p = spinParamsRef.current;
      const reels = reelsRef.current;
      const left = stepSpin(reels.left, p.leftTargetDegPerSec, p.isPlaying, dt, REEL_TAU_UP, REEL_TAU_DOWN, -1);
      const right = stepSpin(reels.right, p.rightTargetDegPerSec, p.isPlaying, dt, REEL_TAU_UP, REEL_TAU_DOWN, -1);
      reels.left = left;
      reels.right = right;
      if (left.speed > 0.01 && leftSpoolRef.current) {
        leftSpoolRef.current.style.transform = `rotate(${left.angle.toFixed(2)}deg)`;
      }
      if (right.speed > 0.01) {
        if (rightSpoolRef.current) rightSpoolRef.current.style.transform = `rotate(${right.angle.toFixed(2)}deg)`;
        // Pinch roller driven from the right reel
        if (pinchRollerRef.current) {
          pinchRollerRef.current.style.transform = `rotate(${((right.angle * p.pinchRatio) % 360).toFixed(2)}deg)`;
        }
      }
      return !(left.settled && right.settled);
    },
    { maxFps: REEL_MAX_FPS, target: rootRef },
  );

  useEffect(() => {
    wakeReels();
  }, [leftTargetDegPerSec, rightTargetDegPerSec, isPlaying, wakeReels]);

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
        className="flex items-center justify-between border-b border-line pb-1.5 text-xxs font-bold text-fg-secondary"
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

      {/* Reels and head view (SVG). The wrapper has the viewBox aspect ratio, so the rotating overlays
          (each a full-size SVG with the same viewBox) line up exactly with the static layer. */}
      <div className="relative flex h-36.5 w-full justify-center">
        <div className="relative aspect-[240/155] h-full max-w-full">
          <svg
            viewBox="0 0 240 155"
            className="absolute inset-0 h-full w-full overflow-visible"
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

            {/* --- LEFT REEL (feed reel); the spool rotates in an overlay below --- */}
            <circle cx="65" cy="75" r={leftTapeRadius} fill={`url(#${packGradId})`} stroke={currentTheme.badgeBorder} strokeWidth="0.6" />

            {/* --- RIGHT REEL (take-up reel) --- */}
            <circle cx="175" cy="75" r={rightTapeRadius} fill={`url(#${packGradId})`} stroke={currentTheme.badgeBorder} strokeWidth="0.6" />

            {/* Guide rollers and the studio head block */}
            <circle cx="85" cy="132" r="6" fill="#475569" stroke="#94a3b8" strokeWidth="1.2" />
            <circle cx="85" cy="132" r="2" fill="#0f172a" />

            {/* Playback head */}
            <rect x="111" y="123" width="18" height="14" rx="2" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1.2" />
            <line x1="120" y1="123" x2="120" y2="137" stroke={currentTheme.accentColor} strokeWidth="1.4" />

            {/* Capstan */}
            <circle cx="147" cy="128" r="3" fill="#cbd5e1" />
          </svg>

          {/* Rotating parts: compositor-only CSS rotation around their centre in viewBox space.
              None of them overlaps a static part drawn after it, so stacking them on top keeps the picture. */}
          <div ref={leftSpoolRef} className="pointer-events-none absolute inset-0 will-change-transform" style={{ transformOrigin: viewBoxOrigin(65, 75) }}>
            <svg viewBox="0 0 240 155" className="h-full w-full overflow-visible">
              <circle cx="65" cy="75" r="42" fill="none" stroke={`url(#${spoolGradId})`} strokeWidth="1.8" />
              <circle cx="65" cy="75" r="14" fill={currentTheme.spoolHub} stroke={currentTheme.spoolMid} strokeWidth="1.5" />
              <circle cx="65" cy="75" r="4" fill="#0f172a" />
              <path d="M 65 61 L 62 42 L 68 42 Z" fill={`url(#${spoolGradId})`} />
              <path d="M 53 82 L 36 92 L 39 97 Z" fill={`url(#${spoolGradId})`} />
              <path d="M 77 82 L 94 92 L 91 97 Z" fill={`url(#${spoolGradId})`} />
            </svg>
          </div>
          <div ref={rightSpoolRef} className="pointer-events-none absolute inset-0 will-change-transform" style={{ transformOrigin: viewBoxOrigin(175, 75) }}>
            <svg viewBox="0 0 240 155" className="h-full w-full overflow-visible">
              <circle cx="175" cy="75" r="42" fill="none" stroke={`url(#${spoolGradId})`} strokeWidth="1.8" />
              <circle cx="175" cy="75" r="14" fill={currentTheme.spoolHub} stroke={currentTheme.spoolMid} strokeWidth="1.5" />
              <circle cx="175" cy="75" r="4" fill="#0f172a" />
              <path d="M 175 61 L 172 42 L 178 42 Z" fill={`url(#${spoolGradId})`} />
              <path d="M 163 82 L 146 92 L 149 97 Z" fill={`url(#${spoolGradId})`} />
              <path d="M 187 82 L 204 92 L 201 97 Z" fill={`url(#${spoolGradId})`} />
            </svg>
          </div>
          <div ref={pinchRollerRef} className="pointer-events-none absolute inset-0 will-change-transform" style={{ transformOrigin: viewBoxOrigin(158, 135) }}>
            <svg viewBox="0 0 240 155" className="h-full w-full overflow-visible">
              <circle cx="158" cy="135" r="7" fill="#18181b" stroke="#52525b" strokeWidth="1.5" />
              <circle cx="158" cy="135" r="2" fill="#a1a1aa" />
            </svg>
          </div>
        </div>
      </div>

      {/* Bottom control bar and reel-to-reel selectors */}
      <div className="z-20 flex items-center justify-between border-t border-line pt-1.5 text-xxs font-bold">
        {/* Tape speed choice & Lo-Fi */}
        <div className="flex items-center gap-1 rounded-md bg-black/50 p-0.5">
          <Chip size="xs" tone="purple" pressed={tapeSpeed === '7.5'} onClick={() => setTapeSpeed('7.5')} title={t.player.tapeSpeedStudio} className="px-1.5 text-2xs">
            7½ IPS
          </Chip>
          <Chip size="xs" tone="purple" pressed={tapeSpeed === '3.75'} onClick={() => setTapeSpeed('3.75')} title={t.player.tapeSpeedStandard} className="px-1.5 text-2xs">
            3¾ IPS
          </Chip>

          {/* Lo-Fi Tape FX button: opens the full pop-up dialog */}
          <Chip
            size="xs"
            pressed={simConfig.enabled}
            onClick={(e) => {
              e.stopPropagation();
              handleOpenLoFi();
            }}
            title={t.player.tapeLoFiTooltip}
            className="gap-1 px-1.5 text-2xs"
          >
            <Sparkles size={10} />
            {simConfig.enabled ? `${Math.round(simConfig.intensity * 100)}%` : 'FX'}
          </Chip>
        </div>

        {/* Tape type selector (FE-I, CR-II, METAL) */}
        <div className="flex gap-0.5 rounded-md bg-black/50 p-0.5">
          <Chip size="xs" tone="amber" pressed={tapeType === 'TYPE_I'} onClick={() => setTapeType('TYPE_I')} title={t.player.tapeTypeFerric} className="px-1.5 text-2xs">
            FE-I
          </Chip>
          <Chip size="xs" tone="cyan" pressed={tapeType === 'TYPE_II'} onClick={() => setTapeType('TYPE_II')} title={t.player.tapeTypeChrome} className="px-1.5 text-2xs">
            CR-II
          </Chip>
          <Chip size="xs" tone="pink" pressed={tapeType === 'METAL'} onClick={() => setTapeType('METAL')} title={t.player.tapeTypeMetal} className="px-1.5 text-2xs">
            METAL
          </Chip>
        </div>

        {/* Play / Rec state LED */}
        <div className="flex items-center gap-1">
          <span
            className="size-1.5 rounded-full"
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
