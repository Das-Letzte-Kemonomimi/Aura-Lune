import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  Save,
  Sparkles,
  X,
  Sliders,
  Music,
  Piano,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type {
  StemProject,
  StemChannel,
  StemProjectMix,
  StemProjectProgressPayload,
} from '../../types/analysis';
import { sliderToDb } from '../../types/analysis';

interface StemProjectStudioModalProps {
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
}

export const StemProjectStudioModal: React.FC<StemProjectStudioModalProps> = ({
  isOpen,
  onClose,
  projectId,
  currentTimeMs = 0,
  durationMs = 180000,
  isPlaying = false,
  onPlayPause,
  onSeek,
  onSetLoop: _onSetLoop,
  onOpenPianoRoll,
  onOpenChords,
}) => {
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
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isOpen && projectId) {
      fetchProjectData();
    }
  }, [isOpen, projectId, fetchProjectData]);

  // Nasłuchiwanie na postęp separacji projektu
  useEffect(() => {
    if (!isOpen || !projectId) return;

    let unlisten: (() => void) | undefined;
    listen<StemProjectProgressPayload>('auralune://stem-project-progress', (event) => {
      if (event.payload.project_id === projectId) {
        if (event.payload.status === 'ready') {
          fetchProjectData();
        } else {
          setProject((prev) =>
            prev ? { ...prev, progress: event.payload.progress } : null
          );
        }
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [isOpen, projectId, fetchProjectData]);

  // Synchronizacja miksu do potoku audio
  const applyMixToEngine = useCallback(
    async (updatedChannels: StemChannel[], masterVol: number) => {
      try {
        await invoke('apply_stem_project_mix', {
          channels: updatedChannels,
          masterVolume: masterVol,
        });
      } catch (err: any) {
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
      } catch (err: any) {
        setError(`Błąd załadowania stemów na żywo: ${err}`);
      }
    },
    [projectId, masterVolume, currentTimeMs, isPlaying]
  );

  // Przełączanie w czasie rzeczywistym na oryginalny utwór (A/B)
  const handleSwitchToOriginal = useCallback(async () => {
    try {
      await invoke('restore_original_track');
      setIsOriginalMode(true);
    } catch (err: any) {
      setError(`Błąd przywracania oryginalnego utworu: ${err}`);
    }
  }, []);

  // Wróć do oryginalnego utworu i zamknij okno studia
  const handleReturnToOriginalAndClose = async () => {
    try {
      await invoke('restore_original_track');
    } catch (err: any) {
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
    } catch (err: any) {
      setError(`Błąd zapisu miksu: ${err}`);
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

      setExportNotice('Tworzenie archiwum ZIP...');
      await invoke('export_stem_project_zip', {
        projectId,
        exportPath: dest,
      });
      setExportNotice(`Projekt wyeksportowano do: ${dest}`);
      setTimeout(() => setExportNotice(null), 5000);
    } catch (err: any) {
      setError(`Błąd eksportu ZIP: ${err}`);
    }
  };

  // Skróty klawiszowe (Mute, Solo, 0 dla resetu)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'KeyM' && hoveredChannelId) {
        e.preventDefault();
        handleToggleMute(hoveredChannelId);
      } else if (e.code === 'KeyS' && hoveredChannelId) {
        e.preventDefault();
        handleToggleSolo(hoveredChannelId);
      } else if (e.code === 'Digit0' && hoveredChannelId) {
        e.preventDefault();
        handleVolumeChange(hoveredChannelId, 0.75);
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          background: 'rgba(255, 255, 255, 0.04)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          marginBottom: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 15px rgba(236, 72, 153, 0.4)',
            }}
          >
            <Sliders size={22} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc' }}>
                {project ? project.title : 'Ładowanie projektu...'}
              </h2>
              {project?.status === 'separating' && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: 'rgba(245, 158, 11, 0.2)',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    color: '#f59e0b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Sparkles size={12} className="animate-spin" />
                  Separacja w toku ({Math.round(project.progress * 100)}%)
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
              {project?.artist} • {project?.album} • {channels.length} ścieżek instrumentów
            </p>
          </div>
        </div>

        {/* Zarządzanie miksami, odsłuch na żywo A/B i powrót do utworu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Przełącznik odsłuchu na żywo (A/B Live Comparison) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(0, 0, 0, 0.45)',
              borderRadius: '12px',
              padding: '3px',
              border: '1px solid rgba(255, 255, 255, 0.14)',
            }}
          >
            <button
              onClick={handleSwitchToOriginal}
              title="Przełącz na oryginalny utwór (Master)"
              style={{
                padding: '6px 13px',
                borderRadius: '9px',
                background: isOriginalMode ? 'linear-gradient(135deg, #06b6d4, #3b82f6)' : 'transparent',
                color: isOriginalMode ? '#ffffff' : '#94a3b8',
                fontWeight: 700,
                fontSize: '0.78rem',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: isOriginalMode ? '0 2px 8px rgba(6, 182, 212, 0.4)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <Music size={13} />
              Oryginał (Master)
            </button>
            <button
              onClick={() => handleSwitchToStems()}
              title="Przełącz na odsłuch miksu stemów na żywo"
              style={{
                padding: '6px 13px',
                borderRadius: '9px',
                background: !isOriginalMode ? 'linear-gradient(135deg, #ec4899, #8b5cf6)' : 'transparent',
                color: !isOriginalMode ? '#ffffff' : '#94a3b8',
                fontWeight: 700,
                fontSize: '0.78rem',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: !isOriginalMode ? '0 2px 8px rgba(236, 72, 153, 0.4)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <Sliders size={13} />
              Miks stemów (Na żywo)
            </button>
          </div>

          {/* Przycisk powrotu do oryginalnego utworu i zamknięcia studia */}
          <button
            onClick={handleReturnToOriginalAndClose}
            title="Przywróć oryginalny utwór i wyjdź ze studia stemów"
            style={{
              padding: '7px 14px',
              borderRadius: '10px',
              background: 'rgba(6, 182, 212, 0.15)',
              border: '1px solid rgba(6, 182, 212, 0.4)',
              color: 'var(--accent-cyan)',
              fontWeight: 700,
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <RotateCcw size={14} />
            Wróć do utworu
          </button>

          {/* Selektor miksu */}
          <select
            value={activeMixName}
            onChange={(e) => {
              const selected = mixes.find((m) => m.name === e.target.value);
              if (selected) handleLoadMix(selected);
              else if (e.target.value === 'Default (0 dB)') handleResetAllToUnity();
            }}
            style={{
              padding: '8px 12px',
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '10px',
              color: '#f8fafc',
              fontSize: '0.8rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="Default (0 dB)">Miks Domyślny (0 dB)</option>
            {mixes.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => setIsSavingMix(true)}
            title="Zapisz bieżący miks jako preset"
            style={{
              padding: '8px 12px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#cbd5e1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.8rem',
            }}
          >
            <Save size={14} />
            Zapisz miks
          </button>

          <button
            onClick={handleExportZip}
            title="Eksportuj cały projekt do spakowanego archiwum ZIP"
            style={{
              padding: '8px 12px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#cbd5e1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.8rem',
            }}
          >
            <Download size={14} />
            Eksport ZIP
          </button>

          <button
            onClick={handleClose}
            title="Zamknij studio i wróć do utworu"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '50%',
              display: 'flex',
            }}
          >
            <X size={20} />
          </button>
        </div>
      </div>

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
      <div style={{ flex: 1, display: 'flex', gap: '14px', minHeight: 0 }}>
        {/* Kontener suwaków kanałów (z przewijaniem poziomym) */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            gap: '12px',
            overflowX: 'auto',
            paddingBottom: '8px',
            minHeight: 0,
          }}
        >
          {channels.map((ch) => {
            const isMuted = ch.mute || (anySoloActive && !ch.solo);
            const dbVal = sliderToDb(ch.volume);

            return (
              <div
                key={ch.id}
                onMouseEnter={() => setHoveredChannelId(ch.id)}
                onMouseLeave={() => setHoveredChannelId(null)}
                style={{
                  width: '130px',
                  minWidth: '130px',
                  background: 'rgba(15, 23, 42, 0.65)',
                  borderRadius: '16px',
                  border:
                    hoveredChannelId === ch.id
                      ? `1px solid ${ch.color_hex}`
                      : '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '12px 10px',
                  boxShadow:
                    hoveredChannelId === ch.id
                      ? `0 0 15px ${ch.color_hex}33`
                      : '0 4px 12px rgba(0,0,0,0.3)',
                  transition: 'border 0.2s ease, box-shadow 0.2s ease',
                }}
              >
                {/* Nagłówek kanału */}
                <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                  <div
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: ch.color_hex,
                      margin: '0 auto 4px auto',
                      boxShadow: `0 0 8px ${ch.color_hex}`,
                    }}
                  />
                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: isMuted ? '#64748b' : '#f8fafc',
                      display: 'block',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={ch.name}
                  >
                    {ch.name}
                  </span>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      color: '#94a3b8',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                    }}
                  >
                    {ch.quality_tier}
                  </span>
                </div>

                {/* Przyciski Solo i Mute */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                  <button
                    onClick={() => handleToggleSolo(ch.id)}
                    style={{
                      flex: 1,
                      padding: '4px 0',
                      borderRadius: '6px',
                      border: ch.solo ? '1px solid #facc15' : '1px solid rgba(255,255,255,0.1)',
                      background: ch.solo ? '#facc15' : 'rgba(255,255,255,0.04)',
                      color: ch.solo ? '#000000' : '#cbd5e1',
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                    title="Solo (skrót S)"
                  >
                    S
                  </button>
                  <button
                    onClick={() => handleToggleMute(ch.id)}
                    style={{
                      flex: 1,
                      padding: '4px 0',
                      borderRadius: '6px',
                      border: ch.mute ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)',
                      background: ch.mute ? '#ef4444' : 'rgba(255,255,255,0.04)',
                      color: ch.mute ? '#ffffff' : '#cbd5e1',
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                    title="Mute (skrót M)"
                  >
                    M
                  </button>
                </div>

                {/* Suwak Panoramy (Pan) */}
                <div style={{ marginBottom: '10px' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.65rem',
                      color: '#94a3b8',
                      marginBottom: '2px',
                    }}
                  >
                    <span>L</span>
                    <span
                      style={{ cursor: 'pointer' }}
                      onClick={() => handlePanChange(ch.id, 0.0)}
                      title="Kliknij dwukrotnie, aby zresetować do centrum"
                    >
                      {ch.pan === 0
                        ? 'C'
                        : ch.pan < 0
                        ? `${Math.round(Math.abs(ch.pan) * 100)}L`
                        : `${Math.round(ch.pan * 100)}R`}
                    </span>
                    <span>R</span>
                  </div>
                  <input
                    type="range"
                    min="-1.0"
                    max="1.0"
                    step="0.05"
                    value={ch.pan}
                    onChange={(e) => handlePanChange(ch.id, parseFloat(e.target.value))}
                    style={{ width: '100%', accentColor: ch.color_hex }}
                  />
                </div>

                {/* Suwak Fader Głośności (0 - 100%, 75% = 0 dB) */}
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                  }}
                >
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.01"
                    value={ch.volume}
                    onChange={(e) => handleVolumeChange(ch.id, parseFloat(e.target.value))}
                    onDoubleClick={() => handleVolumeChange(ch.id, 0.75)}
                    style={{
                      writingMode: 'vertical-lr',
                      direction: 'rtl',
                      width: '32px',
                      height: '180px',
                      accentColor: ch.color_hex,
                      cursor: 'pointer',
                    }}
                    title="Podwójne kliknięcie resetuje do 75% (0 dB unity gain)"
                  />
                </div>

                {/* Odczyt decybeli / procentów */}
                <div style={{ textAlign: 'center', marginTop: '8px' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      fontFamily: 'var(--font-mono)',
                      color: isMuted ? '#64748b' : ch.volume >= 0.75 ? ch.color_hex : '#cbd5e1',
                    }}
                  >
                    {isMuted
                      ? '-INF dB'
                      : ch.volume <= 0.001
                      ? '-INF dB'
                      : `${dbVal >= 0 ? '+' : ''}${dbVal.toFixed(1)} dB`}
                  </span>
                  <div style={{ fontSize: '0.65rem', color: '#64748b' }}>
                    {Math.round(ch.volume * 100)}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Panel boczny Master & Presety */}
        <div
          style={{
            width: '260px',
            background: 'rgba(15, 23, 42, 0.8)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f8fafc' }}>
              Master & Szybkie Presety
            </span>
          </div>

          {/* Suwak Master */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: 600 }}>
                Głośność Master:
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-pink)' }}>
                {Math.round(masterVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.5"
              step="0.05"
              value={masterVolume}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setMasterVolume(v);
                applyMixToEngine(channels, v);
              }}
              style={{ width: '100%', accentColor: 'var(--accent-pink)' }}
            />
          </div>

          {/* Przycisk Reset do 75% */}
          <button
            onClick={handleResetAllToUnity}
            style={{
              padding: '8px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#f8fafc',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <RotateCcw size={14} />
            Reset wszystkich (75% / 0 dB)
          </button>

          {/* Szybkie presety */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
              Szybkie tryby:
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <button
                onClick={() => handleApplyPreset('karaoke')}
                style={{
                  padding: '6px',
                  borderRadius: '6px',
                  background: 'rgba(236, 72, 153, 0.1)',
                  border: '1px solid rgba(236, 72, 153, 0.25)',
                  color: '#f43f5e',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Karaoke (Bez wokalu)
              </button>
              <button
                onClick={() => handleApplyPreset('acapella')}
                style={{
                  padding: '6px',
                  borderRadius: '6px',
                  background: 'rgba(139, 92, 246, 0.1)',
                  border: '1px solid rgba(139, 92, 246, 0.25)',
                  color: '#a855f7',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Acapella (Solo)
              </button>
              <button
                onClick={() => handleApplyPreset('drums_only')}
                style={{
                  padding: '6px',
                  borderRadius: '6px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  color: '#f59e0b',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Tylko Perkusja
              </button>
              <button
                onClick={() => handleApplyPreset('rhythm_section')}
                style={{
                  padding: '6px',
                  borderRadius: '6px',
                  background: 'rgba(14, 165, 233, 0.1)',
                  border: '1px solid rgba(14, 165, 233, 0.25)',
                  color: '#0ea5e9',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Rhythm (Drums+Bass)
              </button>
              <button
                onClick={() => handleApplyPreset('instrumental')}
                style={{
                  padding: '6px',
                  borderRadius: '6px',
                  background: 'rgba(52, 211, 153, 0.1)',
                  border: '1px solid rgba(52, 211, 153, 0.25)',
                  color: '#34d399',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Instrumental
              </button>
              <button
                onClick={() => handleApplyPreset('practice_guitar')}
                style={{
                  padding: '6px',
                  borderRadius: '6px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  color: '#10b981',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Practice (Bez gitar)
              </button>
            </div>
          </div>

          {/* Narzędzia analityczne powiązane ze stemami */}
          <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '10px' }}>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
              Analiza na ścieżkach:
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {onOpenChords && (
                <button
                  onClick={onOpenChords}
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    background: 'rgba(236, 72, 153, 0.15)',
                    border: '1px solid rgba(236, 72, 153, 0.3)',
                    color: 'var(--accent-pink)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Music size={14} />
                  Akordy z wyizolowanego basu
                </button>
              )}
              {onOpenPianoRoll && (
                <button
                  onClick={onOpenPianoRoll}
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    background: 'rgba(139, 92, 246, 0.15)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    color: '#c084fc',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Piano size={14} />
                  Piano-Roll wyodrębnionego wokalu
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

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
          <span>Skróty: <b>M</b> Mute • <b>S</b> Solo • <b>0</b> Reset 0 dB</span>
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
              Zapisz miks projektu
            </h3>
            <input
              type="text"
              placeholder="np. Mój miks koncertowy..."
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
                Anuluj
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
                Zapisz
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
