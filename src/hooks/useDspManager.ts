import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '../api/ipc';
import { getSetting, setSetting } from '../api/settings';
import type { PlaybackStatus, DspPresetRecord } from '../types/playback';
import type { EqualizerPreset } from '../types/equalizer';
import type { Translations } from '../i18n';
import { fmt } from '../utils/fmt';

export interface UseDspManagerOptions {
  status: PlaybackStatus;
  setStatus: React.Dispatch<React.SetStateAction<PlaybackStatus>>;
  showMessage: (msg: string, isError?: boolean) => void;
  loc: Translations;
}

export function getEqPresetDisplayName(name: string, locOrIsPl?: Translations | boolean): string {
  if (locOrIsPl && typeof locOrIsPl === 'object' && 'dsp' in locOrIsPl) {
    const l = locOrIsPl as Translations;
    switch (name) {
      case 'Flat':
      case 'Płaski (Flat)':
        return l.dsp.presetFlat;
      case 'Bass Boost':
      case 'Mocny Bass (Bass Boost)':
        return l.dsp.presetBassBoost;
      case 'Electronic / Dance':
      case 'Elektroniczna / Dance':
        return l.dsp.presetElectronic;
      case 'Classical / Acoustic':
      case 'Klasyczna / Akustyczna':
        return l.dsp.presetAcoustic;
      case 'Custom':
      case 'Własny (Custom)':
        return l.dsp.presetCustom;
      default:
        return name;
    }
  }
  return name;
}

/** Saves the DSP parameters restored at app start-up (the `dsp_saved_settings` setting). */
function saveDspStartupSettings(engine: string, pitch: number, tempo: number, rate: number) {
  return setSetting(
    'dsp_saved_settings',
    JSON.stringify({ engine, pitch_semitones: pitch, tempo_ratio: tempo, rate_ratio: rate }),
  );
}

