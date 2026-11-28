import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Activity, ArrowRight, RotateCcw, Plus, Minus, Check, Wand2, Sparkles } from '../ui/icons';
import { errorMessage, invoke } from '../../api/ipc';
import type { Language, Translations } from '../../i18n';
import { getTranslations } from '../../i18n';
import { cn } from '../../utils/cn';
import {
  Badge,
  Button,
  Card,
  Chip,
  IconButton,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalShell,
  SegmentedControl,
  Spinner,
  TextField,
  type Tone,
} from '../ui';

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

// Key to Camelot notation mapping (for DJs / remixers)
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

type DetectionSource = 'tag' | 'acoustic' | 'database' | 'manual';

const SOURCE_TONES: Record<DetectionSource, Tone> = {
  tag: 'green',
  acoustic: 'cyan',
  database: 'purple',
  manual: 'amber',
};

const SOURCE_LABELS = {
  tag: 'sourceMetadata',
  acoustic: 'sourceAcoustic',
  database: 'sourceSqlite',
  manual: 'sourceManual',
} as const satisfies Record<DetectionSource, keyof Translations['keyBpm']>;

/** Key name with its Camelot code, as shown on the original and output cards. */
function KeyReadout({
  label,
  keyName,
  camelot,
  camelotTone,
  camelotTitle,
}: {
  label: string;
  keyName: string;
  camelot: string;
  camelotTone: Tone;
  camelotTitle: string;
}) {
  return (
    <div>
      <div className="mb-1 text-xs text-fg-muted">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-extrabold tracking-tight text-fg">{keyName}</span>
        <Badge tone={camelotTone} mono className="text-sm" title={camelotTitle}>
          {camelot}
        </Badge>
      </div>
    </div>
  );
}

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

  // Default base key and BPM
  const titleId = useId();
  const [baseKeyIndex, setBaseKeyIndex] = useState<number>(0); // 0 = C
  const [isMinor, setIsMinor] = useState<boolean>(false);
  const [baseBpm, setBaseBpm] = useState<number>(128.0);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [detectionSource, setDetectionSource] = useState<DetectionSource | null>(null);
  const [detectError, setDetectError] = useState<string | null>(null);

  // Tap Tempo state
  const tapTimesRef = useRef<number[]>([]);
  const [tapActive, setTapActive] = useState<boolean>(false);

  // The parent passes a fresh callback on every render. Read it through a ref so the load
  // effect below does not re-run (and overwrite manual edits from the cache) on each parent render.
  const onTrackKeyBpmUpdatedRef = useRef(onTrackKeyBpmUpdated);
  useEffect(() => {
    onTrackKeyBpmUpdatedRef.current = onTrackKeyBpmUpdated;
  }, [onTrackKeyBpmUpdated]);

  // Automatic background key and BPM detection
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
        source: DetectionSource;
      }>('detect_track_key_bpm', {
        path: targetPath,
        trackId: trackId ?? currentTrackId ?? null,
        forceRecompute,
      });

      if (res) {
        setBaseKeyIndex(res.base_key_index);
        setIsMinor(res.is_minor);
        setBaseBpm(res.bpm);
        setDetectionSource(res.source);

        const targetId = trackId ?? currentTrackId;
        if (targetId) {
          onTrackKeyBpmUpdatedRef.current?.(targetId, res.bpm, res.camelot || res.key_name);
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
      console.warn('Key/BPM detection failed:', e);
      setDetectError(errorMessage(e));
    } finally {
      setIsDetecting(false);
    }
  }, [currentTrackPath, currentTrackId]);

  // Load the remembered metadata for the track, or detect it automatically if missing
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
        // Ignore parse errors
      }
    }

    // Not found in the cache and we have a file path: detect it automatically
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
      } catch (err: unknown) {
        console.warn('Failed to save Key/BPM to the database:', err);
      }
    }
  };

  // Key after transposition
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

  // Effective BPM after tempo stretch and playback rate
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
        // Remember the tapped tempo as a manual override so a reload of the cached values keeps it
        const cacheKey = currentTrackId
          ? `auralune_track_key_bpm_${currentTrackId}`
          : currentTrackPath
          ? `auralune_track_key_bpm_${currentTrackPath}`
          : null;
        if (cacheKey) {
          try {
            localStorage.setItem(
              cacheKey,
              JSON.stringify({ baseKeyIndex, isMinor, baseBpm: calculatedBpm, source: 'manual' })
            );
          } catch {}
        }
      }
    }
  };

  return (
    <ModalShell onClose={onClose} layer="top" size="lg" labelledBy={titleId}>
      <ModalHeader
        titleId={titleId}
        title={loc.keyBpm.title}
        subtitle={currentTrackTitle || loc.keyBpm.currentTrack}
        icon={<Activity size={20} />}
        onClose={onClose}
        closeLabel={loc.common.close}
      />

      <ModalBody className="flex flex-col gap-5">
        {/* Where the key and BPM came from, and re-detection */}
        <Card padding="none" className="flex items-center justify-between gap-3 px-3.5 py-2.5">
          <div className="flex items-center gap-2 text-ui" role="status">
            {isDetecting ? (
              <>
                <Spinner size="sm" tone="cyan" />
                <span className="font-semibold text-accent-cyan">{loc.keyBpm.analyzing}</span>
              </>
            ) : (
              <>
                <Sparkles size={16} className="text-accent-pink" />
                <span className="text-fg-secondary">{loc.keyBpm.detectionSource}</span>
                <Badge tone={SOURCE_TONES[detectionSource ?? 'manual']}>{loc.keyBpm[SOURCE_LABELS[detectionSource ?? 'manual']]}</Badge>
                {detectError && <span className="ml-1.5 text-xs text-accent-red">({detectError})</span>}
              </>
            )}
          </div>

          <Button size="sm" onClick={() => handleAutoDetect(currentTrackPath, currentTrackId, true)} disabled={isDetecting || !currentTrackPath}>
            <Wand2 size={13} className="text-accent-cyan" />
            {loc.keyBpm.autoDetect}
          </Button>
        </Card>

        {/* The original key and tempo next to the result after pitch, tempo and rate */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <Card padding="none" className="flex flex-col gap-3 p-4.5">
            <div className="flex items-center justify-between">
              <span className="label-caps">{loc.keyBpm.originalSource}</span>
              <Badge size="xs">1.0x • 0.0 st</Badge>
            </div>
            <KeyReadout label={loc.keyBpm.baseKey} keyName={originalKeyName} camelot={originalCamelot} camelotTone="pink" camelotTitle={loc.keyBpm.camelotNotation} />
            <div className="border-t border-line pt-2.5">
              <div className="mb-1 text-xs text-fg-muted">BPM (Tempo)</div>
              <div className="text-2xl font-bold text-accent-cyan">
                {baseBpm.toFixed(1)} <span className="text-sm font-semibold">BPM</span>
              </div>
            </div>
          </Card>

          <div className="flex flex-col items-center gap-1.5" aria-hidden="true">
            <ArrowRight size={24} className="text-accent-cyan" />
            <span className="text-xxs font-semibold text-fg-secondary">DSP</span>
          </div>

          <Card padding="none" highlight="pink" className="flex flex-col gap-3 p-4.5">
            <div className="flex items-center justify-between">
              <span className="label-caps text-accent-pink">{loc.keyBpm.outputDsp}</span>
              <Badge tone="pink" size="xs" mono>
                {pitchSemitones > 0 ? `+${pitchSemitones.toFixed(1)}` : pitchSemitones.toFixed(1)} st
              </Badge>
            </div>
            <KeyReadout label={loc.keyBpm.transposedKey} keyName={transposedKeyName} camelot={transposedCamelot} camelotTone="cyan" camelotTitle={loc.keyBpm.camelotNotation} />
            <div className="border-t border-line pt-2.5">
              <div className="mb-1 text-xs text-fg-muted">{loc.keyBpm.effectiveBpm}</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-accent-pink">
                  {effectiveBpm.toFixed(1)} <span className="text-sm font-semibold">BPM</span>
                </span>
                {bpmDeltaPercent !== 0 && (
                  <span className={cn('text-xs font-bold', bpmDeltaPercent > 0 ? 'text-accent-cyan' : 'text-accent-amber')}>
                    ({bpmDeltaPercent > 0 ? `+${bpmDeltaPercent}` : bpmDeltaPercent}%)
                  </span>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Manual key: scale and root note */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span id={`${titleId}-key`} className="text-sm font-semibold">
              {loc.keyBpm.manualOverride}
            </span>
            <SegmentedControl
              size="sm"
              label={loc.keyBpm.scaleLabel}
              value={isMinor ? 'minor' : 'major'}
              onChange={(v) => {
                setIsMinor(v === 'minor');
                setDetectionSource('manual');
              }}
              items={[
                { value: 'major', label: 'Major (Dur)' },
                { value: 'minor', label: 'Minor (Moll)' },
              ]}
            />
          </div>
          <div role="group" aria-labelledby={`${titleId}-key`} className="grid grid-cols-12 gap-1">
            {CHROMATIC_SCALE.map((note, idx) => (
              <Chip
                key={note}
                pressed={baseKeyIndex === idx}
                onClick={() => {
                  setBaseKeyIndex(idx);
                  setDetectionSource('manual');
                }}
                className="justify-center px-0.5 py-2 text-ui"
              >
                {note}
              </Chip>
            ))}
          </div>
        </div>

        {/* Manual BPM and tap tempo */}
        <Card padding="none" className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <label htmlFor={`${titleId}-bpm`} className="text-sm font-semibold">
              {loc.keyBpm.baseBpm}
            </label>
            <div className="flex items-center gap-1">
              <IconButton
                size="sm"
                variant="secondary"
                label="−1 BPM"
                onClick={() => {
                  setBaseBpm((prev) => Math.max(40, prev - 1));
                  setDetectionSource('manual');
                }}
              >
                <Minus size={14} />
              </IconButton>
              <TextField
                id={`${titleId}-bpm`}
                size="sm"
                type="number"
                step={0.5}
                min={40}
                max={280}
                value={baseBpm}
                onChange={(e) => {
                  setBaseBpm(Number(e.target.value) || 128);
                  setDetectionSource('manual');
                }}
                className="w-17.5 text-center font-bold text-accent-cyan"
              />
              <IconButton
                size="sm"
                variant="secondary"
                label="+1 BPM"
                onClick={() => {
                  setBaseBpm((prev) => Math.min(280, prev + 1));
                  setDetectionSource('manual');
                }}
              >
                <Plus size={14} />
              </IconButton>
            </div>
          </div>

          {/* Flashes on each tap */}
          <Button variant={tapActive ? 'primary' : 'tinted'} tone="pink" onClick={handleTap}>
            <Activity size={14} />
            {loc.keyBpm.tapTempo}
          </Button>
        </Card>
      </ModalBody>

      {/* Quick transposition and save */}
      <ModalFooter className="justify-between">
        <div className="flex items-center gap-2">
          <span className="text-ui text-fg-muted">{loc.keyBpm.quickShift}</span>
          <Button onClick={() => onPitchChange(pitchSemitones - 1)}>−1 semitone</Button>
          <Button onClick={() => onPitchChange(pitchSemitones + 1)}>+1 semitone</Button>
          <Button
            variant="ghost"
            onClick={() => {
              onPitchChange(0);
              onTempoChange(1.0);
            }}
          >
            <RotateCcw size={13} /> {loc.dsp.reset}
          </Button>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            handleSaveForTrack();
            onClose();
          }}
        >
          <Check size={16} />
          {loc.keyBpm.saveAndClose}
        </Button>
      </ModalFooter>
    </ModalShell>
  );
};
