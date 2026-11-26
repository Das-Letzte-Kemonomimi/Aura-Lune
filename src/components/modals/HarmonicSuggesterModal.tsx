import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { X, Disc3, Sliders, Play, ListPlus, Zap, Search, Check, Music2 } from '../ui/icons';
import { invoke } from '../../api/ipc';
import { type Language, getTranslations } from '../../i18n';
import { fmt } from '../../utils/fmt';
import {
  evaluateHarmonicMatch,
  harmonicBadgeLabel,
  parseCamelotKey,
  calculateBeatMatchedCrossfadeMs,
} from '../../utils/harmonicMixing';
import { cn } from '../../utils/cn';
import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  FieldLabel,
  IconButton,
  ModalHeader,
  ModalShell,
  Select,
  Spinner,
  TextField,
} from '../ui';
import { cssVars } from '../../utils/cssVars';

export interface HarmonicTrack {
  id: number;
  uri: string;
  title: string;
  artist: string;
  album: string | null;
  duration_ms: number;
  bpm?: number | null;
  initial_key?: string | null;
}

interface HarmonicSuggesterModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack: HarmonicTrack | null;
  libraryTracks: HarmonicTrack[];
  onPlayTrack: (track: HarmonicTrack) => void;
  onEnqueueTrack: (track: HarmonicTrack, playNext: boolean) => void;
  onSyncTempo: (targetBpm: number) => void;
  crossfadeDurationMs: number;
  onSetCrossfadeDuration: (ms: number) => void;
  onTrackKeyBpmUpdated?: (trackId: number, bpm: number, keyName: string) => void;
  currentLang?: Language;
}