export function useDspManager({
  status,
  setStatus,
  showMessage,
  loc,
}: UseDspManagerOptions) {
  // 1. Equalizer State & Menu
  const [eqPresets, setEqPresets] = useState<EqualizerPreset[]>([]);
  const [selectedEqPreset, setSelectedEqPreset] = useState<string>('Płaski (Flat)');
  const [isEqPresetMenuOpen, setIsEqPresetMenuOpen] = useState<boolean>(false);

  // 2. DSP Engine Settings & Preferences
  const [dspAutoStartup, setDspAutoStartup] = useState<boolean>(false);
  const [dspDefaultEngine, setDspDefaultEngine] = useState<'Bypass' | 'RubberBand' | 'SoundTouch'>('Bypass');
  const [audioBufferMs, setAudioBufferMs] = useState<number>(600);
  const [dspBlockSize, setDspBlockSize] = useState<number>(2048);
  const [isDspQuickMenuOpen, setIsDspQuickMenuOpen] = useState<boolean>(false);
  const dspAutoStartupRef = useRef<boolean>(false);
  const lastActiveDspEngineRef = useRef<'RubberBand' | 'SoundTouch'>('RubberBand');
  const dspSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 3. DSP Vibes & Presets
  const [presets, setPresets] = useState<DspPresetRecord[]>([]);
  const [newPresetName, setNewPresetName] = useState('');
  const [activeDspVibe, setActiveDspVibe] = useState<'nightcore' | 'slowed' | 'vocal' | 'bass' | 'flat' | null>(null);

  // 4. Freeverb Reverb State
  const [reverbEnabled, setReverbEnabled] = useState<boolean>(false);
  const [reverbRoomSize, setReverbRoomSize] = useState<number>(0.5);
  const [reverbDamping, setReverbDamping] = useState<number>(0.5);
  const [reverbWidth, setReverbWidth] = useState<number>(1.0);
  const [reverbLevel, setReverbLevel] = useState<number>(0.2);

  // Throttling refs for real-time slider drag
  const pitchThrottleRef = useRef<{ timer: number | null; lastVal: number | null }>({ timer: null, lastVal: null });
  const tempoThrottleRef = useRef<{ timer: number | null; lastVal: number | null }>({ timer: null, lastVal: null });
  const rateThrottleRef = useRef<{ timer: number | null; lastVal: number | null }>({ timer: null, lastVal: null });

  // Load DSP presets and initial settings on mount
  const loadPresets = useCallback(async () => {
    try {
      const list = await invoke<DspPresetRecord[]>('list_dsp_presets');
      setPresets(list);
    } catch (e: unknown) {
      console.warn('Failed to load presets:', e);
    }
  }, []);

  useEffect(() => {
    loadPresets();
    invoke<EqualizerPreset[]>('get_equalizer_presets')
      .then((presets) => setEqPresets(presets))
      .catch((err) => console.warn('Failed to fetch EQ presets:', err));

    getSetting('dsp_restore_on_startup')
      .then((val) => {
        const enabled = val === 'true';
        setDspAutoStartup(enabled);
        dspAutoStartupRef.current = enabled;
      })
      .catch((e) => console.warn('Failed to read dsp_restore_on_startup:', e));

    getSetting('dsp_default_engine')
      .then((val) => {
        if (val === 'RubberBand' || val === 'SoundTouch' || val === 'Bypass') {
          setDspDefaultEngine(val);
        }
      })
      .catch((e) => console.warn('Failed to read dsp_default_engine:', e));

    invoke<number>('get_audio_buffer_duration_ms')
      .then((val) => {
        if (typeof val === 'number' && val > 0) {
          setAudioBufferMs(val);
        }
      })
      .catch((e) => console.warn('Failed to read get_audio_buffer_duration_ms:', e));

    invoke<number>('get_dsp_block_size')
      .then((val) => {
        if (typeof val === 'number' && val > 0) {
          setDspBlockSize(val);
        }
      })
      .catch((e) => console.warn('Failed to read get_dsp_block_size:', e));
  }, [loadPresets]);

  // Persist DSP settings debounced
  const persistDspSettings = useCallback((engine: string, pitch: number, tempo: number, rate: number) => {
    if (!dspAutoStartupRef.current) return;
    if (dspSaveTimeoutRef.current) {
      clearTimeout(dspSaveTimeoutRef.current);
    }
    dspSaveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveDspStartupSettings(engine, pitch, tempo, rate);
      } catch (err) {
        console.warn('Failed to save the DSP start-up settings:', err);
      }
    }, 250);
  }, []);

  // Handlers for real-time DSP pitch, tempo, and rate
  const handlePitchChange = useCallback(
    (semitones: number) => {
      setActiveDspVibe(null);
      setStatus((prev) => ({ ...prev, pitch_semitones: semitones }));
      persistDspSettings(status.engine, semitones, status.tempo_ratio ?? 1.0, status.rate_ratio ?? 1.0);

      pitchThrottleRef.current.lastVal = semitones;
      if (pitchThrottleRef.current.timer === null) {
        invoke('set_pitch', { semitones }).catch((e: unknown) => {
          showMessage(`${loc.common.errorPrefix} ${e}`, true);
        });

        pitchThrottleRef.current.timer = window.setTimeout(() => {
          pitchThrottleRef.current.timer = null;
          const finalVal = pitchThrottleRef.current.lastVal;
          if (finalVal !== null && finalVal !== semitones) {
            invoke('set_pitch', { semitones: finalVal }).catch((e: unknown) => {
              showMessage(`${loc.common.errorPrefix} ${e}`, true);
            });
          }
        }, 35);
      }
    },
    [status.engine, status.tempo_ratio, status.rate_ratio, persistDspSettings, setStatus, showMessage, loc]
  );

  const handleTempoChange = useCallback(
    (tempoRatio: number) => {
      setActiveDspVibe(null);
      setStatus((prev) => ({ ...prev, tempo_ratio: tempoRatio }));
      persistDspSettings(status.engine, status.pitch_semitones ?? 0.0, tempoRatio, status.rate_ratio ?? 1.0);

      tempoThrottleRef.current.lastVal = tempoRatio;
      if (tempoThrottleRef.current.timer === null) {
        invoke('set_tempo', { tempoRatio }).catch((e: unknown) => {
          showMessage(`${loc.common.errorPrefix} ${e}`, true);
        });

        tempoThrottleRef.current.timer = window.setTimeout(() => {
          tempoThrottleRef.current.timer = null;
          const finalVal = tempoThrottleRef.current.lastVal;
          if (finalVal !== null && finalVal !== tempoRatio) {
            invoke('set_tempo', { tempoRatio: finalVal }).catch((e: unknown) => {
              showMessage(`${loc.common.errorPrefix} ${e}`, true);
            });
          }
        }, 35);
      }
    },
    [status.engine, status.pitch_semitones, status.rate_ratio, persistDspSettings, setStatus, showMessage, loc]
  );

  const handleRateChange = useCallback(
    (rateRatio: number) => {
      setActiveDspVibe(null);
      setStatus((prev) => ({ ...prev, rate_ratio: rateRatio }));
      persistDspSettings(status.engine, status.pitch_semitones ?? 0.0, status.tempo_ratio ?? 1.0, rateRatio);

      rateThrottleRef.current.lastVal = rateRatio;
      if (rateThrottleRef.current.timer === null) {
        invoke('set_rate', { rateRatio }).catch((e: unknown) => {
          showMessage(`${loc.common.errorPrefix} ${e}`, true);
        });

        rateThrottleRef.current.timer = window.setTimeout(() => {
          rateThrottleRef.current.timer = null;
          const finalVal = rateThrottleRef.current.lastVal;
          if (finalVal !== null && finalVal !== rateRatio) {
            invoke('set_rate', { rateRatio: finalVal }).catch((e: unknown) => {
              showMessage(`${loc.common.errorPrefix} ${e}`, true);
            });
          }
        }, 35);
      }
    },
    [status.engine, status.pitch_semitones, status.tempo_ratio, persistDspSettings, setStatus, showMessage, loc]
  );

  const handleResetDsp = useCallback(async () => {
    try {
      setActiveDspVibe('flat');
      const res = await invoke<PlaybackStatus>('reset_dsp');
      setStatus(res);
      persistDspSettings(res.engine, res.pitch_semitones, res.tempo_ratio, res.rate_ratio);
      showMessage(loc.notifications.dspResetDefaultsMsg);
    } catch (e: unknown) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  }, [persistDspSettings, setStatus, showMessage, loc]);

  const handleEngineChange = useCallback(
    async (engine: 'Bypass' | 'RubberBand' | 'SoundTouch') => {
      if (engine !== 'Bypass') {
        lastActiveDspEngineRef.current = engine;
      }
      try {
        const res = await invoke<PlaybackStatus>('set_dsp_engine', { engine });
        setStatus(res);
        persistDspSettings(engine, res.pitch_semitones, res.tempo_ratio, res.rate_ratio);
        showMessage(fmt(loc.notifications.dspEngineSwitchedMsg, res.capabilities?.name ?? engine));
      } catch (e: unknown) {
        showMessage(`${loc.common.errorPrefix} ${e}`, true);
      }
    },
    [persistDspSettings, setStatus, showMessage, loc]
  );

  const handleCycleDspEngine = useCallback(async () => {
    const engines: ('Bypass' | 'RubberBand' | 'SoundTouch')[] = ['Bypass', 'RubberBand', 'SoundTouch'];
    const curIdx = engines.indexOf(status.engine);
    const nextEngine = engines[(curIdx + 1) % engines.length];
    await handleEngineChange(nextEngine);
  }, [status.engine, handleEngineChange]);

  const handleResetBitPerfect = useCallback(async () => {
    try {
      await handleResetDsp();
      await handleEngineChange('Bypass');
      if (status.equalizer_enabled) {
        await invoke('set_equalizer_enabled', { enabled: false });
        setStatus((prev) => ({ ...prev, equalizer_enabled: false }));
      }
      showMessage(loc.notifications.resetBitPerfect);
    } catch (err: unknown) {
      console.error('Failed to reset bit-perfect:', err);
    }
  }, [handleResetDsp, handleEngineChange, status.equalizer_enabled, setStatus, showMessage, loc]);

  const handleRestoreOriginalTrack = useCallback(async () => {
    try {
      await invoke('restore_original_track');
      showMessage(loc.notifications.restoredOriginalTrack);
    } catch (err: unknown) {
      showMessage(fmt(loc.notifications.restoreOriginalTrackError, String(err)), true);
    }
  }, [showMessage, loc]);

  // DSP Auto Startup Configuration
  const handleToggleDspAutoStartup = useCallback(async () => {
    const newVal = !dspAutoStartup;
    setDspAutoStartup(newVal);
    dspAutoStartupRef.current = newVal;
    try {
      await setSetting('dsp_restore_on_startup', newVal ? 'true' : 'false');
      if (newVal) {
        await setSetting('dsp_default_engine', status.engine);
        await saveDspStartupSettings(status.engine, status.pitch_semitones ?? 0.0, status.tempo_ratio ?? 1.0, status.rate_ratio ?? 1.0);
        setDspDefaultEngine(status.engine);
        showMessage(loc.notifications.dspAutostartOn);
      } else {
        showMessage(loc.notifications.dspAutostartOff);
      }
    } catch (e: unknown) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  }, [dspAutoStartup, status, showMessage, loc]);

  const handleSetDefaultDspEngine = useCallback(
    async (eng: 'Bypass' | 'RubberBand' | 'SoundTouch') => {
      setDspDefaultEngine(eng);
      try {
        await setSetting('dsp_default_engine', eng);
        showMessage(
          fmt(loc.notifications.dspStartupEngineSaved, eng === 'Bypass' ? 'Direct Bypass' : eng)
        );
      } catch (e: unknown) {
        showMessage(`${loc.common.errorPrefix} ${e}`, true);
      }
    },
    [showMessage, loc]
  );

  const handleSetAudioBuffer = useCallback(
    async (val: number) => {
      const clamped = Math.max(50, Math.min(4000, Math.round(val)));
      setAudioBufferMs(clamped);
      try {
        await invoke('set_audio_buffer_duration_ms', { bufferMs: clamped });
        showMessage(
          fmt(loc.notifications.audioBufferSet, String(clamped), clamped === 600 ? ' (default)' : '')
        );
      } catch (e: unknown) {
        showMessage(`${loc.common.errorPrefix} ${e}`, true);
      }
    },
    [showMessage, loc]
  );

  const handleSetDspBlockSize = useCallback(
    async (size: number) => {
      const clamped = Math.max(256, Math.min(16384, Math.round(size)));
      setDspBlockSize(clamped);
      try {
        await invoke('set_dsp_block_size', { blockSize: clamped });
        showMessage(
          fmt(loc.notifications.dspBlockSizeSet, String(clamped), clamped === 2048 ? ' (default)' : '')
        );
      } catch (e: unknown) {
        showMessage(`${loc.common.errorPrefix} ${e}`, true);
      }
    },
    [showMessage, loc]
  );

  const handleSaveDspStartupDefault = useCallback(async () => {
    try {
      await setSetting('dsp_restore_on_startup', 'true');
      await setSetting('dsp_default_engine', status.engine);
      await saveDspStartupSettings(status.engine, status.pitch_semitones ?? 0.0, status.tempo_ratio ?? 1.0, status.rate_ratio ?? 1.0);
      setDspDefaultEngine(status.engine);
      setDspAutoStartup(true);
      dspAutoStartupRef.current = true;
      showMessage(`${loc.notifications.dspSavedAsStartup} (${status.engine})`);
    } catch (e: unknown) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  }, [status, showMessage, loc]);

  // DSP Presets
  const handleSavePreset = useCallback(async () => {
    if (!newPresetName.trim()) {
      showMessage(loc.notifications.dspPresetNamePrompt, true);
      return;
    }
    try {
      await invoke('save_dsp_preset', { name: newPresetName.trim() });
      showMessage(`Saved preset '${newPresetName.trim()}' in the SQLite database`);
      setNewPresetName('');
      await loadPresets();
    } catch (e: unknown) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  }, [newPresetName, loadPresets, showMessage, loc]);

  const handleLoadPreset = useCallback(
    async (preset: DspPresetRecord) => {
      try {
        const res = await invoke<PlaybackStatus>('load_dsp_preset', { preset });
        setStatus(res);
        showMessage(fmt(loc.notifications.dspPresetLoadedMsg, preset.name, preset.engine));
      } catch (e: unknown) {
        showMessage(`${loc.common.errorPrefix} ${e}`, true);
      }
    },
    [setStatus, showMessage, loc]
  );

  // DSP Vibes
  const handleApplyDspVibe = useCallback(
    async (vibe: 'nightcore' | 'slowed' | 'vocal' | 'bass' | 'flat') => {
      try {
        if (activeDspVibe === vibe) {
          setActiveDspVibe(null);
          const flatBands = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
          setStatus((prev) => ({
            ...prev,
            engine: 'Bypass',
            tempo_ratio: 1.0,
            pitch_semitones: 0.0,
            rate_ratio: 1.0,
            equalizer_bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            equalizer_enabled: false,
          }));
          await invoke('apply_dsp_profile', {
            engine: 'Bypass',
            tempoRatio: 1.0,
            pitchSemitones: 0.0,
            rateRatio: 1.0,
            equalizerBands: flatBands,
            equalizerEnabled: false,
          });
          showMessage(loc.notifications.dspVibeBypass);
          return;
        }

        setActiveDspVibe(vibe);
        let targetTempo = 1.0;
        let targetPitch = 0.0;
        let targetRate = 1.0;
        let bands: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        let msg = '';

        if (vibe === 'nightcore') {
          targetTempo = 1.0;
          targetPitch = 0.0;
          targetRate = 1.25;
          bands = [0, 0, 0, 0, 1.0, 1.5, 2.5, 3.0, 2.5, 2.0];
          msg = loc.notifications.dspVibeNightcore;
        } else if (vibe === 'slowed') {
          targetTempo = 0.85;
          targetPitch = -2.0;
          targetRate = 1.0;
          bands = [4.5, 4.0, 3.0, 1.0, 0, 0, -1.0, -1.5, -2.5, -3.0];
          msg = loc.notifications.dspVibeSlowed;
        } else if (vibe === 'vocal') {
          targetTempo = 1.0;
          targetPitch = 0.0;
          targetRate = 1.0;
          bands = [-2.0, -1.5, -1.0, 0, 1.5, 3.5, 4.0, 3.0, 1.5, 0.5];
          msg = loc.notifications.dspVibeVocal;
        } else if (vibe === 'bass') {
          targetTempo = 1.0;
          targetPitch = 0.0;
          targetRate = 1.0;
          bands = [6.0, 5.5, 3.5, 1.0, 0, 0, 0, 0.5, 1.0, 1.0];
          msg = loc.notifications.dspVibeBass;
        } else if (vibe === 'flat') {
          targetTempo = 1.0;
          targetPitch = 0.0;
          targetRate = 1.0;
          bands = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
          msg = loc.notifications.dspPresetFlat;
        }

        setStatus((prev) => ({
          ...prev,
          tempo_ratio: targetTempo,
          pitch_semitones: targetPitch,
          rate_ratio: targetRate,
          equalizer_bands: bands,
          equalizer_enabled: true,
          engine: vibe !== 'flat' && prev.engine === 'Bypass' ? 'RubberBand' : prev.engine,
        }));

        // One IPC call instead of six in a row; the UI changes right away (optimistically),
        // and the backend ticker confirms the real state anyway.
        await invoke('apply_dsp_profile', {
          engine: vibe !== 'flat' && status.engine === 'Bypass' ? 'RubberBand' : null,
          tempoRatio: targetTempo,
          pitchSemitones: targetPitch,
          rateRatio: targetRate,
          equalizerBands: bands,
          equalizerEnabled: true,
        });

        showMessage(msg);
      } catch (e: unknown) {
        showMessage(`${loc.common.errorPrefix} ${e}`, true);
      }
    },
    [activeDspVibe, status.engine, setStatus, showMessage, loc]
  );

  // Equalizer Handlers
  const handleEqBandChange = useCallback(
    async (bandIndex: number, gainDb: number) => {
      try {
        await invoke('set_equalizer_band', { band: bandIndex, gainDb });
        setStatus((prev) => {
          const newBands = [...(prev.equalizer_bands || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0])];
          newBands[bandIndex] = gainDb;
          return { ...prev, equalizer_bands: newBands, equalizer_enabled: true };
        });
        setSelectedEqPreset(loc.notifications.eqCustom);
      } catch (e: unknown) {
        console.error('Failed to change the EQ band:', e);
      }
    },
    [setStatus, loc]
  );

  const handleEqToggle = useCallback(async () => {
    const newEnabled = !status.equalizer_enabled;
    try {
      await invoke('set_equalizer_enabled', { enabled: newEnabled });
      setStatus((prev) => ({ ...prev, equalizer_enabled: newEnabled }));
      showMessage(newEnabled ? loc.notifications.eqEnabledMsg : loc.notifications.eqDisabledMsg);
    } catch (e: unknown) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  }, [status.equalizer_enabled, setStatus, showMessage, loc]);

  const handleApplyEqPreset = useCallback(
    async (presetName: string) => {
      let targetBands: number[] | null = null;
      let targetName = presetName;

      const preset = eqPresets.find(
        (p) =>
          p.name === presetName ||
          getEqPresetDisplayName(p.name, true) === presetName ||
          getEqPresetDisplayName(p.name, false) === presetName
      );

      if (preset) {
        targetBands = preset.bands;
        targetName = preset.name;
      } else if (presetName === 'Flat' || presetName === 'Płaski (Flat)') {
        targetBands = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        targetName = loc.notifications.eqFlat;
      }

      if (!targetBands) return;

      setSelectedEqPreset(targetName);
      setIsEqPresetMenuOpen(false);

      try {
        await invoke('set_equalizer_params', { enabled: true, bands: targetBands });
        await invoke('set_equalizer_bands', { bands: targetBands }).catch(() => {});
        setStatus((prev) => ({ ...prev, equalizer_bands: [...targetBands], equalizer_enabled: true }));
        showMessage(fmt(loc.notifications.eqAppliedPreset, getEqPresetDisplayName(targetName, loc)));
      } catch (e: unknown) {
        showMessage(`${loc.common.errorPrefix} ${e}`, true);
      }
    },
    [eqPresets, setStatus, showMessage, loc]
  );

  const handleResetEq = useCallback(async () => {
    const flatBands = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    try {
      await invoke('set_equalizer_params', { enabled: true, bands: flatBands });
      await invoke('set_equalizer_bands', { bands: flatBands }).catch(() => {});
      await invoke('set_equalizer_preamp', { preampDb: 0.0 }).catch(() => {});
      setSelectedEqPreset(loc.notifications.eqFlat);
      setIsEqPresetMenuOpen(false);
      setStatus((prev) => ({ ...prev, equalizer_bands: flatBands, equalizer_enabled: true }));
      showMessage(loc.notifications.dspPresetFlat);
    } catch (e: unknown) {
      showMessage(`${loc.common.errorPrefix} ${e}`, true);
    }
  }, [setStatus, showMessage, loc]);

  // Reverb Handlers
  const handleUpdateReverb = useCallback(
    async (
      enabled: boolean,
      roomSize: number = reverbRoomSize,
      damping: number = reverbDamping,
      width: number = reverbWidth,
      level: number = reverbLevel
    ) => {
      setReverbEnabled(enabled);
      setReverbRoomSize(roomSize);
      setReverbDamping(damping);
      setReverbWidth(width);
      setReverbLevel(level);
      try {
        await invoke('set_reverb_params', {
          enabled,
          roomSize,
          damping,
          width,
          level,
        });
      } catch (e: unknown) {
        console.warn('Failed to update the reverb parameters:', e);
      }
    },
    [reverbRoomSize, reverbDamping, reverbWidth, reverbLevel]
  );

  return {
    eqPresets,
    setEqPresets,
    selectedEqPreset,
    setSelectedEqPreset,
    isEqPresetMenuOpen,
    setIsEqPresetMenuOpen,
    dspAutoStartup,
    setDspAutoStartup,
    dspDefaultEngine,
    setDspDefaultEngine,
    audioBufferMs,
    setAudioBufferMs,
    dspBlockSize,
    setDspBlockSize,
    isDspQuickMenuOpen,
    setIsDspQuickMenuOpen,
    presets,
    setPresets,
    newPresetName,
    setNewPresetName,
    loadPresets,
    activeDspVibe,
    setActiveDspVibe,
    reverbEnabled,
    setReverbEnabled,
    reverbRoomSize,
    setReverbRoomSize,
    reverbDamping,
    setReverbDamping,
    reverbWidth,
    setReverbWidth,
    reverbLevel,
    setReverbLevel,
    handlePitchChange,
    handleTempoChange,
    handleRateChange,
    handleResetDsp,
    handleEngineChange,
    handleCycleDspEngine,
    handleResetBitPerfect,
    handleRestoreOriginalTrack,
    handleToggleDspAutoStartup,
    handleSetDefaultDspEngine,
    handleSetAudioBuffer,
    handleSetDspBlockSize,
    handleSaveDspStartupDefault,
    handleSavePreset,
    handleLoadPreset,
    handleApplyDspVibe,
    handleEqBandChange,
    handleEqToggle,
    handleApplyEqPreset,
    handleResetEq,
    handleUpdateReverb,
    getEqPresetDisplayName,
    lastActiveDspEngineRef,
  };
}
