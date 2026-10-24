import React, { useState, useEffect } from 'react';
import {
  X,
  Flame,
  Clock,
  Music,
  User,
  Sparkles,
  Trophy,
  Play,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import type { Language } from '../i18n';
import { getTranslations } from '../i18n';

interface TopTrackDto {
  id: number;
  title: string;
  artist: string;
  album?: string;
  play_count: number;
  total_time_ms: number;
}

interface TopArtistDto {
  artist: string;
  play_count: number;
  total_time_ms: number;
}

interface RecapSummaryDto {
  period: string;
  total_listening_seconds: number;
  total_tracks_played: number;
  top_tracks: TopTrackDto[];
  top_artists: TopArtistDto[];
}

interface AuraluneRecapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayTrackId?: (id: number) => void;
  currentLang: Language;
}

type Period = 'week' | 'month' | 'year' | 'all';

export const AuraluneRecapModal: React.FC<AuraluneRecapModalProps> = ({
  isOpen,
  onClose,
  onPlayTrackId,
  currentLang,
}) => {
  const [period, setPeriod] = useState<Period>('month');
  const [loading, setLoading] = useState<boolean>(true);
  const [recapData, setRecapData] = useState<RecapSummaryDto | null>(null);

  const loc = getTranslations(currentLang);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);

    invoke<RecapSummaryDto>('get_recap_summary', { period })
      .then((data) => {
        if (isMounted) {
          setRecapData(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Błąd pobierania Auralune Recap:', err);
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, period]);

  if (!isOpen) return null;

  const formatHoursMins = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins} min`;
  };

  const formatTrackMs = (ms: number) => {
    const sec = Math.floor(ms / 1000);
    const mins = Math.floor(sec / 60);
    const remSec = sec % 60;
    return `${mins}:${remSec < 10 ? '0' : ''}${remSec}`;
  };

  const periodLabels: Record<Period, { pl: string; en: string }> = {
    week: { pl: 'Ten tydzień', en: 'This Week' },
    month: { pl: 'Ten miesiąc', en: 'This Month' },
    year: { pl: 'Ten rok', en: 'This Year' },
    all: { pl: 'Cały czas', en: 'All-Time' },
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(5, 7, 14, 0.88)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          background: 'rgba(18, 20, 32, 0.95)',
          border: '1px solid rgba(244, 63, 94, 0.35)',
          borderRadius: '24px',
          padding: '28px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.8), 0 0 40px rgba(244, 63, 94, 0.15)',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          overflowY: 'auto',
          animation: 'modalFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nagłówek i przełącznik okresów */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.3), rgba(168, 85, 247, 0.3))',
                border: '1px solid rgba(244, 63, 94, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Flame size={24} color="var(--accent-pink, #f43f5e)" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                  Auralune Recap
                </h2>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: 'rgba(244, 63, 94, 0.2)',
                    color: 'var(--accent-pink)',
                    border: '1px solid rgba(244, 63, 94, 0.4)',
                  }}
                >
                  WRAPPED
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {currentLang === 'pl'
                  ? 'Twoje osobiste podsumowanie muzyczne'
                  : 'Your personalized musical rewind & statistics'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Przyciski filtrów okresów */}
            <div
              style={{
                display: 'flex',
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '3px',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {(['week', 'month', 'year', 'all'] as Period[]).map((p) => {
                const isSelected = period === p;
                return (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '8px',
                      fontSize: '0.74rem',
                      fontWeight: isSelected ? 700 : 500,
                      background: isSelected ? 'var(--accent-pink, #f43f5e)' : 'transparent',
                      color: isSelected ? '#fff' : 'var(--text-secondary)',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {currentLang === 'pl' ? periodLabels[p].pl : periodLabels[p].en}
                  </button>
                );
              })}
            </div>

            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                padding: '8px',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Zawartość Recap */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <Sparkles size={28} className="animate-spin" style={{ margin: '0 auto 12px' }} />
            <div>{currentLang === 'pl' ? 'Generowanie podsumowania...' : 'Generating your musical rewind...'}</div>
          </div>
        ) : !recapData || recapData.total_listening_seconds === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '48px 20px',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '16px',
              border: '1px dashed var(--border-subtle)',
            }}
          >
            <Music size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1rem', fontWeight: 700 }}>
              {currentLang === 'pl' ? 'Brak zarejestrowanych odsłuchań' : 'No listening history yet'}
            </h3>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '420px', marginInline: 'auto' }}>
              {currentLang === 'pl'
                ? 'Włącz swoje ulubione utwory w Auralune, a aplikacja automatycznie stworzy dla Ciebie zestawienia tygodniowe, miesięczne i roczne!'
                : 'Play some tunes in Auralune and your weekly, monthly, and yearly stats will appear here automatically!'}
            </p>
          </div>
        ) : (
          <>
            {/* Główne kafelki liczników */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              {/* Łączny czas */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.15), rgba(168, 85, 247, 0.1))',
                  border: '1px solid rgba(244, 63, 94, 0.35)',
                  borderRadius: '16px',
                  padding: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '14px',
                    background: 'rgba(244, 63, 94, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Clock size={24} color="var(--accent-pink, #f43f5e)" />
                </div>
                <div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {currentLang === 'pl' ? 'CZAS SŁUCHANIA' : 'TOTAL TIME SPENT'}
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
                    {formatHoursMins(recapData.total_listening_seconds)}
                  </div>
                </div>
              </div>

              {/* Odsłuchane utwory */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(59, 130, 246, 0.1))',
                  border: '1px solid rgba(6, 182, 212, 0.35)',
                  borderRadius: '16px',
                  padding: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '14px',
                    background: 'rgba(6, 182, 212, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Music size={24} color="var(--accent-cyan, #06b6d4)" />
                </div>
                <div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {currentLang === 'pl' ? 'ODTWÓRZONE UTWORY' : 'TRACKS PLAYED'}
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
                    {recapData.total_tracks_played}
                  </div>
                </div>
              </div>
            </div>

            {/* Ranking Top Utworów */}
            {recapData.top_tracks.length > 0 && (
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '16px',
                  padding: '18px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <Trophy size={18} color="var(--accent-amber, #f59e0b)" />
                  <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>
                    {currentLang === 'pl' ? 'Najczęściej odtwarzane utwory' : 'Your Top Tracks'}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {recapData.top_tracks.map((track, index) => {
                    const isTop1 = index === 0;
                    return (
                      <div
                        key={track.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: '12px',
                          background: isTop1
                            ? 'linear-gradient(90deg, rgba(244, 63, 94, 0.18), rgba(255, 255, 255, 0.03))'
                            : 'rgba(255, 255, 255, 0.02)',
                          border: isTop1
                            ? '1px solid rgba(244, 63, 94, 0.35)'
                            : '1px solid transparent',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                          <span
                            style={{
                              fontSize: '0.9rem',
                              fontWeight: 800,
                              color: isTop1
                                ? 'var(--accent-amber, #f59e0b)'
                                : 'var(--text-muted)',
                              width: '20px',
                              textAlign: 'center',
                            }}
                          >
                            #{index + 1}
                          </span>

                          <div style={{ overflow: 'hidden' }}>
                            <div
                              style={{
                                fontSize: '0.86rem',
                                fontWeight: 700,
                                color: '#fff',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {track.title}
                            </div>
                            <div
                              style={{
                                fontSize: '0.76rem',
                                color: 'var(--text-secondary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {track.artist}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                              {track.play_count} {currentLang === 'pl' ? 'odtw.' : 'plays'}
                            </div>
                            {track.total_time_ms > 0 && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                {formatTrackMs(track.total_time_ms)}
                              </div>
                            )}
                          </div>

                          {onPlayTrackId && (
                            <button
                              onClick={() => onPlayTrackId(track.id)}
                              style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '50%',
                                background: 'rgba(244, 63, 94, 0.25)',
                                border: '1px solid rgba(244, 63, 94, 0.4)',
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                              }}
                            >
                              <Play size={12} style={{ marginLeft: '2px' }} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Ranking Top Wykonawców */}
            {recapData.top_artists.length > 0 && (
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '16px',
                  padding: '18px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <User size={18} color="var(--accent-purple, #a855f7)" />
                  <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>
                    {currentLang === 'pl' ? 'Ulubieni wykonawcy' : 'Top Artists'}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {recapData.top_artists.map((artist, idx) => (
                    <div
                      key={artist.artist}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '12px',
                        background: 'rgba(168, 85, 247, 0.12)',
                        border: '1px solid rgba(168, 85, 247, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-purple)' }}>
                        #{idx + 1}
                      </span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>
                        {artist.artist}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        ({artist.play_count} {currentLang === 'pl' ? 'odtw.' : 'plays'})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Stopka */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 22px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid var(--border-subtle)',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {loc.common?.close || 'Zamknij'}
          </button>
        </div>
      </div>
    </div>
  );
};
