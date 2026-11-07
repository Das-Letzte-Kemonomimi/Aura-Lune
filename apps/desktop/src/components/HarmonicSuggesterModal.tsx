import React, { useState, useMemo, useEffect } from 'react';
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
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import type { Language } from '../i18n';
import {
  evaluateHarmonicMatch,
  parseCamelotKey,
  calculateBeatMatchedCrossfadeMs,
} from '../utils/harmonicMixing';

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
  currentLang = 'pl',
}) => {
  const isPl = currentLang === 'pl';

  const [searchQuery, setSearchQuery] = useState('');
  const [filterOnlyInKey, setFilterOnlyInKey] = useState(false);
  const [filterOnlyBpm, setFilterOnlyBpm] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);
  const [isAnalyzingCurrent, setIsAnalyzingCurrent] = useState(false);
  const [analyzedCurrentKey, setAnalyzedCurrentKey] = useState<string | null>(null);
  const [analyzedCurrentBpm, setAnalyzedCurrentBpm] = useState<number | null>(null);

  // Jeśli brak aktywnego utworu w odtwarzaczu, używamy wybranego utworu referencyjnego z biblioteki
  const effectiveCurrentTrack = useMemo(() => {
    if (currentTrack) return currentTrack;
    if (selectedTrackId) {
      const found = libraryTracks.find((t) => t.id === selectedTrackId);
      if (found) return found;
    }
    return libraryTracks[0] || null;
  }, [currentTrack, selectedTrackId, libraryTracks]);

  const effectiveKey = analyzedCurrentKey || effectiveCurrentTrack?.initial_key || null;
  const effectiveBpm = analyzedCurrentBpm || effectiveCurrentTrack?.bpm || null;

  const currentCamelot = parseCamelotKey(effectiveKey);
  const currentBpm = effectiveBpm && effectiveBpm > 0 ? effectiveBpm : 128;

  // Obliczenia czasów dla 4, 8, 16 beatów w milisekundach na podstawie BPM
  const ms4 = calculateBeatMatchedCrossfadeMs(currentBpm, 4);
  const ms8 = calculateBeatMatchedCrossfadeMs(currentBpm, 8);
  const ms16 = calculateBeatMatchedCrossfadeMs(currentBpm, 16);

  // Wykrycie, który tryb taktów jest aktualnie aktywny (dopasowany do bieżącego crossfadeDurationMs)
  const activeBeatMode: 4 | 8 | 16 | null = useMemo(() => {
    if (crossfadeDurationMs === 0) return null;
    if (Math.abs(crossfadeDurationMs - ms4) < 150) return 4;
    if (Math.abs(crossfadeDurationMs - ms8) < 150) return 8;
    if (Math.abs(crossfadeDurationMs - ms16) < 150) return 16;
    return null;
  }, [crossfadeDurationMs, ms4, ms8, ms16]);

  // Auto-dostrojenie crossfade do beatów utworu
  const handleSetBeatMatch = (beats: 4 | 8 | 16) => {
    const targetMs = calculateBeatMatchedCrossfadeMs(currentBpm, beats);
    onSetCrossfadeDuration(targetMs);
  };

  // Analiza klucza i BPM dla utworu bazowego, jeśli nie ma w bazie
  const handleAnalyzeCurrent = async () => {
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
        setAnalyzedCurrentKey(res.camelot || res.key_name);
        setAnalyzedCurrentBpm(res.bpm);
      }
    } catch (e) {
      console.error('Błąd analizy utworu:', e);
    } finally {
      setIsAnalyzingCurrent(false);
    }
  };

  // Automatyczna próba wykrycia klucza i BPM po otwarciu okna dla utworu, który ich nie posiada
  useEffect(() => {
    if (isOpen && effectiveCurrentTrack && !effectiveKey && !effectiveBpm && !isAnalyzingCurrent) {
      handleAnalyzeCurrent();
    }
  }, [isOpen, effectiveCurrentTrack?.id]);

  // Ranking utworów z biblioteki
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

    // Filtrowanie
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
    currentTrack,
    libraryTracks,
    effectiveKey,
    effectiveBpm,
    searchQuery,
    filterOnlyInKey,
    filterOnlyBpm,
  ]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10500,
        background: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '920px',
          maxHeight: '90vh',
          background: 'var(--bg-card, rgba(22, 22, 34, 0.95))',
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
          borderRadius: '16px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6), 0 0 30px rgba(255, 77, 148, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: 'var(--text-main, #f0f0f5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* NAGŁÓWEK */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(90deg, rgba(255, 77, 148, 0.12), rgba(139, 92, 246, 0.08))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(236, 72, 153, 0.35)',
              }}
            >
              <Disc3 size={22} color="#fff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
                Harmonic Queue Assistant & DJ Crossfade
              </h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted, #9ca3af)' }}>
                {isPl
                  ? 'Inteligentne miksowanie harmoniczne (Camelot Wheel) i płynne przejścia beat-matched'
                  : 'Intelligent harmonic mixing (Camelot Wheel) and smooth beat-matched transitions'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted, #9ca3af)',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* KARTA BIEŻĄCEGO UTWORU I DJ CROSSFADE */}
        <div
          style={{
            padding: '16px 24px',
            background: 'rgba(0, 0, 0, 0.25)',
            borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
          }}
        >
          {/* LEWA KOLUMNA: Aktualnie odtwarzany utwór */}
          <div
            style={{
              padding: '14px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--accent-pink, #ec4899)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Music2 size={14} /> {isPl ? 'Aktualny utwór' : 'Current Track'}
            </div>
            <div style={{ fontWeight: 700, fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {effectiveCurrentTrack?.title || (isPl ? 'Brak aktywnego utworu' : 'No active track')}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted, #9ca3af)', marginBottom: '8px' }}>
              {effectiveCurrentTrack?.artist || (isPl ? 'Wybierz utwór z biblioteki' : 'Select a track from library')}
            </div>

            {!currentTrack && libraryTracks.length > 0 && (
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '0.72rem', color: '#9ca3af', display: 'block', marginBottom: '3px' }}>
                  {isPl ? 'Wybierz utwór bazowy do miksu:' : 'Select base track for mix:'}
                </label>
                <select
                  value={effectiveCurrentTrack?.id || ''}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setSelectedTrackId(id);
                    setAnalyzedCurrentKey(null);
                    setAnalyzedCurrentBpm(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    background: 'rgba(0,0,0,0.35)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  {libraryTracks.map((t) => (
                    <option key={t.id} value={t.id} style={{ background: '#1c1c28', color: '#fff' }}>
                      {t.title} — {t.artist} {t.bpm ? `(${t.bpm.toFixed(0)} BPM)` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {currentCamelot ? (
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: 'rgba(236, 72, 153, 0.2)',
                    border: '1px solid rgba(236, 72, 153, 0.5)',
                    color: '#f472b6',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                  }}
                >
                  {currentCamelot.raw} ({currentCamelot.keyName})
                </span>
              ) : (
                <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>{isPl ? 'Klucz nieznany' : 'Key unknown'}</span>
              )}

              {effectiveBpm ? (
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: 'rgba(59, 130, 246, 0.2)',
                    border: '1px solid rgba(59, 130, 246, 0.5)',
                    color: '#60a5fa',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                  }}
                >
                  {effectiveBpm.toFixed(1)} BPM
                </span>
              ) : (
                <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>{isPl ? 'BPM nieznane' : 'BPM unknown'}</span>
              )}

              {(!effectiveKey || !effectiveBpm) && effectiveCurrentTrack && (
                <button
                  onClick={handleAnalyzeCurrent}
                  disabled={isAnalyzingCurrent}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '6px',
                    color: '#fff',
                    padding: '4px 8px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {isAnalyzingCurrent ? <Loader2 size={12} className="spin" /> : <Zap size={12} />}
                  {isPl ? 'Wykryj teraz' : 'Detect now'}
                </button>
              )}
            </div>
          </div>

          {/* PRAWA KOLUMNA: DJ Beat-Matched Crossfade */}
          <div
            style={{
              padding: '14px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#8b5cf6',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Sliders size={14} /> DJ Beat-Matched Crossfade
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted, #9ca3af)', marginBottom: '8px' }}>
                {isPl ? 'Płynne przenikanie dopasowane do tempa:' : 'Beat-matched transition:'}{' '}
                <strong style={{ color: '#fff' }}>
                  {crossfadeDurationMs === 0
                    ? (isPl ? 'Wyłączone (0.0s)' : 'Disabled (0.0s)')
                    : `${crossfadeDurationMs} ms (${(crossfadeDurationMs / 1000).toFixed(2)}s)`}
                </strong>
                {effectiveBpm ? (
                  <span style={{ fontSize: '0.74rem', color: '#a78bfa', marginLeft: '6px' }}>
                    @{effectiveBpm.toFixed(0)} BPM
                  </span>
                ) : (
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                    (128 BPM domyślnie)
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button
                onClick={() => handleSetBeatMatch(4)}
                style={{
                  flex: 1,
                  padding: '6px 4px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  background: activeBeatMode === 4 ? '#8b5cf6' : 'rgba(255, 255, 255, 0.06)',
                  color: '#fff',
                  border: '1px solid ' + (activeBeatMode === 4 ? '#a78bfa' : 'rgba(255, 255, 255, 0.1)'),
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                <div>{isPl ? '1 Takt (4 b)' : '1 Bar (4 b)'}</div>
                <div style={{ fontSize: '0.66rem', opacity: 0.85, marginTop: '2px' }}>
                  {(ms4 / 1000).toFixed(2)}s
                </div>
              </button>
              <button
                onClick={() => handleSetBeatMatch(8)}
                style={{
                  flex: 1,
                  padding: '6px 4px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  background: activeBeatMode === 8 ? '#8b5cf6' : 'rgba(255, 255, 255, 0.06)',
                  color: '#fff',
                  border: '1px solid ' + (activeBeatMode === 8 ? '#a78bfa' : 'rgba(255, 255, 255, 0.1)'),
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                <div>{isPl ? '2 Takty (8 b)' : '2 Bars (8 b)'}</div>
                <div style={{ fontSize: '0.66rem', opacity: 0.85, marginTop: '2px' }}>
                  {(ms8 / 1000).toFixed(2)}s
                </div>
              </button>
              <button
                onClick={() => handleSetBeatMatch(16)}
                style={{
                  flex: 1,
                  padding: '6px 4px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  background: activeBeatMode === 16 ? '#8b5cf6' : 'rgba(255, 255, 255, 0.06)',
                  color: '#fff',
                  border: '1px solid ' + (activeBeatMode === 16 ? '#a78bfa' : 'rgba(255, 255, 255, 0.1)'),
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                <div>{isPl ? '4 Takty (16 b)' : '4 Bars (16 b)'}</div>
                <div style={{ fontSize: '0.66rem', opacity: 0.85, marginTop: '2px' }}>
                  {(ms16 / 1000).toFixed(2)}s
                </div>
              </button>
              <button
                onClick={() => onSetCrossfadeDuration(0)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  background: crossfadeDurationMs === 0 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                  color: crossfadeDurationMs === 0 ? '#ef4444' : '#9ca3af',
                  border: '1px solid ' + (crossfadeDurationMs === 0 ? '#ef4444' : 'rgba(255, 255, 255, 0.1)'),
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                }}
                title={isPl ? 'Wyłącz crossfade' : 'Disable crossfade'}
              >
                <div>Off</div>
                <div style={{ fontSize: '0.66rem', opacity: 0.85, marginTop: '2px' }}>0s</div>
              </button>
            </div>
          </div>
        </div>

        {/* PASEK WYSZUKIWANIA I FILTRÓW */}
        <div
          style={{
            padding: '12px 24px',
            borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              flex: 1,
              minWidth: '220px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              padding: '6px 12px',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
            }}
          >
            <Search size={16} color="var(--text-muted, #9ca3af)" />
            <input
              type="text"
              placeholder={isPl ? 'Filtruj utwory z biblioteki...' : 'Filter tracks from library...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'inherit',
                fontSize: '0.85rem',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button
            onClick={() => setFilterOnlyInKey(!filterOnlyInKey)}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: filterOnlyInKey ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              color: filterOnlyInKey ? '#34d399' : '#9ca3af',
              border: '1px solid ' + (filterOnlyInKey ? '#10b981' : 'rgba(255, 255, 255, 0.1)'),
              cursor: 'pointer',
            }}
          >
            {filterOnlyInKey && <Check size={14} />} {isPl ? 'Tylko pasujące Camelot (≥80%)' : 'Compatible Camelot only (≥80%)'}
          </button>

          <button
            onClick={() => setFilterOnlyBpm(!filterOnlyBpm)}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: filterOnlyBpm ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              color: filterOnlyBpm ? '#60a5fa' : '#9ca3af',
              border: '1px solid ' + (filterOnlyBpm ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)'),
              cursor: 'pointer',
            }}
          >
            {filterOnlyBpm && <Check size={14} />} {isPl ? 'Zgodne tempo BPM (±6%)' : 'Compatible BPM (±6%)'}
          </button>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #9ca3af)', marginLeft: 'auto' }}>
            {isPl ? 'Znaleziono:' : 'Found:'} <strong>{rankedTracks.length}</strong> {isPl ? 'utworów' : 'tracks'}
          </div>
        </div>

        {/* LISTA KANDYDATÓW */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {rankedTracks.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: 'var(--text-muted, #9ca3af)',
              }}
            >
              <Disc3 size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <div>{isPl ? 'Brak pasujących utworów spełniających kryteria filtrów.' : 'No tracks found matching filter criteria.'}</div>
              <div style={{ fontSize: '0.8rem', marginTop: '6px' }}>
                {isPl
                  ? 'Spróbuj wyłączyć filtry restrykcyjne lub przeanalizować klucze w bibliotece.'
                  : 'Try relaxing strict filters or analyzing keys in your library.'}
              </div>
            </div>
          ) : (
            rankedTracks.slice(0, 50).map(({ track, match }) => {
              const candCamelot = parseCamelotKey(track.initial_key);
              return (
                <div
                  key={track.id}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)';
                    e.currentTarget.style.borderColor = match.badgeColor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                  }}
                >
                  {/* WSKAŹNIK DOPASOWANIA I PROCENT */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: '110px' }}>
                    <div
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '10px',
                        background: `${match.badgeColor}22`,
                        border: `2px solid ${match.badgeColor}`,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: match.badgeColor,
                        fontWeight: 800,
                        fontSize: '0.95rem',
                        lineHeight: 1.1,
                      }}
                    >
                      {match.score}%
                      <span style={{ fontSize: '0.6rem', fontWeight: 600 }}>MATCH</span>
                    </div>

                    <div>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: `${match.badgeColor}20`,
                          color: match.badgeColor,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                        }}
                      >
                        {match.badgeLabel}
                      </span>
                    </div>
                  </div>

                  {/* INFORMACJE O UTWORZE */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: '0.92rem',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {track.title}
                    </div>
                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-muted, #9ca3af)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {track.artist} {track.album ? `• ${track.album}` : ''}
                    </div>

                    {/* DANE CAMELOT & BPM */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: 'rgba(255, 255, 255, 0.06)',
                          color: candCamelot ? '#f472b6' : '#9ca3af',
                          fontWeight: 600,
                        }}
                      >
                        {candCamelot ? `${candCamelot.raw} (${candCamelot.keyName})` : 'Klucz ?'}
                      </span>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: 'rgba(255, 255, 255, 0.06)',
                          color: track.bpm ? '#60a5fa' : '#9ca3af',
                          fontWeight: 600,
                        }}
                      >
                        {track.bpm ? `${track.bpm.toFixed(1)} BPM` : 'BPM ?'}
                      </span>
                      {match.bpmDiffPercent > 0 && (
                        <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                          (Δ {match.bpmDiffPercent}%)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* PRZYCISKI AKCJI */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {track.bpm && effectiveBpm && Math.abs(track.bpm - effectiveBpm) > 0.5 && (
                      <button
                        onClick={() => onSyncTempo(track.bpm!)}
                        title={`Dopasuj tempo suwaka DSP do tempa tego utworu (${track.bpm.toFixed(1)} BPM)`}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          background: 'rgba(59, 130, 246, 0.15)',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          color: '#60a5fa',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Zap size={12} /> Sync BPM
                      </button>
                    )}

                    <button
                      onClick={() => onEnqueueTrack(track, true)}
                      title={isPl ? 'Kolejkuj jako następny utwór' : 'Enqueue as next track'}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: '#e5e7eb',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <ListPlus size={14} /> {isPl ? 'Następny' : 'Next'}
                    </button>

                    <button
                      onClick={() => onPlayTrack(track)}
                      title={isPl ? 'Odtwórz natychmiast z płynnym przenikaniem DJ Crossfade' : 'Play now with DJ Crossfade'}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                        border: 'none',
                        color: '#fff',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 8px rgba(236, 72, 153, 0.3)',
                      }}
                    >
                      <Play size={13} fill="#fff" /> Mix Now
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
