import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Play,
  Pause,
} from '../ui/icons';
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
  // Live position/spectrum (livePlayback): this component renders, not the whole app.
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

  // Fetch the project data
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

  // Listen for the project separation progress
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

  // Sync the mix to the audio pipeline
  const applyMixToEngine = useCallback(
    async (updatedChannels: StemChannel[], masterVol: number) => {
      try {
        await invoke('apply_stem_project_mix', {
          channels: updatedChannels,
          masterVolume: masterVol,
        });
      } catch (err: unknown) {
        console.error('Failed to sync the mix:', err);
      }
    },
    []
  );

  // Switch to the stem mix in real time
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

  // Switch to the original track in real time (A/B)
  const handleSwitchToOriginal = useCallback(async () => {
    try {
      await invoke('restore_original_track');
      setIsOriginalMode(true);
    } catch (err: unknown) {
      setError(fmt(loc.stems.errRestoreTrack, String(err)));
    }
  }, [loc]);

  // Return to the original track and close the studio window
  const handleReturnToOriginalAndClose = async () => {
    try {
      await invoke('restore_original_track');
    } catch (err: unknown) {
      console.warn('Failed to restore the original track:', err);
    }
    onClose();
  };

  // Close the studio window (with a safe return to the original)
  const handleClose = async () => {
    if (!isOriginalMode) {
      try {
        await invoke('restore_original_track');
      } catch {}
    }
    onClose();
  };

  // Load the stems live automatically when a finished project is opened
  useEffect(() => {
    if (isOpen && projectId && project?.status === 'ready' && !hasAutoLoadedRef.current) {
      hasAutoLoadedRef.current = true;
      handleSwitchToStems(isPlaying);
    }
    if (!isOpen) {
      hasAutoLoadedRef.current = false;
    }
  }, [isOpen, projectId, project?.status, handleSwitchToStems, isPlaying]);

  // Change a single channel's volume slider
  const handleVolumeChange = (channelId: string, newVolume: number) => {
    setChannels((prev) => {
      const updated = prev.map((ch) =>
        ch.id === channelId ? { ...ch, volume: newVolume } : ch
      );
      applyMixToEngine(updated, masterVolume);
      return updated;
    });
  };

  // Change the pan
  const handlePanChange = (channelId: string, newPan: number) => {
    setChannels((prev) => {
      const updated = prev.map((ch) =>
        ch.id === channelId ? { ...ch, pan: newPan } : ch
      );
      applyMixToEngine(updated, masterVolume);
      return updated;
    });
  };

  // Toggle Solo
  const handleToggleSolo = (channelId: string) => {
    setChannels((prev) => {
      const updated = prev.map((ch) =>
        ch.id === channelId ? { ...ch, solo: !ch.solo } : ch
      );
      applyMixToEngine(updated, masterVolume);
      return updated;
    });
  };

  // Toggle Mute
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

  // Quick presets
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

  // Save the mix as a preset
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

  // Load a saved mix
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

  // Export the whole project to ZIP
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

  // Keyboard shortcuts (Mute, Solo, 0 to reset)
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
    <div className="fixed inset-0 z-90 flex flex-col bg-deep/90 p-4 backdrop-blur-lg motion-safe:animate-fade-in-scale">
      {/* 1. TOP TOOLBAR (STUDIO HEADER) */}
      <StemStudioHeader {...props} project={project} loc={loc} channels={channels} handleSwitchToOriginal={handleSwitchToOriginal} t={t} isOriginalMode={isOriginalMode} handleSwitchToStems={handleSwitchToStems} handleReturnToOriginalAndClose={handleReturnToOriginalAndClose} activeMixName={activeMixName} mixes={mixes} handleLoadMix={handleLoadMix} handleResetAllToUnity={handleResetAllToUnity} setIsSavingMix={setIsSavingMix} handleExportZip={handleExportZip} handleClose={handleClose} />

      {exportNotice && (
        <div
          className="mb-2.5 rounded-xl border border-emerald-400/30 bg-emerald-400/15 px-4 py-2 text-sm text-emerald-400"
        >
          {exportNotice}
        </div>
      )}

      {error && (
        <div className="mb-2.5 rounded-xl border border-accent-red/30 bg-accent-red/15 px-4 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* 2. MAIN WORKSPACE: STEM CHANNELS + MASTER PANEL */}
      <StemStudioWorkspace {...props} channels={channels} anySoloActive={anySoloActive} setHoveredChannelId={setHoveredChannelId} hoveredChannelId={hoveredChannelId} handleToggleSolo={handleToggleSolo} t={t} handleToggleMute={handleToggleMute} handlePanChange={handlePanChange} handleVolumeChange={handleVolumeChange} masterVolume={masterVolume} setMasterVolume={setMasterVolume} applyMixToEngine={applyMixToEngine} handleResetAllToUnity={handleResetAllToUnity} handleApplyPreset={handleApplyPreset} />

      {/* 3. BOTTOM PLAYBACK CONTROL CONSOLE (TRANSPORT BAR) */}
      <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/8 bg-white/4 px-5 py-3">
        <div className="flex items-center gap-3.5">
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
            className="flex h-10 w-10 items-center justify-center rounded-full border-0 bg-linear-135 from-pink-500 to-violet-500 text-fg shadow-lift shadow-pink-500/40"
          >
            {isPlaying ? <Pause size={18} fill="#ffffff" /> : <Play size={18} fill="#ffffff" className="ml-0.5" />}
          </button>

          <span className="font-mono text-sm font-bold text-fg">
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

        {/* Progress bar */}
        <div className="mx-6 my-0 flex-1">
          <input
            type="range"
            min="0"
            max={durationMs || 100}
            value={currentTimeMs}
            onChange={(e) => onSeek?.(parseFloat(e.target.value))}
            className="w-full accent-accent-pink"
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-fg-secondary">
          <span>{t.stems.shortcutsHint}</span>
        </div>
      </div>

      {/* Save mix modal */}
      {isSavingMix && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/65">
          <div className="w-90 rounded-2xl border border-white/15 bg-slate-900 p-5 shadow-2xl shadow-black/80">
            <h3 className="mx-0 mt-0 mb-3 text-base text-fg">
              {t.stems.saveMixTitle}
            </h3>
            <input
              type="text"
              placeholder={t.stems.mixNamePlaceholder}
              value={newMixName}
              onChange={(e) => setNewMixName(e.target.value)}
              className="mb-3.5 w-full rounded-lg border border-white/10 bg-white/6 px-3 py-2 text-fg outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsSavingMix(false)}
                className="rounded-md border border-white/10 bg-transparent px-3 py-1.5 text-slate-300"
              >
                {t.common.cancel}
              </button>
              <button
                onClick={handleSaveMix}
                disabled={!newMixName.trim()}
                className="rounded-md border-0 bg-accent-pink px-3.5 py-1.5 font-bold text-on-accent"
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
