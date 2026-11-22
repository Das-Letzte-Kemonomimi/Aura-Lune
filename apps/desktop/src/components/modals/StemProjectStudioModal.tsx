import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Play,
  Pause,
} from 'lucide-react';
import { invoke } from '../../api/ipc';
import type {
  StemProject,
  StemChannel,
  StemProjectMix,
  StemProjectProgressPayload,
} from '../../types/analysis';
import { getTranslations, type Language } from '../../i18n';
import { useTauriEvent } from '../../hooks/useTauriEvent';
import { useLivePositionMs } from '../../state/livePlayback';
import { StemStudioWorkspace } from './stem-studio/StemStudioWorkspace';
import { StemStudioHeader } from './stem-studio/StemStudioHeader';
import { fmt } from '../../utils/fmt';

export interface StemProjectStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number | null;
  currentTimeMs?: number;
  durationMs?: number;
  isPlaying?: boolean;
  onPlayPause?: () => void;
  onSeek?: (positionMs: number) => void;
  onSetLoop?: (startMs: number, endMs: number) => void;
  onOpenPianoRoll?: () => void;
  onOpenChords?: () => void;
  currentLang?: Language;
}

export const StemProjectStudioModal: React.FC<StemProjectStudioModalProps> = (props) => {
  const {
    isOpen,
    onClose,
    projectId,
    currentTimeMs: currentTimeMsProp = 0,
    durationMs = 180000,
    isPlaying = false,
    onPlayPause,
    onSeek,
    onSetLoop: _onSetLoop,
    currentLang = 'en',
  } = props;
  // Pozycja/spektrum na żywo (livePlayback) — renderuje się ten komponent, nie cała aplikacja.
  const currentTimeMs = useLivePositionMs(currentTimeMsProp);
  const t = getTranslations(currentLang);
  const loc = t;
  const [project, setProject] = useState<StemProject | null>(null);
  const [channels, setChannels] = useState<StemChannel[]>([]);
  const [masterVolume, setMasterVolume] = useState<number>(1.0);
  const [mixes, setMixes] = useState<StemProjectMix[]>([]);
  const [activeMixName, setActiveMixName] = useState<string>('Default (0 dB)');
  const [_loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredChannelId, setHoveredChannelId] = useState<string | null>(null);
  const [newMixName, setNewMixName] = useState<string>('');
  const [isSavingMix, setIsSavingMix] = useState<boolean>(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [isOriginalMode, setIsOriginalMode] = useState<boolean>(false);
  const hasAutoLoadedRef = useRef(false);

  // Pobranie danych projektu
  const fetchProjectData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const p = await invoke<StemProject | null>('get_stem_project', { projectId });
      if (p) {
        setProject(p);
        setChannels(p.channels);
        const m = await invoke<StemProjectMix[]>('get_stem_project_mixes', { projectId });
        setMixes(m);
        if (p.active_mix_name) {
          setActiveMixName(p.active_mix_name);
        }
      }
    } catch (err: unknown) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    let active = true;
    if (isOpen && projectId) {
      queueMicrotask(() => {
        if (active) {
          void fetchProjectData();
        }
      });
    }
    return () => {
      active = false;
    };
  }, [isOpen, projectId, fetchProjectData]);

  // Nasłuchiwanie na postęp separacji projektu
  useTauriEvent<StemProjectProgressPayload>(
    'auralune://stem-project-progress',
    (payload) => {
      if (payload.project_id !== projectId) return;
      if (payload.status === 'ready') {
        fetchProjectData();
      } else {
        setProject((prev) => (prev ? { ...prev, progress: payload.progress } : null));
      }
    },
    isOpen && !!projectId,
  );

  // Synchronizacja miksu do potoku audio
  const applyMixToEngine = useCallback(
    async (updatedChannels: StemChannel[], masterVol: number) => {
      try {
        await invoke('apply_stem_project_mix', {
          channels: updatedChannels,
          masterVolume: masterVol,
        });
      } catch (err: unknown) {
        console.error('Błąd synchronizacji miksu:', err);
      }
    },
    []
  );

  // Przełączanie w czasie rzeczywistym na miks stemów
  const handleSwitchToStems = useCallback(
    async (startPlaying?: boolean) => {
      if (!projectId) return;
      try {
        await invoke('load_stem_project', {
          projectId,
          masterVolume,
          seekPositionMs: currentTimeMs,
          startPlaying: startPlaying ?? isPlaying,
        });
        setIsOriginalMode(false);
      } catch (err: unknown) {
        setError(fmt(loc.stems.errLoadStems, String(err)));
      }
    },
    [projectId, masterVolume, currentTimeMs, isPlaying, loc]
  );

  // Przełączanie w czasie rzeczywistym na oryginalny utwór (A/B)
  const handleSwitchToOriginal = useCallback(async () => {
    try {
      await invoke('restore_original_track');
      setIsOriginalMode(true);
    } catch (err: unknown) {
      setError(fmt(loc.stems.errRestoreTrack, String(err)));
    }
  }, [loc]);

  // Wróć do oryginalnego utworu i zamknij okno studia
  const handleReturnToOriginalAndClose = async () => {
    try {
      await invoke('restore_original_track');
    } catch (err: unknown) {
      console.warn('Błąd przywracania oryginalnego utworu:', err);
    }
    onClose();
  };

  // Zamknięcie okna studia (z bezpiecznym powrotem do oryginału)
  const handleClose = async () => {
    if (!isOriginalMode) {
      try {
        await invoke('restore_original_track');
      } catch {}
    }
    onClose();
  };

  // Automatyczny załadunek stemów na żywo (IRL) po otwarciu gotowego projektu
  useEffect(() => {
    if (isOpen && projectId && project?.status === 'ready' && !hasAutoLoadedRef.current) {
      hasAutoLoadedRef.current = true;
      handleSwitchToStems(isPlaying);
    }
    if (!isOpen) {
      hasAutoLoadedRef.current = false;
    }
  }, [isOpen, projectId, project?.status, handleSwitchToStems, isPlaying]);

  // Modyfikacja suwaka głośności pojedynczego kanału
  const handleVolumeChange = (channelId: string, newVolume: number) => {
    setChannels((prev) => {
      const updated = prev.map((ch) =>
        ch.id === channelId ? { ...ch, volume: newVolume } : ch
      );
      applyMixToEngine(updated, masterVolume);
      return updated;
    });
  };

  // Modyfikacja panoramy
  const handlePanChange = (channelId: string, newPan: number) => {
    setChannels((prev) => {
      const updated = prev.map((ch) =>
        ch.id === channelId ? { ...ch, pan: newPan } : ch
      );
      applyMixToEngine(updated, masterVolume);
      return updated;
    });
  };

  // Przełączenie Solo
  const handleToggleSolo = (channelId: string) => {
    setChannels((prev) => {
      const updated = prev.map((ch) =>
        ch.id === channelId ? { ...ch, solo: !ch.solo } : ch
      );
      applyMixToEngine(updated, masterVolume);
      return updated;
    });
  };

  // Przełączenie Mute
  const handleToggleMute = (channelId: string) => {
    setChannels((prev) => {
      const updated = prev.map((ch) =>
        ch.id === channelId ? { ...ch, mute: !ch.mute } : ch
      );
      applyMixToEngine(updated, masterVolume);
      return updated;
    });
  };

  // Reset do 75% (0 dB unity gain)
  const handleResetAllToUnity = () => {
    setChannels((prev) => {
      const updated = prev.map((ch) => ({
        ...ch,
        volume: 0.75,
        pan: 0.0,
        mute: false,
        solo: false,
      }));
      applyMixToEngine(updated, masterVolume);
      return updated;
    });
  };

  // Szybkie presety (Quick Presets)
  const handleApplyPreset = (presetType: string) => {
    setChannels((prev) => {
      const updated = prev.map((ch) => {
        let mute = false;
        let solo = false;
        let volume = 0.75;

        switch (presetType) {
          case 'karaoke':
            if (ch.id === 'lead_vocal' || ch.id === 'vocals') mute = true;
            break;
          case 'acapella':
            if (ch.id === 'lead_vocal' || ch.id === 'backing_vocals' || ch.id === 'vocals')
              solo = true;
            break;
          case 'drums_only':
            if (ch.parent_stem === 'drums' || ch.id === 'drums') solo = true;
            break;
          case 'rhythm_section':
            if (
              ch.parent_stem === 'drums' ||
              ch.id === 'drums' ||
              ch.id === 'bass'
            )
              solo = true;
            break;
          case 'instrumental':
            if (
              ch.id === 'lead_vocal' ||
              ch.id === 'backing_vocals' ||
              ch.id === 'vocals'
            )
              mute = true;
            break;
          case 'practice_guitar':
            if (
              ch.parent_stem === 'guitars' ||
              ch.id === 'guitar' ||
              ch.id === 'lead_guitar' ||
              ch.id === 'rhythm_guitar' ||
              ch.id === 'acoustic_guitar'
            )
              mute = true;
            break;
          default:
            break;
        }

        return { ...ch, volume, mute, solo };
      });

      applyMixToEngine(updated, masterVolume);
      return updated;
    });
  };

  // Zapis miksu jako preset
  const handleSaveMix = async () => {
    if (!projectId || !newMixName.trim()) return;
    try {
      const channelSettings: Record<string, any> = {};
      for (const ch of channels) {
        channelSettings[ch.id] = {
          volume: ch.volume,
          pan: ch.pan,
          mute: ch.mute,
          solo: ch.solo,
        };
      }

      const mixPayload: StemProjectMix = {
        project_id: projectId,
        name: newMixName.trim(),
        is_default: false,
        channels: channelSettings,
        master_volume: masterVolume,
        updated_at: new Date().toISOString(),
      };

      await invoke('save_stem_project_mix', { mix: mixPayload });
      setActiveMixName(newMixName.trim());
      setIsSavingMix(false);
      setNewMixName('');
      fetchProjectData();
    } catch (err: unknown) {
      setError(fmt(loc.stems.errSaveMix, String(err)));
    }
  };

  // Załadowanie zapisanego miksu
  const handleLoadMix = (mix: StemProjectMix) => {
    setActiveMixName(mix.name);
    setMasterVolume(mix.master_volume || 1.0);
    setChannels((prev) => {
      const updated = prev.map((ch) => {
        const setting = mix.channels[ch.id];
        if (setting) {
          return {
            ...ch,
            volume: setting.volume,
            pan: setting.pan,
            mute: setting.mute,
            solo: setting.solo,
          };
        }
        return ch;
      });
      applyMixToEngine(updated, mix.master_volume || 1.0);
      return updated;
    });
  };

  // Eksport całego projektu do ZIP
  const handleExportZip = async () => {
    if (!projectId || !project) return;
    try {
      const dest = await invoke<string | null>('pick_save_destination', {
        defaultName: `${project.title.replace(/\s+/g, '_')}_stems.zip`,
        extension: 'zip',
      });
      if (!dest) return;

      setExportNotice(loc.stems.creatingZip);
      await invoke('export_stem_project_zip', {
        projectId,
        exportPath: dest,
      });
      setExportNotice(fmt(loc.stems.exportedZipTo, dest));
      setTimeout(() => setExportNotice(null), 5000);
    } catch (err: unknown) {
      setError(fmt(loc.stems.errExportZip, String(err)));
    }
  };

  const handlersRef = useRef({ handleToggleMute, handleToggleSolo, handleVolumeChange });
  useEffect(() => {
    handlersRef.current = { handleToggleMute, handleToggleSolo, handleVolumeChange };
  });

  // Skróty klawiszowe (Mute, Solo, 0 dla resetu)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'KeyM' && hoveredChannelId) {
        e.preventDefault();
        handlersRef.current.handleToggleMute(hoveredChannelId);
      } else if (e.code === 'KeyS' && hoveredChannelId) {
        e.preventDefault();
        handlersRef.current.handleToggleSolo(hoveredChannelId);
      } else if (e.code === 'Digit0' && hoveredChannelId) {
        e.preventDefault();
        handlersRef.current.handleVolumeChange(hoveredChannelId, 0.75);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hoveredChannelId]);

  if (!isOpen) return null;

  const anySoloActive = channels.some((c) => c.solo);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(5, 5, 12, 0.92)',
        backdropFilter: 'blur(20px)',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
        animation: 'fadeInScale 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* 1. GÓRNY PASEK NARZĘDZIOWY (STUDIO HEADER) */}
      <StemStudioHeader {...props} project={project} loc={loc} channels={channels} handleSwitchToOriginal={handleSwitchToOriginal} t={t} isOriginalMode={isOriginalMode} handleSwitchToStems={handleSwitchToStems} handleReturnToOriginalAndClose={handleReturnToOriginalAndClose} activeMixName={activeMixName} mixes={mixes} handleLoadMix={handleLoadMix} handleResetAllToUnity={handleResetAllToUnity} setIsSavingMix={setIsSavingMix} handleExportZip={handleExportZip} handleClose={handleClose} />

      {exportNotice && (
        <div
          style={{
            padding: '8px 16px',
            background: 'rgba(52, 211, 153, 0.15)',
            border: '1px solid rgba(52, 211, 153, 0.3)',
            borderRadius: '10px',
            color: '#34d399',
            fontSize: '0.85rem',
            marginBottom: '10px',
          }}
        >
          {exportNotice}
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '8px 16px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '10px',
            color: '#f87171',
            fontSize: '0.85rem',
            marginBottom: '10px',
          }}
        >
          {error}
        </div>
      )}

      {/* 2. GŁÓWNY OBSZAR ROBOCZY: KANAŁY STEMÓW + PANEL MASTER */}
      <StemStudioWorkspace {...props} channels={channels} anySoloActive={anySoloActive} setHoveredChannelId={setHoveredChannelId} hoveredChannelId={hoveredChannelId} handleToggleSolo={handleToggleSolo} t={t} handleToggleMute={handleToggleMute} handlePanChange={handlePanChange} handleVolumeChange={handleVolumeChange} masterVolume={masterVolume} setMasterVolume={setMasterVolume} applyMixToEngine={applyMixToEngine} handleResetAllToUnity={handleResetAllToUnity} handleApplyPreset={handleApplyPreset} />

      {/* 3. DOLNA KONSOLA STEROWANIA ODTWARZANIEM (TRANSPORT BAR) */}
      <div
        style={{
          marginTop: '12px',
          padding: '12px 20px',
          background: 'rgba(255, 255, 255, 0.04)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={async () => {
              if (isOriginalMode) {
                onPlayPause?.();
              } else {
                if (!isPlaying) {
                  await handleSwitchToStems(true);
                  if (!isPlaying) onPlayPause?.();
                } else {
                  onPlayPause?.();
                }
              }
            }}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
              border: 'none',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(236, 72, 153, 0.4)',
            }}
          >
            {isPlaying ? <Pause size={18} fill="#ffffff" /> : <Play size={18} fill="#ffffff" style={{ marginLeft: '2px' }} />}
          </button>

          <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', color: '#f8fafc', fontWeight: 700 }}>
            {Math.floor(currentTimeMs / 60000)}:
            {Math.floor((currentTimeMs % 60000) / 1000)
              .toString()
              .padStart(2, '0')}
            {' / '}
            {Math.floor(durationMs / 60000)}:
            {Math.floor((durationMs % 60000) / 1000)
              .toString()
              .padStart(2, '0')}
          </span>
        </div>

        {/* Pasek postępu */}
        <div style={{ flex: 1, margin: '0 24px' }}>
          <input
            type="range"
            min="0"
            max={durationMs || 100}
            value={currentTimeMs}
            onChange={(e) => onSeek?.(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent-pink)' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.75rem', color: '#94a3b8' }}>
          <span>{t.stems.shortcutsHint}</span>
        </div>
      </div>

      {/* Modal zapisu miksu */}
      {isSavingMix && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10010,
          }}
        >
          <div
            style={{
              width: '360px',
              padding: '20px',
              borderRadius: '16px',
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
            }}
          >
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#f8fafc' }}>
              {t.stems.saveMixTitle}
            </h3>
            <input
              type="text"
              placeholder={t.stems.mixNamePlaceholder}
              value={newMixName}
              onChange={(e) => setNewMixName(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#f8fafc',
                marginBottom: '14px',
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setIsSavingMix(false)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#cbd5e1',
                  cursor: 'pointer',
                }}
              >
                {t.common.cancel}
              </button>
              <button
                onClick={handleSaveMix}
                disabled={!newMixName.trim()}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  background: 'var(--accent-pink)',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {t.common.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
