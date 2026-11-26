import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Activity,
  ArrowRight,
  RotateCcw,
  Plus,
  Minus,
  Check,
  Wand2,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { invoke } from '../../api/ipc';
import type { Language } from '../../i18n';
import { getTranslations } from '../../i18n';
import { cn } from '../../utils/cn';
import { ModalShell } from '../ui';

interface KeyBpmModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrackTitle?: string;
  currentTrackId?: number;
  currentTrackPath?: string;
  pitchSemitones: number;
  tempoRatio: number;
  rateRatio: number;
  onPitchChange: (semitones: number) => void;
  onTempoChange: (tempo: number) => void;
  onTrackKeyBpmUpdated?: (trackId: number, bpm: number, keyName: string) => void;
  currentLang: Language;
}

const CHROMATIC_SCALE = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];

// Mapowanie tonacji na notację Camelot (dla DJ-ów / remikserów)
const CAMELOT_MAJOR: Record<string, string> = {
  'B': '1B', 'F#': '2B', 'C#': '3B', 'G#': '4B',
  'D#': '5B', 'A#': '6B', 'F': '7B', 'C': '8B',
  'G': '9B', 'D': '10B', 'A': '11B', 'E': '12B',
};

const CAMELOT_MINOR: Record<string, string> = {
  'G#': '1A', 'D#': '2A', 'A#': '3A', 'F': '4A',
  'C': '5A', 'G': '6A', 'D': '7A', 'A': '8A',
  'E': '9A', 'B': '10A', 'F#': '11A', 'C#': '12A',
};

