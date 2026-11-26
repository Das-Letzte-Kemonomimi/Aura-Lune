import React, { useState, useEffect, useRef } from 'react';
import { Disc, Sparkles } from 'lucide-react';
import { vinylSimulator, type VinylSimConfig } from '../../utils/vinylSimulator';
import { getTranslations, type Language } from '../../i18n';
import { useInertialSpin } from '../../hooks/useInertialSpin';
import { playbackSpeed } from '../../utils/playbackSpeed';
import { tauFromFrameLerp } from '../../utils/smoothing';
import { cn } from '../../utils/cn';

// Dawna bezwładność talerza: 0.08 (rozpędzanie) / 0.04 (hamowanie) na klatkę 60 Hz => ~0.2 s / ~0.41 s
const PLATTER_TAU_UP = tauFromFrameLerp(0.08);
const PLATTER_TAU_DOWN = tauFromFrameLerp(0.04);

const AnalogLoFiModal = React.lazy(() =>
  import('../modals/AnalogLoFiModal').then((m) => ({ default: m.AnalogLoFiModal }))
);

interface VinylTurntableProps {
  currentLang?: Language;
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

  // Efektywny mnożnik prędkości obrotu płyty zsynchronizowany z DSP (Tempo + Rate).
  // W trybie Direct Bypass dźwięk płynie bit-perfect z prędkością 1.0x, więc płyta obraca się z nominalną prędkością.
  const effectiveSpeed = playbackSpeed({ engine, tempo, rate, isDspActive });

  // Aktualna fizyczna prędkość obrotowa (RPM)
  const currentRpm = (rpm * effectiveSpeed).toFixed(1);

  // Kąt obrotu płyty z płynną bezwładnością silnika (Direct-Drive). Docelowa prędkość w stopniach na sekundę:
  // 33⅓ RPM = ok. 190 deg/s, 45 RPM = ok. 285 deg/s (zauważalnie, 50% szybszy obrót fizyczny).
  const platterRef = useRef<HTMLDivElement | null>(null);
  const baseDegPerSec = rpm === 33 ? 190 : 285;
  const targetDegPerSec = isPlaying ? baseDegPerSec * effectiveSpeed : 0;

  // Pętla działa tylko, dopóki talerz się obraca lub rozpędza; zmiana tempa jej nie restartuje.
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

  // Kąt ramienia gramofonu:
  // Spoczynek (park): 0deg (bezpiecznie wewnątrz plinty gramofonu, pionowo w uchwycie ramienia)
  // Odtwarzanie 33⅓ (standardowy 12" LP): +19 stopni (ramię wychyla się w lewo na rowki płyty)
  // Odtwarzanie 45 RPM (format singla 7"): +24 stopnie (ramię wychyla się głębiej w lewo na wewnętrzne rowki)
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
      {/* Talerz gramofonowy (Platter) z płytą winylową */}
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
        {/* Obracająca się warstwa winylu (Grooves + Dynamic Highlights + Center Label) */}
        <div
          ref={platterRef}
          data-testid="vinyl-platter"
          className="absolute inset-0 flex items-center justify-center rounded-full will-change-transform"
        >
          {/* Rowki płyty winylowej z teksturą mikrorowków */}
          <div
            className="pointer-events-none absolute inset-1.5 rounded-full"
            style={{
              background:
                'repeating-radial-gradient(circle, transparent 0, transparent 2px, rgba(255, 255, 255, 0.035) 3px, transparent 4px)',
            }}
          />