export const HarmonicSuggesterModal: React.FC<HarmonicSuggesterModalProps> = ({
  isOpen,
  onClose,
  currentTrack,
  libraryTracks,
  onPlayTrack,
  onEnqueueTrack,
  onSyncTempo,
  crossfadeDurationMs,
  onSetCrossfadeDuration,
  onTrackKeyBpmUpdated,
  currentLang = 'pl',
}) => {
  const loc = getTranslations(currentLang);

  const titleId = useId();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOnlyInKey, setFilterOnlyInKey] = useState(false);
  const [filterOnlyBpm, setFilterOnlyBpm] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);
  const [isAnalyzingCurrent, setIsAnalyzingCurrent] = useState(false);
  const [analyzedCurrentKey, setAnalyzedCurrentKey] = useState<string | null>(null);
  const [analyzedCurrentBpm, setAnalyzedCurrentBpm] = useState<number | null>(null);

  // Without an active track in the player, the reference track selected from the library is used
  const effectiveCurrentTrack = useMemo(() => {
    if (currentTrack) return currentTrack;
    if (selectedTrackId) {
      const found = libraryTracks.find((t) => t.id === selectedTrackId);
      if (found) return found;
    }
    return libraryTracks[0] || null;
  }, [currentTrack, selectedTrackId, libraryTracks]);

  // Sync with localStorage (e.g. if KeyBpmModal analysed this track before)
  useEffect(() => {
    if (!isOpen || !effectiveCurrentTrack) return;
    setAnalyzedCurrentKey(null);
    setAnalyzedCurrentBpm(null);

    // If the track already has a correctly parsed Camelot key and BPM, there is no need to search the cache
    if (parseCamelotKey(effectiveCurrentTrack.initial_key) && effectiveCurrentTrack.bpm) {
      return;
    }

    const cacheKeyId = effectiveCurrentTrack.id ? `auralune_track_key_bpm_${effectiveCurrentTrack.id}` : null;
    const cacheKeyUri = effectiveCurrentTrack.uri ? `auralune_track_key_bpm_${effectiveCurrentTrack.uri}` : null;
    const stored = (cacheKeyId && localStorage.getItem(cacheKeyId)) || (cacheKeyUri && localStorage.getItem(cacheKeyUri));
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (typeof parsed.baseKeyIndex === 'number') {
          const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
          const note = notes[parsed.baseKeyIndex] || 'C';
          const keyStr = parsed.isMinor ? `${note}m` : `${note} Maj`;
          setAnalyzedCurrentKey(keyStr);
          if (effectiveCurrentTrack.id && parsed.baseBpm) {
            onTrackKeyBpmUpdated?.(effectiveCurrentTrack.id, parsed.baseBpm, keyStr);
          }
        }
        if (typeof parsed.baseBpm === 'number') {
          setAnalyzedCurrentBpm(parsed.baseBpm);
        }
      } catch {}
    }
  }, [isOpen, effectiveCurrentTrack, onTrackKeyBpmUpdated]);

  const effectiveKey = analyzedCurrentKey || effectiveCurrentTrack?.initial_key || null;
  const effectiveBpm = analyzedCurrentBpm || effectiveCurrentTrack?.bpm || null;

  const currentCamelot = parseCamelotKey(effectiveKey);
  const currentBpm = effectiveBpm && effectiveBpm > 0 ? effectiveBpm : 128;

  // Times for 4, 8 and 16 beats in milliseconds, from the BPM
  const ms4 = calculateBeatMatchedCrossfadeMs(currentBpm, 4);
  const ms8 = calculateBeatMatchedCrossfadeMs(currentBpm, 8);
  const ms16 = calculateBeatMatchedCrossfadeMs(currentBpm, 16);

  // Detect which bar mode is active now (matched to the current crossfadeDurationMs)
  const activeBeatMode: 4 | 8 | 16 | null = useMemo(() => {
    if (crossfadeDurationMs === 0) return null;
    if (Math.abs(crossfadeDurationMs - ms4) < 150) return 4;
    if (Math.abs(crossfadeDurationMs - ms8) < 150) return 8;
    if (Math.abs(crossfadeDurationMs - ms16) < 150) return 16;
    return null;
  }, [crossfadeDurationMs, ms4, ms8, ms16]);

  // Auto-tune the crossfade to the track's beats
  const handleSetBeatMatch = (beats: 4 | 8 | 16) => {
    const targetMs = calculateBeatMatchedCrossfadeMs(currentBpm, beats);
    onSetCrossfadeDuration(targetMs);
  };

  // Analyse the key and BPM of the base track if they are not in the database
  const handleAnalyzeCurrent = useCallback(async () => {
    if (!effectiveCurrentTrack) return;
    setIsAnalyzingCurrent(true);
    try {
      const res = await invoke<{
        bpm: number;
        key_name: string;
        camelot: string;
      }>('detect_track_key_bpm', {
        path: effectiveCurrentTrack.uri,
        trackId: effectiveCurrentTrack.id,
        forceRecompute: true,
      });
      if (res) {
        const keyToUse = res.camelot || res.key_name;
        setAnalyzedCurrentKey(keyToUse);
        setAnalyzedCurrentBpm(res.bpm);
        if (effectiveCurrentTrack.id) {
          onTrackKeyBpmUpdated?.(effectiveCurrentTrack.id, res.bpm, keyToUse);
        }
      }
    } catch (e) {
      console.error('Track analysis failed:', e);
    } finally {
      setIsAnalyzingCurrent(false);
    }
  }, [effectiveCurrentTrack, onTrackKeyBpmUpdated]);

  const hasCamelot = Boolean(currentCamelot);
  const hasBpm = Boolean(effectiveBpm);

  // Try to detect the key and BPM automatically on open for a track that has none
  useEffect(() => {
    if (isOpen && effectiveCurrentTrack && (!currentCamelot || !effectiveBpm) && !isAnalyzingCurrent) {
      handleAnalyzeCurrent();
    }
  }, [isOpen, effectiveCurrentTrack, currentCamelot, effectiveBpm, hasCamelot, hasBpm, isAnalyzingCurrent, handleAnalyzeCurrent]);

  // Ranking of library tracks
  const rankedTracks = useMemo(() => {
    if (!isOpen || !effectiveCurrentTrack) return [];

    const query = searchQuery.trim().toLowerCase();

    const candidates = libraryTracks
      .filter((t) => t.id !== effectiveCurrentTrack.id)
      .map((track) => {
        const match = evaluateHarmonicMatch(
          effectiveKey,
          effectiveBpm,
          track.initial_key,
          track.bpm
        );
        return {
          track,
          match,
        };
      });

    // Filtering
    return candidates
      .filter(({ track, match }) => {
        if (query) {
          const matchTitle = track.title.toLowerCase().includes(query);
          const matchArtist = track.artist.toLowerCase().includes(query);
          if (!matchTitle && !matchArtist) return false;
        }
        if (filterOnlyInKey && match.keyScore < 80) return false;
        if (filterOnlyBpm && match.bpmScore < 70) return false;
        return true;
      })
      .sort((a, b) => b.match.score - a.match.score);
  }, [
    isOpen,
    effectiveCurrentTrack,
    libraryTracks,
    effectiveKey,
    effectiveBpm,
    searchQuery,
    filterOnlyInKey,
    filterOnlyBpm,
  ]);

  if (!isOpen) return null;

  const beatModes = [
    { beats: 4, label: loc.harmonicSuggester.bar1, ms: ms4 },
    { beats: 8, label: loc.harmonicSuggester.bar2, ms: ms8 },
    { beats: 16, label: loc.harmonicSuggester.bar4, ms: ms16 },
  ] as const;

  return (
    <ModalShell onClose={onClose} layer="tool" size="2xl" labelledBy={titleId}>
      <ModalHeader
        titleId={titleId}
        title="Harmonic Queue Assistant & DJ Crossfade"
        subtitle={loc.harmonicSuggester.subtitle}
        icon={<Disc3 size={20} />}
        tone="purple"
        onClose={onClose}
        closeLabel={loc.common.close}
      />

      {/* The base track, and the beat-matched crossfade */}
      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-black/25 px-6 py-4">
        <Card padding="none" className="p-3.5">
          <div className="label-caps mb-1.5 flex items-center gap-1.5 text-accent-pink">
            <Music2 size={14} /> {loc.harmonicSuggester.currentTrack}
          </div>
          <div className="truncate text-base font-bold">
            {effectiveCurrentTrack?.title || loc.harmonicSuggester.noActiveTrack}
          </div>
          <div className="mb-2 text-ui text-fg-muted">
            {effectiveCurrentTrack?.artist || loc.harmonicSuggester.selectFromLibrary}
          </div>

          {!currentTrack && libraryTracks.length > 0 && (
            <div className="mb-2.5">
              <FieldLabel htmlFor={`${titleId}-base`}>{loc.harmonicSuggester.selectBaseTrack}</FieldLabel>
              <Select
                id={`${titleId}-base`}
                size="sm"
                value={effectiveCurrentTrack?.id || ''}
                onChange={(e) => {
                  setSelectedTrackId(Number(e.target.value));
                  setAnalyzedCurrentKey(null);
                  setAnalyzedCurrentBpm(null);
                }}
              >
                {libraryTracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} — {t.artist} {t.bpm ? `(${t.bpm.toFixed(0)} BPM)` : ''}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {currentCamelot ? (
              <Badge tone="pink" className="text-ui">
                {currentCamelot.raw} ({currentCamelot.keyName})
              </Badge>
            ) : (
              <span className="text-ui text-fg-muted">{loc.harmonicSuggester.keyUnknown}</span>
            )}
            {effectiveBpm ? (
              <Badge tone="cyan" className="text-ui">
                {effectiveBpm.toFixed(1)} BPM
              </Badge>
            ) : (
              <span className="text-ui text-fg-muted">{loc.harmonicSuggester.bpmUnknown}</span>
            )}
            {(!currentCamelot || !effectiveBpm) && effectiveCurrentTrack && (
              <Button size="sm" onClick={handleAnalyzeCurrent} disabled={isAnalyzingCurrent}>
                {isAnalyzingCurrent ? <Spinner size="sm" /> : <Zap size={12} />}
                {loc.harmonicSuggester.detectNow}
              </Button>
            )}
          </div>
        </Card>

        <Card padding="none" className="flex flex-col justify-between p-3.5">
          <div>
            <div className="label-caps mb-1.5 flex items-center gap-1.5 text-accent-purple">
              <Sliders size={14} /> DJ Beat-Matched Crossfade
            </div>
            <div className="mb-2 text-ui text-fg-muted">
              {loc.harmonicSuggester.beatMatchedTransition}{' '}
              <strong className="text-fg">
                {crossfadeDurationMs === 0
                  ? loc.harmonicSuggester.disabled
                  : `${crossfadeDurationMs} ms (${(crossfadeDurationMs / 1000).toFixed(2)}s)`}
              </strong>
              <span className={cn('ml-1.5 text-xs', effectiveBpm ? 'text-accent-purple' : 'text-fg-muted')}>
                {effectiveBpm ? `@${effectiveBpm.toFixed(0)} BPM` : loc.harmonicSuggester.defaultBpm}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {beatModes.map((mode) => (
              <Chip
                key={mode.beats}
                tone="purple"
                pressed={activeBeatMode === mode.beats}
                onClick={() => handleSetBeatMatch(mode.beats)}
                className="flex-1 flex-col gap-0.5 px-1 py-1.5"
              >
                <span>{mode.label}</span>
                <span className="text-xxs opacity-85">{(mode.ms / 1000).toFixed(2)}s</span>
              </Chip>
            ))}
            <Chip
              tone="red"
              pressed={crossfadeDurationMs === 0}
              onClick={() => onSetCrossfadeDuration(0)}
              title={loc.harmonicSuggester.disableCrossfade}
              className="flex-col gap-0.5 px-3 py-1.5"
            >
              <span>{loc.harmonicSuggester.crossfadeOff}</span>
              <span className="text-xxs opacity-85">0s</span>
            </Chip>
          </div>
        </Card>
      </div>

      {/* Search and filters */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line px-6 py-3">
        <div className="relative min-w-55 flex-1">
          <TextField
            size="sm"
            icon={<Search size={16} />}
            aria-label={loc.harmonicSuggester.filterTracksPlaceholder}
            placeholder={loc.harmonicSuggester.filterTracksPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <IconButton
              size="sm"
              label={loc.common.clear}
              onClick={() => setSearchQuery('')}
              className="absolute top-1/2 right-0.5 size-6 -translate-y-1/2"
            >
              <X size={14} />
            </IconButton>
          )}
        </div>

        <Chip tone="green" pressed={filterOnlyInKey} onClick={() => setFilterOnlyInKey(!filterOnlyInKey)}>
          {filterOnlyInKey && <Check size={14} />} {loc.harmonicSuggester.compatibleCamelotOnly}
        </Chip>
        <Chip tone="cyan" pressed={filterOnlyBpm} onClick={() => setFilterOnlyBpm(!filterOnlyBpm)}>
          {filterOnlyBpm && <Check size={14} />} {loc.harmonicSuggester.compatibleBpmOnly}
        </Chip>

        <div className="ml-auto text-ui text-fg-muted" role="status">
          {loc.harmonicSuggester.foundCount} <strong>{rankedTracks.length}</strong> {loc.harmonicSuggester.tracksUnit}
        </div>
      </div>

      {/* Ranked candidates */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-6 py-3">
        {rankedTracks.length === 0 ? (
          <EmptyState
            icon={<Disc3 size={40} />}
            title={loc.harmonicSuggester.noFilterMatches}
            description={loc.harmonicSuggester.noFilterMatchesDesc}
          />
        ) : (
          rankedTracks.slice(0, 50).map(({ track, match }) => {
            const candCamelot = parseCamelotKey(track.initial_key);
            return (
              <Card
                key={track.id}
                padding="none"
                className="flex items-center justify-between gap-4 px-4 py-3 transition-colors duration-150 hover:border-(--badge) hover:bg-surface-hover"
                // The match colour comes from the harmonic score, so it stays a CSS variable.
                style={cssVars({ '--badge': match.badgeColor })}
              >
                <div className="flex min-w-27.5 items-center gap-3.5">
                  <div
                    className="flex size-11.5 flex-col items-center justify-center rounded-xl border-2 border-(--badge) bg-(--badge)/15 text-md leading-tight font-extrabold text-(--badge)"
                  >
                    {match.score}%
                    <span className="text-2xs font-semibold">{loc.harmonicSuggester.matchWord}</span>
                  </div>
                  <span className="inline-block rounded-sm bg-(--badge)/15 px-2 py-0.5 text-xs font-bold text-(--badge)">
                    {harmonicBadgeLabel(match, loc.harmonicSuggester)}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-md font-semibold">{track.title}</div>
                  <div className="truncate text-ui text-fg-muted">
                    {track.artist} {track.album ? `• ${track.album}` : ''}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge size="xs" className={candCamelot ? 'text-accent-pink' : undefined}>
                      {candCamelot ? `${candCamelot.raw} (${candCamelot.keyName})` : loc.harmonicSuggester.keyShortUnknown}
                    </Badge>
                    <Badge size="xs" className={track.bpm ? 'text-accent-cyan' : undefined}>
                      {track.bpm ? `${track.bpm.toFixed(1)} BPM` : loc.harmonicSuggester.bpmShortUnknown}
                    </Badge>
                    {match.bpmDiffPercent > 0 && <span className="text-xxs text-fg-muted">(Δ {match.bpmDiffPercent}%)</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {track.bpm && effectiveBpm && Math.abs(track.bpm - effectiveBpm) > 0.5 && (
                    <Button
                      variant="tinted"
                      tone="cyan"
                      size="sm"
                      onClick={() => onSyncTempo(track.bpm!)}
                      title={fmt(loc.harmonicSuggester.syncTempoTooltip, track.bpm.toFixed(1))}
                    >
                      <Zap size={12} /> Sync BPM
                    </Button>
                  )}
                  <Button size="sm" onClick={() => onEnqueueTrack(track, true)} title={loc.harmonicSuggester.enqueueNext}>
                    <ListPlus size={14} /> {loc.harmonicSuggester.nextBtn}
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => onPlayTrack(track)} title={loc.harmonicSuggester.playNowCrossfade}>
                    <Play size={13} fill="currentColor" /> Mix Now
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </ModalShell>
  );
};