export const KeyBpmModal: React.FC<KeyBpmModalProps> = ({
  isOpen,
  onClose,
  currentTrackTitle,
  currentTrackId,
  currentTrackPath,
  pitchSemitones,
  tempoRatio,
  rateRatio,
  onPitchChange,
  onTempoChange,
  onTrackKeyBpmUpdated,
  currentLang,
}) => {
  const loc = getTranslations(currentLang);

  // Domyślna bazowa tonacja i BPM
  const [baseKeyIndex, setBaseKeyIndex] = useState<number>(0); // 0 = C
  const [isMinor, setIsMinor] = useState<boolean>(false);
  const [baseBpm, setBaseBpm] = useState<number>(128.0);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [detectionSource, setDetectionSource] = useState<'tag' | 'acoustic' | 'database' | 'manual' | null>(null);
  const [detectError, setDetectError] = useState<string | null>(null);

  // Tap Tempo state
  const tapTimesRef = useRef<number[]>([]);
  const [tapActive, setTapActive] = useState<boolean>(false);

  // Funkcja automatycznej detekcji tonacji i BPM w tle
  const handleAutoDetect = useCallback(async (path?: string, trackId?: number, forceRecompute: boolean = false) => {
    const targetPath = path || currentTrackPath;
    if (!targetPath) return;

    setIsDetecting(true);
    setDetectError(null);

    try {
      const res = await invoke<{
        bpm: number;
        key_name: string;
        camelot: string;
        base_key_index: number;
        is_minor: boolean;
        source: string;
      }>('detect_track_key_bpm', {
        path: targetPath,
        trackId: trackId ?? currentTrackId ?? null,
        forceRecompute,
      });

      if (res) {
        setBaseKeyIndex(res.base_key_index);
        setIsMinor(res.is_minor);
        setBaseBpm(res.bpm);
        setDetectionSource(res.source as any);

        const targetId = trackId ?? currentTrackId;
        if (targetId) {
          onTrackKeyBpmUpdated?.(targetId, res.bpm, res.camelot || res.key_name);
        }

        const cacheKey = currentTrackId
          ? `auralune_track_key_bpm_${currentTrackId}`
          : `auralune_track_key_bpm_${targetPath}`;
        try {
          localStorage.setItem(
            cacheKey,
            JSON.stringify({
              baseKeyIndex: res.base_key_index,
              isMinor: res.is_minor,
              baseBpm: res.bpm,
              source: res.source,
            })
          );
        } catch {}
      }
    } catch (e: unknown) {
      console.warn('Błąd detekcji Key/BPM:', e);
      setDetectError(String(e));
    } finally {
      setIsDetecting(false);
    }
  }, [currentTrackPath, currentTrackId, onTrackKeyBpmUpdated]);

  // Wczytaj zapamiętane metadane dla utworu lub automatycznie wykryj jeśli brak
  useEffect(() => {
    if (!isOpen) return;

    let hasStored = false;
    const cacheKey = currentTrackId
      ? `auralune_track_key_bpm_${currentTrackId}`
      : currentTrackPath
      ? `auralune_track_key_bpm_${currentTrackPath}`
      : null;

    if (cacheKey) {
      try {
        const stored = localStorage.getItem(cacheKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (typeof parsed.baseKeyIndex === 'number') {
            setBaseKeyIndex(parsed.baseKeyIndex);
            hasStored = true;
          }
          if (typeof parsed.isMinor === 'boolean') setIsMinor(parsed.isMinor);
          if (typeof parsed.baseBpm === 'number') setBaseBpm(parsed.baseBpm);
          if (parsed.source) setDetectionSource(parsed.source);
        }
      } catch {
        // Ignoruj błędy parsowania
      }
    }

    // Jeśli nie znaleziono w pamięci podręcznej, a mamy ścieżkę pliku — automatycznie wykryj!
    if (!hasStored && currentTrackPath) {
      handleAutoDetect(currentTrackPath, currentTrackId);
    }
  }, [isOpen, currentTrackId, currentTrackPath, handleAutoDetect]);

  if (!isOpen) return null;

  const handleSaveForTrack = async () => {
    const cacheKey = currentTrackId
      ? `auralune_track_key_bpm_${currentTrackId}`
      : currentTrackPath
      ? `auralune_track_key_bpm_${currentTrackPath}`
      : null;

    if (cacheKey) {
      try {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({ baseKeyIndex, isMinor, baseBpm, source: 'manual' })
        );
      } catch {}
    }

    if (currentTrackId) {
      try {
        const keyName = `${CHROMATIC_SCALE[baseKeyIndex]} ${isMinor ? 'm' : 'Maj'}`;
        onTrackKeyBpmUpdated?.(currentTrackId, baseBpm, keyName);
        await invoke('save_track_key_bpm', {
          trackId: currentTrackId,
          bpm: baseBpm,
          keyName,
        });
      } catch (err) {
        console.warn('Błąd zapisu Key/BPM do bazy:', err);
      }
    }
  };

  // Obliczenie tonacji po transpozycji
  const roundedSemitones = Math.round(pitchSemitones);
  const transposedIndex = ((baseKeyIndex + roundedSemitones) % 12 + 12) % 12;
  const originalKeyName = `${CHROMATIC_SCALE[baseKeyIndex]} ${isMinor ? 'm' : 'Maj'}`;
  const transposedKeyName = `${CHROMATIC_SCALE[transposedIndex]} ${isMinor ? 'm' : 'Maj'}`;

  const originalCamelot = isMinor
    ? CAMELOT_MINOR[CHROMATIC_SCALE[baseKeyIndex]] || '-'
    : CAMELOT_MAJOR[CHROMATIC_SCALE[baseKeyIndex]] || '-';

  const transposedCamelot = isMinor
    ? CAMELOT_MINOR[CHROMATIC_SCALE[transposedIndex]] || '-'
    : CAMELOT_MAJOR[CHROMATIC_SCALE[transposedIndex]] || '-';

  // Efektywny BPM po uwzględnieniu tempo stretch i prędkości odtwarzania
  const effectiveBpm = baseBpm * (tempoRatio || 1.0) * (rateRatio || 1.0);
  const bpmDeltaPercent = Math.round(((effectiveBpm / baseBpm) - 1.0) * 100);

  const handleTap = () => {
    const now = performance.now();
    setTapActive(true);
    setTimeout(() => setTapActive(false), 150);

    const taps = tapTimesRef.current.filter((t) => now - t < 3000);
    taps.push(now);
    tapTimesRef.current = taps;

    if (taps.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < taps.length; i++) {
        intervals.push(taps[i] - taps[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const calculatedBpm = Math.round((60000 / avgInterval) * 10) / 10;
      if (calculatedBpm >= 40 && calculatedBpm <= 280) {
        setBaseBpm(calculatedBpm);
        setDetectionSource('manual');
      }
    }
  };

  return (
    <ModalShell
      onClose={onClose}
      layer="top"
      className="flex max-w-170 flex-col gap-5 rounded-3xl border border-white/10 p-7 text-fg"
    >
      {/* Nagłówek okna */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-accent-pink/40 bg-linear-135 from-accent-pink/25 to-accent-cyan/25"
          >
            <Activity size={22} className="text-accent-pink" />
          </div>
          <div>
            <h2 className="m-0 text-xl font-extrabold tracking-tight">
              {loc.keyBpm.title}
            </h2>
            <p className="mx-0 mt-0.5 mb-0 text-ui text-fg-muted">
              {currentTrackTitle || loc.keyBpm.currentTrack}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex rounded-xl border border-line bg-white/6 p-2 text-fg-muted"
        >
          <X size={18} />
        </button>
      </div>

      {/* Pasek statusu automatycznej detekcji */}
      <div
        className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/3 px-3.5 py-2.5"
      >
        <div className="flex items-center gap-2 text-ui">
          {isDetecting ? (
            <>
              <Loader2 size={16} className="animate-spin text-accent-cyan" />
              <span className="font-semibold text-accent-cyan">
                {loc.keyBpm.analyzing}
              </span>
            </>
          ) : (
            <>
              <Sparkles size={16} className="text-accent-pink" />
              <span className="text-fg-secondary">
                {loc.keyBpm.detectionSource}
              </span>
              <span
                className={cn(
                  'rounded-md border border-white/10 px-2 py-0.5 text-xs font-bold',
                  detectionSource === 'tag' ? 'bg-green-500/20' : detectionSource === 'acoustic' ? 'bg-accent-cyan/20' : detectionSource === 'database' ? 'bg-accent-purple/20' : 'bg-accent-amber/20',
                  detectionSource === 'tag' ? 'text-green-400' : detectionSource === 'acoustic' ? 'text-accent-cyan' : detectionSource === 'database' ? 'text-accent-purple' : 'text-accent-amber',
                )}
              >
                {detectionSource === 'tag'
                  ? loc.keyBpm.sourceMetadata
                  : detectionSource === 'acoustic'
                  ? loc.keyBpm.sourceAcoustic
                  : detectionSource === 'database'
                  ? loc.keyBpm.sourceSqlite
                  : loc.keyBpm.sourceManual}
              </span>
              {detectError && (
                <span className="ml-1.5 text-xs text-accent-pink">
                  ({detectError})
                </span>
              )}
            </>
          )}
        </div>

        <button
          onClick={() => handleAutoDetect(currentTrackPath, currentTrackId, true)}
          disabled={isDetecting || !currentTrackPath}
          className={cn(
            'flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/8 px-3 py-1.5 text-ui font-semibold transition-all duration-200',
            isDetecting ? 'text-fg-muted' : 'text-fg',
            isDetecting || !currentTrackPath ? 'cursor-not-allowed' : 'cursor-pointer',
          )}
        >
          <Wand2 size={13} className="text-accent-cyan" />
          {loc.keyBpm.autoDetect}
        </button>
      </div>

      {/* Porównanie A/B: Oryginał vs Zmodyfikowany DSP */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        {/* Lewa karta: Oryginał */}
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white/3 p-4.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-fg-muted uppercase">
              {loc.keyBpm.originalSource}
            </span>
            <span className="rounded-xl bg-white/8 px-2 py-0.5 text-xxs text-fg-secondary">
              1.0x • 0.0 st
            </span>
          </div>

          <div>
            <div className="mb-1 text-xs text-fg-muted">
              {loc.keyBpm.baseKey}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-fg">
                {originalKeyName}
              </span>
              <span
                className="rounded-md bg-accent-pink/20 px-2 py-0.5 font-mono text-sm font-bold text-accent-pink"
                title={loc.keyBpm.camelotNotation}
              >
                {originalCamelot}
              </span>
            </div>
          </div>

          <div className="border-t border-white/6 pt-2.5">
            <div className="mb-1 text-xs text-fg-muted">
              BPM (Tempo)
            </div>
            <div className="text-2xl font-bold text-accent-cyan">
              {baseBpm.toFixed(1)} <span className="text-sm font-semibold">BPM</span>
            </div>
          </div>
        </div>

        {/* Strzałka przejścia */}
        <div className="flex flex-col items-center gap-1.5 text-fg-muted">
          <ArrowRight size={24} className="text-accent-cyan" />
          <span className="text-xxs font-semibold text-fg-secondary">
            DSP
          </span>
        </div>

        {/* Prawa karta: Po DSP (Pitch / Tempo / Rate) */}
        <div
          className="flex flex-col gap-3 rounded-2xl border border-accent-pink/30 bg-linear-135 from-accent-pink/8 to-accent-cyan/8 p-4.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-accent-pink uppercase">
              {loc.keyBpm.outputDsp}
            </span>
            <span className="rounded-xl bg-accent-pink/20 px-2 py-0.5 text-xxs font-semibold text-accent-pink">
              {pitchSemitones > 0 ? `+${pitchSemitones.toFixed(1)}` : pitchSemitones.toFixed(1)} st
            </span>
          </div>

          <div>
            <div className="mb-1 text-xs text-fg-muted">
              {loc.keyBpm.transposedKey}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-fg">
                {transposedKeyName}
              </span>
              <span
                className="rounded-md bg-accent-cyan/20 px-2 py-0.5 font-mono text-sm font-bold text-accent-cyan"
                title={loc.keyBpm.camelotNotation}
              >
                {transposedCamelot}
              </span>
            </div>
          </div>

          <div className="border-t border-white/6 pt-2.5">
            <div className="mb-1 text-xs text-fg-muted">
              {loc.keyBpm.effectiveBpm}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-accent-pink">
                {effectiveBpm.toFixed(1)} <span className="text-sm font-semibold">BPM</span>
              </span>
              {bpmDeltaPercent !== 0 && (
                <span
                  className={cn(
                    'text-xs font-bold',
                    bpmDeltaPercent > 0 ? 'text-accent-cyan' : 'text-accent-amber',
                  )}
                >
                  ({bpmDeltaPercent > 0 ? `+${bpmDeltaPercent}` : bpmDeltaPercent}%)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Panel sterowania tonacją bazową */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">
            {loc.keyBpm.manualOverride}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setIsMinor(false);
                setDetectionSource('manual');
              }}
              className={cn(
                'rounded-md border-0 px-2.5 py-1 text-xs font-bold',
                !isMinor ? 'bg-accent-pink' : 'bg-white/6',
                !isMinor ? 'text-fg' : 'text-fg-muted',
              )}
            >
              Major (Dur)
            </button>
            <button
              onClick={() => {
                setIsMinor(true);
                setDetectionSource('manual');
              }}
              className={cn(
                'rounded-md border-0 px-2.5 py-1 text-xs font-bold',
                isMinor ? 'bg-accent-cyan' : 'bg-white/6',
                isMinor ? 'text-black' : 'text-fg-muted',
              )}
            >
              Minor (Moll)
            </button>
          </div>
        </div>

        {/* Siatka 12 półtonów skali chromatycznej */}
        <div className="grid grid-cols-12 gap-1">
          {CHROMATIC_SCALE.map((note, idx) => {
            const isSelected = baseKeyIndex === idx;
            return (
              <button
                key={note}
                onClick={() => {
                  setBaseKeyIndex(idx);
                  setDetectionSource('manual');
                }}
                className={cn(
                  'rounded-lg border px-0.5 py-2 text-ui transition-all duration-150',
                  isSelected ? 'border-accent-pink' : 'border-white/8',
                  isSelected ? 'bg-linear-135 from-accent-pink/40 to-accent-purple/40' : 'bg-white/3',
                  isSelected ? 'text-fg' : 'text-fg-secondary',
                  isSelected ? 'font-extrabold' : 'font-semibold',
                )}
              >
                {note}
              </button>
            );
          })}
        </div>
      </div>

      {/* Ręczny BPM + Tap Tempo */}
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-white/2 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold">
            {loc.keyBpm.baseBpm}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setBaseBpm((prev) => Math.max(40, prev - 1));
                setDetectionSource('manual');
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-line bg-white/6 text-fg"
            >
              <Minus size={14} />
            </button>
            <input
              type="number"
              step="0.5"
              min="40"
              max="280"
              value={baseBpm}
              onChange={(e) => {
                setBaseBpm(Number(e.target.value) || 128);
                setDetectionSource('manual');
              }}
              className="w-17.5 rounded-md border border-line bg-black/40 px-2 py-1 text-center text-sm font-bold text-accent-cyan"
            />
            <button
              onClick={() => {
                setBaseBpm((prev) => Math.min(280, prev + 1));
                setDetectionSource('manual');
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-line bg-white/6 text-fg"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Tap Tempo Button */}
        <button
          onClick={handleTap}
          className={cn(
            'flex items-center gap-1.5 rounded-lg border border-accent-pink/40 px-4 py-2 text-ui font-bold transition-colors duration-100',
            tapActive ? 'bg-accent-pink' : 'bg-accent-pink/15',
            tapActive ? 'text-fg' : 'text-accent-pink',
          )}
        >
          <Activity size={14} />
          {loc.keyBpm.tapTempo}
        </button>
      </div>

      {/* Dolne przyciski szybkiej transpozycji i zapis */}
      <div className="flex items-center justify-between border-t border-white/8 pt-2">
        <div className="flex items-center gap-2">
          <span className="text-ui text-fg-muted">
            {loc.keyBpm.quickShift}
          </span>
          <button
            onClick={() => onPitchChange(pitchSemitones - 1)}
            className="rounded-lg border border-line bg-white/6 px-3 py-2 text-ui font-semibold text-fg"
          >
            -1 semitone
          </button>
          <button
            onClick={() => onPitchChange(pitchSemitones + 1)}
            className="rounded-lg border border-line bg-white/6 px-3 py-2 text-ui font-semibold text-fg"
          >
            +1 semitone
          </button>
          <button
            onClick={() => {
              onPitchChange(0);
              onTempoChange(1.0);
            }}
            className="flex items-center gap-1 rounded-lg border border-line bg-white/6 px-3 py-2 text-ui font-semibold text-fg-muted"
          >
            <RotateCcw size={13} /> {loc.dsp.reset}
          </button>
        </div>

        <button
          onClick={() => {
            handleSaveForTrack();
            onClose();
          }}
          className="flex items-center gap-1.5 rounded-xl border-0 bg-accent-gradient px-5 py-2.5 text-sm font-bold text-on-accent shadow-lift shadow-accent-pink/30"
        >
          <Check size={16} />
          {loc.keyBpm.saveAndClose}
        </button>
      </div>
    </ModalShell>
  );
};
