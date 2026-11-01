import React, { useState, useMemo } from 'react';
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
}) => {

  const [searchQuery, setSearchQuery] = useState('');
  const [filterOnlyInKey, setFilterOnlyInKey] = useState(false);
  const [filterOnlyBpm, setFilterOnlyBpm] = useState(false);
  const [beatMatchMode, setBeatMatchMode] = useState<4 | 8 | 16 | null>(8); // 8 beats = 2 bars
  const [isAnalyzingCurrent, setIsAnalyzingCurrent] = useState(false);
  const [analyzedCurrentKey, setAnalyzedCurrentKey] = useState<string | null>(null);
  const [analyzedCurrentBpm, setAnalyzedCurrentBpm] = useState<number | null>(null);

  const effectiveKey = analyzedCurrentKey || currentTrack?.initial_key || null;
  const effectiveBpm = analyzedCurrentBpm || currentTrack?.bpm || null;

  const currentCamelot = parseCamelotKey(effectiveKey);

  // Auto-dostrojenie crossfade do beatów utworu
  const handleSetBeatMatch = (beats: 4 | 8 | 16) => {
    setBeatMatchMode(beats);
    const bpm = effectiveBpm && effectiveBpm > 0 ? effectiveBpm : 128;
    const targetMs = calculateBeatMatchedCrossfadeMs(bpm, beats);
    onSetCrossfadeDuration(targetMs);
  };

  // Analiza klucza i BPM dla bieżącego utworu, jeśli nie ma w bazie
  const handleAnalyzeCurrent = async () => {
    if (!currentTrack) return;
    setIsAnalyzingCurrent(true);
    try {
      const res = await invoke<{
        bpm: number;
        key_name: string;
        camelot: string;
      }>('detect_track_key_bpm', {
        path: currentTrack.uri,
        trackId: currentTrack.id,
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

  // Ranking utworów z biblioteki
  const rankedTracks = useMemo(() => {
    if (!isOpen || !currentTrack) return [];

    const query = searchQuery.trim().toLowerCase();

    const candidates = libraryTracks
      .filter((t) => t.id !== currentTrack.id)
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
                Inteligentne miksowanie harmoniczne (Camelot Wheel) i płynne przejścia beat-matched
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
              <Music2 size={14} /> Aktualny utwór
            </div>
            <div style={{ fontWeight: 700, fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentTrack?.title || 'Brak aktywnego utworu'}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted, #9ca3af)', marginBottom: '10px' }}>
              {currentTrack?.artist || 'Wybierz utwór z biblioteki'}
            </div>

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
                <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>Klucz nieznany</span>
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
                <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>BPM nieznane</span>
              )}

              {(!effectiveKey || !effectiveBpm) && currentTrack && (
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
                  Wykryj teraz
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
                Płynne przenikanie dopasowane do tempa: <strong>{crossfadeDurationMs} ms</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button
                onClick={() => handleSetBeatMatch(4)}
                style={{
                  flex: 1,
                  padding: '6px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  background: beatMatchMode === 4 ? '#8b5cf6' : 'rgba(255, 255, 255, 0.06)',
                  color: '#fff',
                  border: '1px solid ' + (beatMatchMode === 4 ? '#a78bfa' : 'rgba(255, 255, 255, 0.1)'),
                  cursor: 'pointer',
                }}
              >
                1 Takt (4 b)
              </button>
              <button
                onClick={() => handleSetBeatMatch(8)}
                style={{
                  flex: 1,
                  padding: '6px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  background: beatMatchMode === 8 ? '#8b5cf6' : 'rgba(255, 255, 255, 0.06)',
                  color: '#fff',
                  border: '1px solid ' + (beatMatchMode === 8 ? '#a78bfa' : 'rgba(255, 255, 255, 0.1)'),
                  cursor: 'pointer',
                }}
              >
                2 Takty (8 b)
              </button>
              <button
                onClick={() => handleSetBeatMatch(16)}
                style={{
                  flex: 1,
                  padding: '6px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  background: beatMatchMode === 16 ? '#8b5cf6' : 'rgba(255, 255, 255, 0.06)',
                  color: '#fff',
                  border: '1px solid ' + (beatMatchMode === 16 ? '#a78bfa' : 'rgba(255, 255, 255, 0.1)'),
                  cursor: 'pointer',
                }}
              >
                4 Takty (16 b)
              </button>
              <button
                onClick={() => {
                  setBeatMatchMode(null);
                  onSetCrossfadeDuration(0);
                }}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  background: crossfadeDurationMs === 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                  color: crossfadeDurationMs === 0 ? '#ef4444' : '#9ca3af',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  cursor: 'pointer',
                }}
                title="Wyłącz crossfade"
              >
                Off
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
              placeholder="Filtruj utwory z biblioteki..."
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
            {filterOnlyInKey && <Check size={14} />} Tylko pasujące Camelot (≥80%)
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
            {filterOnlyBpm && <Check size={14} />} Zgodne tempo BPM (±6%)
          </button>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #9ca3af)', marginLeft: 'auto' }}>
            Znaleziono: <strong>{rankedTracks.length}</strong> utworów
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
              <div>Brak pasujących utworów spełniających kryteria filtrów.</div>
              <div style={{ fontSize: '0.8rem', marginTop: '6px' }}>
                Spróbuj wyłączyć filtry restrykcyjne lub przeanalizować klucze w bibliotece.
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
                      title="Kolejkuj jako następny utwór"
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
                      <ListPlus size={14} /> Następny
                    </button>

                    <button
                      onClick={() => onPlayTrack(track)}
                      title="Odtwórz natychmiast z płynnym przenikaniem DJ Crossfade"
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
