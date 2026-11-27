import React, { useState, useEffect, useRef } from 'react';
import { Disc, Sparkles } from '../ui/icons';
import { vinylSimulator, type VinylSimConfig } from '../../utils/vinylSimulator';
import { getTranslations, type Language } from '../../i18n';
import { useInertialSpin } from '../../hooks/useInertialSpin';
import { playbackSpeed } from '../../utils/playbackSpeed';
import { tauFromFrameLerp } from '../../utils/smoothing';
import { cn } from '../../utils/cn';
import { Chip } from '../ui';

// Former platter inertia: 0.08 (spin-up) / 0.04 (braking) per 60 Hz frame => ~0.2 s / ~0.41 s
const PLATTER_TAU_UP = tauFromFrameLerp(0.08);
const PLATTER_TAU_DOWN = tauFromFrameLerp(0.04);

const AnalogLoFiModal = React.lazy(() =>
  import('../modals/AnalogLoFiModal').then((m) => ({ default: m.AnalogLoFiModal }))
);

interface VinylTurntableProps {
  currentLang?: Language;
  coverUrl?: string | null;
  isPlaying: boolean;
  tempo?: number; // DSP tempo multiplier (e.g. 0.35x - 3.00x)
  rate?: number;  // playback rate multiplier (e.g. 1.0x)
  engine?: string; // current DSP engine: 'Bypass' | 'RubberBand' | 'SoundTouch'
  isDspActive?: boolean; // whether DSP is actively processing (not in Direct Bypass)
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
  currentLang,
  coverUrl,
  isPlaying,
  tempo = 1.0,
  rate = 1.0,
  engine = 'Bypass',
  isDspActive,
  bpm,
  trackTitle,
  artistName,
  onTogglePlayPause,
  rpm: controlledRpm,
  onRpmChange,
  onOpenLoFi,
  style,
  className,
  size = 265,
}) => {
  const t = getTranslations(currentLang);
  const displayTitle = trackTitle || t.stems.modalTrackDefault || 'Track';
  const displayArtist = artistName || 'Auralune Player';
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

  // Effective record rotation speed multiplier synced with DSP (tempo + rate).
  // In Direct Bypass mode the sound flows bit-perfect at 1.0x, so the record turns at its nominal speed.
  const effectiveSpeed = playbackSpeed({ engine, tempo, rate, isDspActive });

  // Current physical rotation speed (RPM)
  const currentRpm = (rpm * effectiveSpeed).toFixed(1);

  // Record rotation angle with smooth motor inertia (direct drive). Target speed in degrees per second:
  // 33⅓ RPM = about 190 deg/s, 45 RPM = about 285 deg/s (a noticeably, 50% faster physical rotation).
  const platterRef = useRef<HTMLDivElement | null>(null);
  const baseDegPerSec = rpm === 33 ? 190 : 285;
  const targetDegPerSec = isPlaying ? baseDegPerSec * effectiveSpeed : 0;

  // The loop runs only while the platter turns or spins up; a tempo change does not restart it.
  useInertialSpin({
    targetDegPerSec,
    playing: isPlaying,
    tauUp: PLATTER_TAU_UP,
    tauDown: PLATTER_TAU_DOWN,
    target: platterRef,
    apply: (angle) => {
      if (platterRef.current) platterRef.current.style.transform = `rotate(${angle.toFixed(2)}deg)`;
    },
  });

  // Tonearm angle:
  // Rest (park): 0deg (safely inside the turntable plinth, upright in the arm rest)
  // Playing 33⅓ (standard 12" LP): +19 degrees (the arm swings left onto the record grooves)
  // Playing 45 RPM (7" single format): +24 degrees (the arm swings further left onto the inner grooves)
  const tonearmAngle = isPlaying ? (rpm === 45 ? '24deg' : '19deg') : '0deg';

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
      {/* Turntable platter with the vinyl record */}
      <div
        onClick={onTogglePlayPause}
        title={`${isPlaying ? t.player.pause : t.player.play} • ${displayArtist} - ${displayTitle}`}
        className="relative flex cursor-pointer items-center justify-center rounded-full"
        style={{
          width: `${size - 56}px`,
          height: `${size - 56}px`,
          background: 'radial-gradient(circle, #080a10 25%, #151922 45%, #05070a 75%, #020306 100%)',
          border: '4px solid #232a3b',
          boxShadow: '0 0 16px rgba(0,0,0,0.9), inset 0 0 12px rgba(0,0,0,0.95)',
        }}
      >
        {/* Rotating vinyl layer (grooves + dynamic highlights + centre label) */}
        <div
          ref={platterRef}
          data-testid="vinyl-platter"
          className="absolute inset-0 flex items-center justify-center rounded-full will-change-transform"
        >
          {/* Vinyl record grooves with a micro-groove texture */}
          <div
            className="pointer-events-none absolute inset-1.5 rounded-full"
            style={{
              background:
                'repeating-radial-gradient(circle, transparent 0, transparent 2px, rgba(255, 255, 255, 0.035) 3px, transparent 4px)',
            }}
          />

          {/* Optical light reflection on the vinyl grooves (optical cross) */}
          <div
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              background:
                'conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,0.08) 45deg, transparent 90deg, transparent 180deg, rgba(255,255,255,0.08) 225deg, transparent 270deg)',
            }}
          />

          {/* Centre record label (spindle label) with the album cover */}
          <div
            className={cn(
              'relative flex items-center justify-center overflow-hidden rounded-full shadow-halo-sm shadow-black/80',
              !coverUrl && 'bg-accent-gradient',
            )}
            style={{
              width: `${Math.round((size - 56) * 0.44)}px`,
              height: `${Math.round((size - 56) * 0.44)}px`,
              border: '3px solid #1a1727',
              background: coverUrl ? `url("${coverUrl}") center/cover no-repeat` : undefined,
            }}
          >
            {!coverUrl && <Disc size={28} className="text-fg" />}

            {/* Centre spindle hole */}
            <div
              className="absolute h-3 w-3 rounded-full"
              style={{ background: '#0a0812', border: '2px solid silver', boxShadow: 'inset 0 0 4px #000' }}
            />
          </div>
        </div>
      </div>

      {/* Tonearm */}
      <div
        className="pointer-events-none absolute top-3 right-4.5 z-10 w-12.5"
        style={{ height: `${size - 40}px` }}
      >
        {/* Tonearm base & gimbal */}
        <div
          className="absolute top-2.5 right-2.5 h-6.5 w-6.5 rounded-full shadow-md shadow-black/60"
          style={{
            background: 'radial-gradient(circle, #71717a 20%, #27272a 70%, #09090b 100%)',
            border: '2px solid #3f3f46',
          }}
        />

        {/* Tonearm rest (arm cradle) */}
        <div
          title={t.player.tonearmRest}
          className="absolute right-5 h-3.5 w-2 rounded-xs bg-zinc-800 shadow-sm shadow-black/50"
          style={{ top: `${size - 130}px`, border: '1px solid #52525b' }}
        />

        {/* Moving arm with the counterweight and the headshell */}
        <div
          className="absolute top-6 right-6 w-1 rounded-xs transition-transform duration-700"
          style={{
            height: `${size - 110}px`,
            transformOrigin: 'top center',
            transform: `rotate(${tonearmAngle})`,
            background: 'linear-gradient(to right, #e4e4e7, #a1a1aa, #71717a)',
            boxShadow: '2px 4px 8px rgba(0,0,0,0.5)',
          }}
        >
          {/* Counterweight (at the top) */}
          <div
            className="absolute -top-3 -left-2 h-3.5 w-5 rounded-sm bg-zinc-800"
            style={{ border: '1px solid #52525b' }}
          />

          {/* Headshell with the cartridge and stylus (at the bottom) */}
          <div
            className={cn(
              'absolute -bottom-3.5 -left-1 h-5 w-3 rounded-xs bg-rose-600',
              isPlaying ? 'shadow-halo-sm shadow-rose-600/80' : 'shadow-none',
            )}
            style={{ border: '1px solid #9f1239', transform: 'rotate(15deg)' }}
          />
        </div>
      </div>

      {/* Bottom turntable control bar: RPM switch and strobe */}
      <div className="absolute bottom-2 left-2.5 right-2.5 z-20 flex items-center justify-between text-xxs font-bold">
        {/* 33 / 45 RPM switch & Lo-Fi Analog FX */}
        <div className="flex items-center gap-1 rounded-md bg-black/50 p-0.5">
          <Chip
            size="xs"
            pressed={rpm === 33}
            onClick={(e) => {
              e.stopPropagation();
              setRpm(33);
            }}
            title={t.player.vinylSpeed33}
            className="px-1.5"
          >
            33⅓
          </Chip>
          <Chip
            size="xs"
            pressed={rpm === 45}
            onClick={(e) => {
              e.stopPropagation();
              setRpm(45);
            }}
            title={t.player.vinylSpeed45}
            className="px-1.5"
          >
            45
          </Chip>

          {/* Lo-Fi Analog FX button: opens the full pop-up dialog */}
          <Chip
            size="xs"
            tone="purple"
            pressed={simConfig.enabled}
            onClick={(e) => {
              e.stopPropagation();
              handleOpenLoFi();
            }}
            title={t.player.vinylLoFiTooltip}
            className="gap-1 text-2xs"
          >
            <Sparkles size={10} />
            <span>{simConfig.enabled ? `${simConfig.mode === 'vinyl' ? 'VINYL' : 'TAPE'} ${Math.round(simConfig.intensity * 100)}%` : 'LO-FI'}</span>
          </Chip>
        </div>

        {/* Dynamic direct-drive speed indicator, DSP included */}
        <div className="flex min-w-0 items-center gap-1 text-fg-muted">
          <span
            className={cn(
              'h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-300',
              isPlaying ? rpm === 45 ? 'bg-accent-pink' : 'bg-accent-green' : 'bg-accent-red',
              isPlaying ? rpm === 45 ? 'shadow-halo-sm shadow-accent-pink' : 'shadow-halo-sm shadow-accent-green' : 'shadow-none',
            )}
          />
          <span
            title={bpm ? `${t.dsp?.tempo || 'Tempo'}: ${bpm} BPM (${Math.round(bpm * effectiveSpeed)} BPM)` : undefined}
            className="font-mono text-2xs whitespace-nowrap"
          >
            {isPlaying
              ? `${currentRpm} RPM`
              : (rpm === 33 ? '33⅓ RPM' : '45 RPM')}
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
