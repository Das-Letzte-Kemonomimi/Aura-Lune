import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  X,
  Disc3,
  Sliders,
  Play,
  ListPlus,
  Zap,
  Search,
  Check,
  Music2,
  Loader2,
} from '../ui/icons';
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
import { ModalHeader, ModalShell } from '../ui';
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

      {/* CURRENT TRACK AND DJ CROSSFADE CARD */}
      <div className="grid grid-cols-2 gap-4 border-b border-line bg-black/25 px-6 py-4">
        {/* LEFT COLUMN: currently playing track */}
        <div className="rounded-xl border border-white/6 bg-white/4 p-3.5">
          <div
            className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-accent-pink uppercase"
          >
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
              <label className="mb-1 block text-xs text-gray-400">
                {loc.harmonicSuggester.selectBaseTrack}
              </label>
              <select
                value={effectiveCurrentTrack?.id || ''}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setSelectedTrackId(id);
                  setAnalyzedCurrentKey(null);
                  setAnalyzedCurrentBpm(null);
                }}
                className="w-full cursor-pointer rounded-md border border-white/15 bg-black/35 px-2 py-1 text-xs text-fg"
              >
                {libraryTracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} — {t.artist} {t.bpm ? `(${t.bpm.toFixed(0)} BPM)` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {currentCamelot ? (
              <span
                className="rounded-md border border-pink-500/50 bg-pink-500/20 px-2.5 py-1 text-ui font-bold text-pink-400"
              >
                {currentCamelot.raw} ({currentCamelot.keyName})
              </span>
            ) : (
              <span className="text-ui text-gray-400">{loc.harmonicSuggester.keyUnknown}</span>
            )}

            {effectiveBpm ? (
              <span
                className="rounded-md border border-blue-500/50 bg-blue-500/20 px-2.5 py-1 text-ui font-bold text-blue-400"
              >
                {effectiveBpm.toFixed(1)} BPM
              </span>
            ) : (
              <span className="text-ui text-gray-400">{loc.harmonicSuggester.bpmUnknown}</span>
            )}

            {(!currentCamelot || !effectiveBpm) && effectiveCurrentTrack && (
              <button
                onClick={handleAnalyzeCurrent}
                disabled={isAnalyzingCurrent}
                className="flex items-center gap-1 rounded-md border border-white/15 bg-white/8 px-2 py-1 text-xs text-fg"
              >
                {isAnalyzingCurrent ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                {loc.harmonicSuggester.detectNow}
              </button>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: DJ beat-matched crossfade */}
        <div className="flex flex-col justify-between rounded-xl border border-white/6 bg-white/4 p-3.5">
          <div>
            <div
              className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-violet-500 uppercase"
            >
              <Sliders size={14} /> DJ Beat-Matched Crossfade
            </div>
            <div className="mb-2 text-ui text-fg-muted">
              {loc.harmonicSuggester.beatMatchedTransition}{' '}
              <strong className="text-fg">
                {crossfadeDurationMs === 0
                  ? loc.harmonicSuggester.disabled
                  : `${crossfadeDurationMs} ms (${(crossfadeDurationMs / 1000).toFixed(2)}s)`}
              </strong>
              {effectiveBpm ? (
                <span className="ml-1.5 text-xs text-violet-400">
                  @{effectiveBpm.toFixed(0)} BPM
                </span>
              ) : (
                <span className="ml-1.5 text-xs text-fg-muted">
                  {loc.harmonicSuggester.defaultBpm}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleSetBeatMatch(4)}
              className={cn(
                'flex-1 rounded-md px-1 py-1.5 text-center text-xs font-semibold text-fg transition-all duration-150',
                activeBeatMode === 4 ? 'bg-violet-500' : 'bg-white/6',
              )}
              style={{
                border: '1px solid ' + (activeBeatMode === 4 ? '#a78bfa' : 'rgba(255, 255, 255, 0.1)'),
              }}
            >
              <div>{loc.harmonicSuggester.bar1}</div>
              <div className="mt-0.5 text-xxs opacity-85">
                {(ms4 / 1000).toFixed(2)}s
              </div>
            </button>
            <button
              onClick={() => handleSetBeatMatch(8)}
              className={cn(
                'flex-1 rounded-md px-1 py-1.5 text-center text-xs font-semibold text-fg transition-all duration-150',
                activeBeatMode === 8 ? 'bg-violet-500' : 'bg-white/6',
              )}
              style={{
                border: '1px solid ' + (activeBeatMode === 8 ? '#a78bfa' : 'rgba(255, 255, 255, 0.1)'),
              }}
            >
              <div>{loc.harmonicSuggester.bar2}</div>
              <div className="mt-0.5 text-xxs opacity-85">
                {(ms8 / 1000).toFixed(2)}s
              </div>
            </button>
            <button
              onClick={() => handleSetBeatMatch(16)}
              className={cn(
                'flex-1 rounded-md px-1 py-1.5 text-center text-xs font-semibold text-fg transition-all duration-150',
                activeBeatMode === 16 ? 'bg-violet-500' : 'bg-white/6',
              )}
              style={{
                border: '1px solid ' + (activeBeatMode === 16 ? '#a78bfa' : 'rgba(255, 255, 255, 0.1)'),
              }}
            >
              <div>{loc.harmonicSuggester.bar4}</div>
              <div className="mt-0.5 text-xxs opacity-85">
                {(ms16 / 1000).toFixed(2)}s
              </div>
            </button>
            <button
              onClick={() => onSetCrossfadeDuration(0)}
              className={cn(
                'rounded-md px-3 py-1.5 text-center text-xs font-semibold transition-all duration-150',
                crossfadeDurationMs === 0 ? 'bg-accent-red/25' : 'bg-white/6',
                crossfadeDurationMs === 0 ? 'text-accent-red' : 'text-gray-400',
              )}
              style={{
                border: '1px solid ' + (crossfadeDurationMs === 0 ? '#ef4444' : 'rgba(255, 255, 255, 0.1)'),
              }}
              title={loc.harmonicSuggester.disableCrossfade}
            >
              <div>{loc.harmonicSuggester.crossfadeOff}</div>
              <div className="mt-0.5 text-xxs opacity-85">0s</div>
            </button>
          </div>
        </div>
      </div>

      {/* SEARCH AND FILTER BAR */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-6 py-3">
        <div className="flex min-w-55 flex-1 items-center gap-2 rounded-lg border border-line bg-white/5 px-3 py-1.5">
          <Search size={16} className="text-fg-muted" />
          <input
            type="text"
            placeholder={loc.harmonicSuggester.filterTracksPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 border-0 bg-transparent text-sm text-inherit outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="border-0 bg-transparent text-gray-400"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <button
          onClick={() => setFilterOnlyInKey(!filterOnlyInKey)}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-ui font-semibold',
            filterOnlyInKey ? 'bg-accent-green/20' : 'bg-white/5',
            filterOnlyInKey ? 'text-emerald-400' : 'text-gray-400',
          )}
          style={{ border: '1px solid ' + (filterOnlyInKey ? '#10b981' : 'rgba(255, 255, 255, 0.1)') }}
        >
          {filterOnlyInKey && <Check size={14} />} {loc.harmonicSuggester.compatibleCamelotOnly}
        </button>

        <button
          onClick={() => setFilterOnlyBpm(!filterOnlyBpm)}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-ui font-semibold',
            filterOnlyBpm ? 'bg-blue-500/20' : 'bg-white/5',
            filterOnlyBpm ? 'text-blue-400' : 'text-gray-400',
          )}
          style={{ border: '1px solid ' + (filterOnlyBpm ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)') }}
        >
          {filterOnlyBpm && <Check size={14} />} {loc.harmonicSuggester.compatibleBpmOnly}
        </button>

        <div className="ml-auto text-ui text-fg-muted">
          {loc.harmonicSuggester.foundCount} <strong>{rankedTracks.length}</strong> {loc.harmonicSuggester.tracksUnit}
        </div>
      </div>

      {/* CANDIDATE LIST */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-6 py-3">
        {rankedTracks.length === 0 ? (
          <div className="px-5 py-10 text-center text-fg-muted">
            <Disc3 size={40} className="mb-3 opacity-30" />
            <div>{loc.harmonicSuggester.noFilterMatches}</div>
            <div className="mt-1.5 text-ui">
              {loc.harmonicSuggester.noFilterMatchesDesc}
            </div>
          </div>
        ) : (
          rankedTracks.slice(0, 50).map(({ track, match }) => {
            const candCamelot = parseCamelotKey(track.initial_key);
            return (
              <div
                key={track.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/3 px-4 py-3 transition-all duration-150 hover:border-(--badge) hover:bg-white/7"
                style={cssVars({ '--badge': match.badgeColor })}
              >
                {/* MATCH INDICATOR AND PERCENTAGE */}
                <div className="flex min-w-27.5 items-center gap-3.5">
                  <div
                    className="flex h-11.5 w-11.5 flex-col items-center justify-center rounded-xl text-md leading-tight font-extrabold"
                    style={{
                      background: `${match.badgeColor}22`,
                      border: `2px solid ${match.badgeColor}`,
                      color: match.badgeColor,
                    }}
                  >
                    {match.score}%
                    <span className="text-2xs font-semibold">{loc.harmonicSuggester.matchWord}</span>
                  </div>

                  <div>
                    <span
                      className="inline-block rounded-sm px-2 py-0.5 text-xs font-bold"
                      style={{ background: `${match.badgeColor}20`, color: match.badgeColor }}
                    >
                      {harmonicBadgeLabel(match, loc.harmonicSuggester)}
                    </span>
                  </div>
                </div>

                {/* TRACK INFO */}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-md font-semibold">
                    {track.title}
                  </div>
                  <div className="truncate text-ui text-fg-muted">
                    {track.artist} {track.album ? `• ${track.album}` : ''}
                  </div>

                  {/* DANE CAMELOT & BPM */}
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={cn(
                        'rounded-sm bg-white/6 px-1.5 py-px text-xs font-semibold',
                        candCamelot ? 'text-pink-400' : 'text-gray-400',
                      )}
                    >
                      {candCamelot ? `${candCamelot.raw} (${candCamelot.keyName})` : loc.harmonicSuggester.keyShortUnknown}
                    </span>
                    <span
                      className={cn(
                        'rounded-sm bg-white/6 px-1.5 py-px text-xs font-semibold',
                        track.bpm ? 'text-blue-400' : 'text-gray-400',
                      )}
                    >
                      {track.bpm ? `${track.bpm.toFixed(1)} BPM` : loc.harmonicSuggester.bpmShortUnknown}
                    </span>
                    {match.bpmDiffPercent > 0 && (
                      <span className="text-xxs text-gray-400">
                        (Δ {match.bpmDiffPercent}%)
                      </span>
                    )}
                  </div>
                </div>

                {/* ACTION BUTTONS */}
                <div className="flex items-center gap-2">
                  {track.bpm && effectiveBpm && Math.abs(track.bpm - effectiveBpm) > 0.5 && (
                    <button
                      onClick={() => onSyncTempo(track.bpm!)}
                      title={fmt(loc.harmonicSuggester.syncTempoTooltip, track.bpm.toFixed(1))}
                      className="flex items-center gap-1 rounded-md border border-blue-500/30 bg-blue-500/15 px-2.5 py-1.5 text-xs text-blue-400"
                    >
                      <Zap size={12} /> Sync BPM
                    </button>
                  )}

                  <button
                    onClick={() => onEnqueueTrack(track, true)}
                    title={loc.harmonicSuggester.enqueueNext}
                    className="flex items-center gap-1 rounded-md border border-white/10 bg-white/6 px-2.5 py-1.5 text-xs text-gray-200"
                  >
                    <ListPlus size={14} /> {loc.harmonicSuggester.nextBtn}
                  </button>

                  <button
                    onClick={() => onPlayTrack(track)}
                    title={loc.harmonicSuggester.playNowCrossfade}
                    className="flex items-center gap-1.5 rounded-md border-0 bg-linear-135 from-pink-500 to-violet-500 px-3.5 py-1.5 text-ui font-bold text-fg shadow-md shadow-pink-500/30"
                  >
                    <Play size={13} fill="#fff" /> Mix Now
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </ModalShell>
  );
};
