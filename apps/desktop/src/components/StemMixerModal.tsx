import React, { useState, useEffect } from 'react';
import {
  Layers,
  Mic,
  Disc,
  Radio,
  Sliders,
  Sparkles,
  X,
  Play,
  RotateCcw,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { StemSeparationData, StemMixerState } from '../types/analysis';

export interface StemMixerModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackId?: number;
  trackPath?: string;
  trackTitle?: string;
  embedded?: boolean;
}

interface StemProgressPayload {
  track_id: number;
  progress: number;
  message: string;
}

export const StemMixerModal: React.FC<StemMixerModalProps> = ({
  isOpen,
  onClose,
  trackId,
  trackPath,
  trackTitle = 'Utwór',
  embedded = false,
}) => {
  const [stems, setStems] = useState<StemSeparationData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [progressVal, setProgressVal] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const [mixerState, setMixerState] = useState<StemMixerState>({
    enabled: false,
    vocals_volume: 1.0,
    drums_volume: 1.0,
    bass_volume: 1.0,
    other_volume: 1.0,
    piano_volume: 1.0,
    guitar_volume: 1.0,
    vocals_mute: false,
    drums_mute: false,
    bass_mute: false,
    other_mute: false,
    piano_mute: false,
    guitar_mute: false,
    solo_stem: undefined,
    karaoke_mode: false,
  });

  // Nasłuchiwanie postępu separacji ze zdarzeń Tauri
  useEffect(() => {
    const unlistenPromise = listen<StemProgressPayload>('auralune://stem-progress', (event) => {
      if (trackId && event.payload.track_id === trackId) {
        setProgressVal(event.payload.progress);
        setProgressMsg(event.payload.message);
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [trackId]);

  // Sprawdzenie czy stemy dla utworu już istnieją
  useEffect(() => {
    if (!isOpen || !trackId) return;

    let isMounted = true;
    const fetchStems = async () => {
      setError(null);
      try {
        const cached = await invoke<StemSeparationData | null>('get_track_stems', { trackId });
        if (cached && isMounted) {
          setStems(cached);
        }

        const curMixer = await invoke<StemMixerState>('get_stem_mixer_state');
        if (curMixer && isMounted) {
          setMixerState(curMixer);
        }
      } catch (err) {
        if (isMounted) setError(String(err));
      }
    };

    fetchStems();
    return () => {
      isMounted = false;
    };
  }, [isOpen, trackId]);

  if (!isOpen) return null;

  const handleStartSeparation = async () => {
    if (!trackId || !trackPath) return;
    setLoading(true);
    setError(null);
    setProgressVal(0.05);
    setProgressMsg('Inicjalizacja separacji STFT HPSS...');

    try {
      const res = await invoke<StemSeparationData>('start_stem_separation', {
        path: trackPath,
        trackId,
        modelId: 'htdemucs_v4',
      });
      setStems(res);
      setProgressVal(1.0);
      setProgressMsg('Separacja zakończona sukcesem!');
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleLoadStemsToPlayer = async () => {
    if (!trackId) return;
    try {
      const loaded = await invoke<StemMixerState>('load_track_stems', { trackId });
      setMixerState(loaded);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleRestoreOriginalTrack = async () => {
    try {
      await invoke('restore_original_track');
      setMixerState((prev) => ({ ...prev, enabled: false }));
    } catch (err) {
      console.error('Błąd przywracania oryginalnego utworu:', err);
    }
  };

  const updateMixer = async (newMixer: StemMixerState) => {
    setMixerState(newMixer);
    try {
      await invoke('set_stem_mixer_state', { statePayload: newMixer });
    } catch (err) {
      console.error('Błąd aktualizacji miksera:', err);
    }
  };

  const toggleSolo = (stem: string) => {
    const newSolo = mixerState.solo_stem === stem ? undefined : stem;
    updateMixer({ ...mixerState, solo_stem: newSolo });
  };

  const toggleKaraoke = () => {
    updateMixer({ ...mixerState, karaoke_mode: !mixerState.karaoke_mode });
  };

  const stemList: Array<{
    id: string;
    label: string;
    icon: React.ReactNode;
    color: string;
    volume: number;
    mute: boolean;
    setVolume: (val: number) => void;
    toggleMute: () => void;
  }> = [
      {
        id: 'vocals',
        label: 'Wokal (Vocals)',
        icon: <Mic size={16} />,
        color: '#ec4899',
        volume: mixerState.vocals_volume,
        mute: mixerState.vocals_mute || mixerState.karaoke_mode,
        setVolume: (v) => updateMixer({ ...mixerState, vocals_volume: v }),
        toggleMute: () => updateMixer({ ...mixerState, vocals_mute: !mixerState.vocals_mute }),
      },
      {
        id: 'drums',
        label: 'Perkusja (Drums)',
        icon: <Disc size={16} />,
        color: '#f59e0b',
        volume: mixerState.drums_volume,
        mute: mixerState.drums_mute,
        setVolume: (v) => updateMixer({ ...mixerState, drums_volume: v }),
        toggleMute: () => updateMixer({ ...mixerState, drums_mute: !mixerState.drums_mute }),
      },
      {
        id: 'bass',
        label: 'Bas (Bass)',
        icon: <Radio size={16} />,
        color: '#06b6d4',
        volume: mixerState.bass_volume,
        mute: mixerState.bass_mute,
        setVolume: (v) => updateMixer({ ...mixerState, bass_volume: v }),
        toggleMute: () => updateMixer({ ...mixerState, bass_mute: !mixerState.bass_mute }),
      },
      {
        id: 'other',
        label: 'Pozostałe (Other)',
        icon: <Sliders size={16} />,
        color: '#a855f7',
        volume: mixerState.other_volume,
        mute: mixerState.other_mute,
        setVolume: (v) => updateMixer({ ...mixerState, other_volume: v }),
        toggleMute: () => updateMixer({ ...mixerState, other_mute: !mixerState.other_mute }),
      },
    ];

  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
      {/* Pasek stanu i szybkich akcji */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          background: 'rgba(255, 255, 255, 0.04)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '0.75rem',
              padding: '4px 10px',
              borderRadius: '20px',
              background: 'rgba(6, 182, 212, 0.15)',
              border: '1px solid rgba(6, 182, 212, 0.35)',
              color: '#38bdf8',
              fontWeight: 700,
            }}
          >
            ⚡ Spektralna Separacja STFT HPSS & Azimuth
          </span>
          {mixerState.enabled && (
            <span
              style={{
                fontSize: '0.75rem',
                padding: '4px 10px',
                borderRadius: '20px',
                background: 'rgba(16, 185, 129, 0.2)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                color: '#34d399',
                fontWeight: 700,
              }}
            >
              ● AKTYWNY W TORZE AUDIO
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={toggleKaraoke}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '10px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.18s ease',
              border: mixerState.karaoke_mode
                ? '1px solid #ec4899'
                : '1px solid rgba(255, 255, 255, 0.15)',
              background: mixerState.karaoke_mode ? '#ec4899' : 'rgba(255, 255, 255, 0.05)',
              color: '#ffffff',
              boxShadow: mixerState.karaoke_mode ? '0 0 15px rgba(236, 72, 153, 0.4)' : 'none',
            }}
          >
            <Mic size={14} />
            <span>Tryb Karaoke (Wycisz wokal)</span>
          </button>

          {!mixerState.enabled ? (
            <button
              onClick={handleLoadStemsToPlayer}
              disabled={!stems}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '10px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: stems ? 'pointer' : 'not-allowed',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#6ee7b7',
                opacity: stems ? 1 : 0.5,
              }}
            >
              <Play size={14} />
              <span>Włącz stemy w odtwarzaczu</span>
            </button>
          ) : (
            <button
              onClick={handleRestoreOriginalTrack}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '10px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: '1px solid rgba(6, 182, 212, 0.4)',
                background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.25), rgba(168, 85, 247, 0.25))',
                color: '#67e8f9',
                boxShadow: '0 0 14px rgba(6, 182, 212, 0.3)',
              }}
              title="Przywróć natychmiastowe odtwarzanie oryginalnego pliku audio"
            >
              <RotateCcw size={14} />
              <span>Wróć do oryginalnego utworu</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '12px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            fontSize: '0.82rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Jeśli stemy nie są jeszcze rozdzielone */}
      {!stems ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 24px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            textAlign: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(236, 72, 153, 0.2))',
              border: '1px solid rgba(6, 182, 212, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8',
            }}
          >
            <Sliders size={32} />
          </div>

          <div style={{ maxWidth: '480px' }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc' }}>
              Rozdziel utwór na niezależne instrumenty
            </h3>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.5 }}>
              Wydobądź wokal, perkusję, bas oraz instrumenty harmoniczne z zachowaniem pełnego pasma stereo 44.1 kHz.
              Możesz wyciszać wokal (Karaoke), badać pojedyncze instrumenty w trybie solo oraz płynnie zmieniać proporcje głośności.
            </p>
          </div>

          {loading ? (
            <div style={{ width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div
                style={{
                  width: '100%',
                  height: '8px',
                  borderRadius: '4px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.round(progressVal * 100)}%`,
                    background: 'linear-gradient(90deg, #06b6d4, #ec4899)',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#cbd5e1', fontFamily: 'var(--font-mono)' }}>
                {progressMsg} ({(progressVal * 100).toFixed(0)}%)
              </p>
            </div>
          ) : (
            <button
              onClick={handleStartSeparation}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #06b6d4, #ec4899)',
                border: 'none',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(6, 182, 212, 0.35)',
                transition: 'transform 0.15s ease',
              }}
            >
              <Sparkles size={18} />
              <span>Rozpocznij separację ścieżek (STFT HPSS)</span>
            </button>
          )}
        </div>
      ) : (
        /* Siatka 4 stemów */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          {stemList.map((stem) => {
            const isSolo = mixerState.solo_stem === stem.id;
            return (
              <div
                key={stem.id}
                style={{
                  padding: '16px',
                  borderRadius: '16px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: isSolo
                    ? '1px solid #f59e0b'
                    : stem.mute
                      ? '1px solid rgba(239, 68, 68, 0.3)'
                      : '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  transition: 'all 0.15s ease',
                }}
              >
                {/* Tytuł i przyciski Solo/Mute */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: stem.color, display: 'flex', alignItems: 'center' }}>
                      {stem.icon}
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>
                      {stem.label}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      onClick={() => toggleSolo(stem.id)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        border: isSolo ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.12)',
                        background: isSolo ? '#f59e0b' : 'rgba(255, 255, 255, 0.05)',
                        color: isSolo ? '#0f172a' : '#94a3b8',
                      }}
                    >
                      SOLO
                    </button>
                    <button
                      onClick={stem.toggleMute}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        border: stem.mute
                          ? '1px solid rgba(239, 68, 68, 0.5)'
                          : '1px solid rgba(255, 255, 255, 0.12)',
                        background: stem.mute ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                        color: stem.mute ? '#fca5a5' : '#94a3b8',
                      }}
                    >
                      MUTE
                    </button>
                  </div>
                </div>

                {/* Suwak głośności i wartość procentowa */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    value={stem.volume}
                    onChange={(e) => stem.setVolume(parseFloat(e.target.value))}
                    style={{
                      flex: 1,
                      accentColor: stem.color,
                      height: '6px',
                      cursor: 'pointer',
                    }}
                  />
                  <span
                    style={{
                      width: '42px',
                      textAlign: 'right',
                      fontSize: '0.78rem',
                      fontFamily: 'var(--font-mono)',
                      color: stem.mute ? '#64748b' : '#f8fafc',
                      fontWeight: 600,
                    }}
                  >
                    {Math.round(stem.volume * 100)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(5, 5, 12, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '720px',
          background: 'linear-gradient(145deg, rgba(18, 20, 36, 0.98), rgba(10, 12, 24, 0.99))',
          borderRadius: '24px',
          border: '1px solid rgba(6, 182, 212, 0.35)',
          boxShadow: '0 25px 65px rgba(0, 0, 0, 0.9), 0 0 35px rgba(6, 182, 212, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px',
          overflow: 'hidden',
          color: '#f8fafc',
          animation: 'fadeInScale 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            paddingBottom: '16px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                background: 'rgba(6, 182, 212, 0.2)',
                border: '1px solid rgba(6, 182, 212, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
              }}
            >
              <Layers size={20} />
            </div>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  background: 'linear-gradient(90deg, #06b6d4, #ec4899)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Mikser Stemów (Separacja Ścieżek)
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>{trackTitle}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {content}
      </div>
    </div>
  );
};