          {/* Optyczny refleks światła na rowkach winylu (krzyż optyczny) */}
          <div
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              background:
                'conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,0.08) 45deg, transparent 90deg, transparent 180deg, rgba(255,255,255,0.08) 225deg, transparent 270deg)',
            }}
          />

          {/* Centralna etykieta płyty (Spindle Label) z okładką albumu */}
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

            {/* Centralny trzpień (Spindle hole) */}
            <div
              className="absolute h-3 w-3 rounded-full"
              style={{ background: '#0a0812', border: '2px solid silver', boxShadow: 'inset 0 0 4px #000' }}
            />
          </div>
        </div>
      </div>

      {/* Ramię gramofonowe (Tonearm) */}
      <div
        className="pointer-events-none absolute top-3 right-4.5 z-10 w-12.5"
        style={{ height: `${size - 40}px` }}
      >
        {/* Podstawa ramienia (Tonearm Base & Gimbal) */}
        <div
          className="absolute top-2.5 right-2.5 h-6.5 w-6.5 rounded-full shadow-md shadow-black/60"
          style={{
            background: 'radial-gradient(circle, #71717a 20%, #27272a 70%, #09090b 100%)',
            border: '2px solid #3f3f46',
          }}
        />

        {/* Uchwyt spoczynkowy ramienia (Tonearm Rest / Arm Cradle) */}
        <div
          title={t.player.tonearmRest}
          className="absolute right-5 h-3.5 w-2 rounded-xs bg-zinc-800 shadow-sm shadow-black/50"
          style={{ top: `${size - 130}px`, border: '1px solid #52525b' }}
        />

        {/* Ruchome ramię z przeciwwagą i główką igły */}
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
          {/* Przeciwwaga (Counterweight na górze) */}
          <div
            className="absolute -top-3 -left-2 h-3.5 w-5 rounded-sm bg-zinc-800"
            style={{ border: '1px solid #52525b' }}
          />

          {/* Główka z wkładką i igłą (Headshell / Cartridge na dole) */}
          <div
            className={cn(
              'absolute -bottom-3.5 -left-1 h-5 w-3 rounded-xs bg-rose-600',
              isPlaying ? 'shadow-halo-sm shadow-rose-600/80' : 'shadow-none',
            )}
            style={{ border: '1px solid #9f1239', transform: 'rotate(15deg)' }}
          />
        </div>
      </div>

      {/* Dolny pasek kontrolny gramofonu: Przełącznik prędkości RPM i Strobe */}
      <div className="absolute bottom-2 left-2.5 right-2.5 z-20 flex items-center justify-between text-xxs font-bold">
        {/* Przełącznik 33 / 45 RPM & Lo-Fi Analog FX */}
        <div className="flex items-center gap-1 rounded-md bg-black/50 p-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setRpm(33);
            }}
            title={t.player.vinylSpeed33}
            className={cn(
              'rounded-sm border-0 px-1.5 py-0.5 text-xxs font-bold transition-all duration-150',
              rpm === 33 ? 'bg-accent-pink text-fg' : 'bg-transparent text-fg-muted',
            )}
          >
            33⅓
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setRpm(45);
            }}
            title={t.player.vinylSpeed45}
            className={cn(
              'rounded-sm border-0 px-1.5 py-0.5 text-xxs font-bold transition-all duration-150',
              rpm === 45 ? 'bg-accent-pink text-fg' : 'bg-transparent text-fg-muted',
            )}
          >
            45
          </button>

          {/* Przycisk Lo-Fi Analog FX — otwiera pełne okno dialogowe Popup */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenLoFi();
            }}
            title={t.player.vinylLoFiTooltip}
            className={cn(
              'flex items-center gap-1 rounded-sm border-0 px-2 py-0.5 text-2xs font-bold transition-all duration-150',
              simConfig.enabled ? 'text-fg shadow-halo-sm shadow-pink-500/40' : 'text-fg-muted shadow-none',
              simConfig.enabled ? 'bg-linear-135 from-accent-purple/90 to-pink-500/90' : 'bg-white/8',
            )}
          >
            <Sparkles size={10} style={{ color: simConfig.enabled ? '#ffd1f9' : 'currentColor' }} />
            <span>{simConfig.enabled ? `${simConfig.mode === 'vinyl' ? 'VINYL' : 'TAPE'} ${Math.round(simConfig.intensity * 100)}%` : 'LO-FI'}</span>
          </button>
        </div>

        {/* Dynamiczny wskaźnik prędkości Direct Drive z uwzględnieniem DSP */}
        <div className="flex min-w-0 items-center gap-1 text-fg-muted">
          <span
            className={cn(
              'h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-300',
              isPlaying ? rpm === 45 ? 'bg-pink-500' : 'bg-green-500' : 'bg-accent-red',
              isPlaying ? rpm === 45 ? 'shadow-halo-sm shadow-pink-500' : 'shadow-halo-sm shadow-green-500' : 'shadow-none',
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

      {/* Samodzielny modal Pop-up (jeśli brak nadrzędnego handlera) */}
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
