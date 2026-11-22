import { useState, useEffect, useCallback } from 'react';
import { invoke } from '../api/ipc';
import type { AudioCard } from '../types/audioDevices';
import type { TrackRecord } from '../types/library';
import type { Translations } from '../i18n';

export interface UseAudioSettingsOptions {
  showMessage: (msg: string, isError?: boolean) => void;
  loc: Translations;
  loadLibrary?: () => Promise<void>;
  setTracks?: React.Dispatch<React.SetStateAction<TrackRecord[]>>;
}

export function useAudioSettings({
  showMessage,
  loc,
  loadLibrary,
  setTracks,
}: UseAudioSettingsOptions) {
  // 1. Audio Devices / Cards
  const [cards, setCards] = useState<AudioCard[]>([]);

  const refreshDevices = useCallback(async () => {
    try {
      const res = await invoke<AudioCard[]>('list_devices');
      setCards(res);
    } catch (e: unknown) {
      console.warn('Error fetching audio devices:', e);
    }
  }, []);

  const handleEnableProAudio = useCallback(async (cardName: string) => {
    try {
      await invoke('enable_pro_audio', { cardName });
      showMessage(loc.notifications.proAudioEnabledMsg.replace('{0}', cardName));
      await refreshDevices();
    } catch (e: unknown) {
      showMessage(`${loc.common.errorPrefix} ${String(e)}`, true);
    }
  }, [loc.common.errorPrefix, loc.notifications.proAudioEnabledMsg, refreshDevices, showMessage]);

  const handleDisableProAudio = useCallback(async (cardName: string) => {
    try {
      const fallback = await invoke<string>('disable_pro_audio', { cardName });
      showMessage(loc.notifications.proAudioDisabledMsg.replace('{0}', fallback));
      await refreshDevices();
    } catch (e: unknown) {
      showMessage(`${loc.common.errorPrefix} ${String(e)}`, true);
    }
  }, [loc.common.errorPrefix, loc.notifications.proAudioDisabledMsg, refreshDevices, showMessage]);

  const handleSetCardProfile = useCallback(async (cardName: string, profile: string) => {
    try {
      await invoke('set_card_profile', { cardName, profile });
      showMessage(`Aktywowano profil karty '${cardName}': ${profile}`);
      await refreshDevices();
    } catch (e: unknown) {
      showMessage(`${loc.common.errorPrefix} ${String(e)}`, true);
    }
  }, [loc.common.errorPrefix, refreshDevices, showMessage]);

  const handleSetBluetoothCodec = useCallback(async (cardName: string, codec: string) => {
    try {
      await invoke('set_bluetooth_codec', { cardName, codec });
      showMessage(`Zmieniono kodek Bluetooth na: ${codec}`);
      await refreshDevices();
    } catch (e: unknown) {
      showMessage(`${loc.common.errorPrefix} ${String(e)}`, true);
    }
  }, [loc.common.errorPrefix, refreshDevices, showMessage]);

  // 2. ReplayGain 2.0 / EBU R128
  const [replaygainMode, setReplaygainMode] = useState<'Off' | 'Track' | 'Album' | 'Auto'>(() => {
    try {
      const saved = localStorage.getItem('auralune_replaygain_mode');
      if (saved === 'Off' || saved === 'Track' || saved === 'Album' || saved === 'Auto') return saved;
    } catch {}
    return 'Off';
  });

  const [replaygainPreAmp, setReplaygainPreAmp] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('auralune_replaygain_preamp');
      if (saved !== null) {
        const val = parseFloat(saved);
        if (!isNaN(val)) return val;
      }
    } catch {}
    return 0.0;
  });

  const [replaygainFallbackGain, setReplaygainFallbackGain] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('auralune_replaygain_fallback');
      if (saved !== null) {
        const val = parseFloat(saved);
        if (!isNaN(val)) return val;
      }
    } catch {}
    return -6.0;
  });

  const [replaygainPreventClipping, setReplaygainPreventClipping] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('auralune_replaygain_prevent_clipping');
      if (saved !== null) return saved === 'true';
    } catch {}
    return true;
  });

  const [replaygainStatus, setReplaygainStatus] = useState<[number, number, boolean]>([0.0, 0.0, true]);
  const [isReplaygainScanning, setIsReplaygainScanning] = useState(false);
  const [replaygainScanWriteTags, setReplaygainScanWriteTags] = useState(false);

  const handleSetReplayGain = useCallback(async (
    mode: 'Off' | 'Track' | 'Album' | 'Auto',
    preAmp: number,
    fallbackGain = replaygainFallbackGain,
    preventClipping = replaygainPreventClipping
  ) => {
    try {
      await invoke('set_replaygain_config', {
        config: {
          mode,
          pre_amp_db: preAmp,
          fallback_gain_db: fallbackGain,
          prevent_clipping: preventClipping,
        },
      });
      setReplaygainMode(mode);
      setReplaygainPreAmp(preAmp);
      setReplaygainFallbackGain(fallbackGain);
      setReplaygainPreventClipping(preventClipping);
      try {
        localStorage.setItem('auralune_replaygain_mode', mode);
        localStorage.setItem('auralune_replaygain_preamp', preAmp.toString());
        localStorage.setItem('auralune_replaygain_fallback', fallbackGain.toString());
        localStorage.setItem('auralune_replaygain_prevent_clipping', preventClipping.toString());
      } catch {}
    } catch (e: unknown) {
      console.error('Błąd aktualizacji ReplayGain:', e);
      showMessage(`${loc.common.errorPrefix} ${String(e)}`, true);
    }
  }, [loc.common.errorPrefix, replaygainFallbackGain, replaygainPreventClipping, showMessage]);

  const handleScanLibraryReplayGain = useCallback(async () => {
    if (isReplaygainScanning) return;
    setIsReplaygainScanning(true);
    showMessage(loc.settings.scanReplayGainScanning);
    try {
      const summary = await invoke<{ total_tracks: number; scanned: number; errors: number }>(
        'scan_library_replaygain',
        { writeTags: replaygainScanWriteTags }
      );
      showMessage(
        `${loc.settings.scanReplayGainComplete} (${summary.scanned}/${summary.total_tracks})`
      );
      if (loadLibrary) {
        await loadLibrary();
      }
    } catch (e: unknown) {
      console.error('Błąd skanowania ReplayGain:', e);
      showMessage(`${loc.common.errorPrefix} ${String(e)}`, true);
    } finally {
      setIsReplaygainScanning(false);
    }
  }, [isReplaygainScanning, loadLibrary, loc.common.errorPrefix, loc.settings.scanReplayGainComplete, loc.settings.scanReplayGainScanning, replaygainScanWriteTags, showMessage]);

  const handleScanTrackReplayGain = useCallback(async (track: TrackRecord) => {
    try {
      showMessage(`${loc.settings.scanReplayGainScanning} (${track.title})`);
      const res = await invoke<{
        track_gain_db: number;
        track_peak: number;
        reference_level_db: number;
      }>('scan_track_replaygain', {
        trackId: track.id,
        writeTags: replaygainScanWriteTags,
      });
      showMessage(
        `${track.title}: Gain ${res.track_gain_db >= 0 ? '+' : ''}${res.track_gain_db.toFixed(1)} dB, Peak ${res.track_peak.toFixed(3)}`
      );
      if (setTracks) {
        setTracks((prev) =>
          prev.map((t) =>
            t.id === track.id
              ? {
                  ...t,
                  replaygain_track_gain: res.track_gain_db,
                  replaygain_track_peak: res.track_peak,
                }
              : t
          )
        );
      }
    } catch (e: unknown) {
      console.error('Błąd analizy ReplayGain dla utworu:', e);
      showMessage(`${loc.common.errorPrefix} ${String(e)}`, true);
    }
  }, [loc.common.errorPrefix, loc.settings.scanReplayGainScanning, replaygainScanWriteTags, setTracks, showMessage]);

  // 3. Crossfeed (bs2b)
  const [crossfeedEnabled, setCrossfeedEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('auralune_crossfeed_enabled') === 'true';
    } catch {
      return false;
    }
  });

  const [crossfeedPreset, setCrossfeedPreset] = useState<'Default' | 'ChuMoy' | 'JanMeier' | 'Custom'>(() => {
    try {
      const saved = localStorage.getItem('auralune_crossfeed_preset');
      if (saved === 'Default' || saved === 'ChuMoy' || saved === 'JanMeier' || saved === 'Custom') return saved;
    } catch {}
    return 'Default';
  });

  const [crossfeedFcut, setCrossfeedFcut] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('auralune_crossfeed_fcut');
      if (saved) return parseInt(saved, 10) || 700;
    } catch {}
    return 700;
  });

  const [crossfeedFeed, setCrossfeedFeed] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('auralune_crossfeed_feed');
      if (saved) return parseInt(saved, 10) || 45;
    } catch {}
    return 45;
  });

  const handleSetCrossfeed = useCallback(async (
    enabled: boolean,
    preset: 'Default' | 'ChuMoy' | 'JanMeier' | 'Custom',
    fcut = crossfeedFcut,
    feed = crossfeedFeed
  ) => {
    let targetFcut = fcut;
    let targetFeed = feed;
    if (preset === 'Default') {
      targetFcut = 700;
      targetFeed = 45;
    } else if (preset === 'ChuMoy') {
      targetFcut = 700;
      targetFeed = 60;
    } else if (preset === 'JanMeier') {
      targetFcut = 650;
      targetFeed = 90;
    }
    try {
      await invoke('set_crossfeed_config', {
        config: {
          enabled,
          preset,
          fcut_hz: targetFcut,
          feed_tenth_db: targetFeed,
        },
      });
      setCrossfeedEnabled(enabled);
      setCrossfeedPreset(preset);
      setCrossfeedFcut(targetFcut);
      setCrossfeedFeed(targetFeed);
      try {
        localStorage.setItem('auralune_crossfeed_enabled', enabled.toString());
        localStorage.setItem('auralune_crossfeed_preset', preset);
        localStorage.setItem('auralune_crossfeed_fcut', targetFcut.toString());
        localStorage.setItem('auralune_crossfeed_feed', targetFeed.toString());
      } catch {}
      showMessage(
        enabled
          ? loc.notifications.crossfeedOn.replace('{0}', `${preset} (${targetFcut}Hz / ${(targetFeed / 10).toFixed(1)}dB)`)
          : loc.notifications.crossfeedOff
      );
    } catch (e: unknown) {
      console.error('Błąd aktualizacji Crossfeed:', e);
      showMessage(`${loc.common.errorPrefix} ${String(e)}`, true);
    }
  }, [crossfeedFcut, crossfeedFeed, loc.common.errorPrefix, loc.notifications.crossfeedOff, loc.notifications.crossfeedOn, showMessage]);

  // 4. Silence Trimming
  const [silenceTrimmingEnabled, setSilenceTrimmingEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('auralune_silence_trimming_enabled') === 'true';
    } catch {
      return false;
    }
  });

  const [silenceTrimmingThreshold, setSilenceTrimmingThreshold] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('auralune_silence_trimming_threshold');
      if (saved) return parseFloat(saved) || -50.0;
    } catch {}
    return -50.0;
  });

  const handleSetSilenceTrimming = useCallback(async (enabled: boolean, threshold: number) => {
    try {
      await invoke('set_silence_trimming_config', {
        config: {
          enabled,
          threshold_db: threshold,
        },
      });
      setSilenceTrimmingEnabled(enabled);
      setSilenceTrimmingThreshold(threshold);
      try {
        localStorage.setItem('auralune_silence_trimming_enabled', enabled.toString());
        localStorage.setItem('auralune_silence_trimming_threshold', threshold.toString());
      } catch {}
    } catch (e: unknown) {
      console.error('Błąd aktualizacji Silence Trimming:', e);
      showMessage(`${loc.common.errorPrefix} ${String(e)}`, true);
    }
  }, [loc.common.errorPrefix, showMessage]);

  // 5. Seek Fade & EQ Auto Startup
  const [seekFadeEnabled, setSeekFadeEnabled] = useState<boolean>(true);
  const [eqAutoStartup, setEqAutoStartup] = useState<boolean>(false);

  const handleToggleSeekFade = useCallback(async () => {
    setSeekFadeEnabled((prev) => {
      const newVal = !prev;
      invoke('set_app_setting', {
        key: 'seek_fade_enabled',
        value: newVal ? 'true' : 'false',
      })
        .then(() => {
          showMessage(
            newVal
              ? loc.notifications.seekFadeEnabled
              : loc.notifications.seekFadeDisabled
          );
        })
        .catch((e) => {
          showMessage(`${loc.common.errorPrefix} ${String(e)}`, true);
        });
      return newVal;
    });
  }, [loc.common.errorPrefix, loc.notifications.seekFadeDisabled, loc.notifications.seekFadeEnabled, showMessage]);

  const handleToggleEqAutoStartup = useCallback(async () => {
    setEqAutoStartup((prev) => {
      const newVal = !prev;
      invoke('set_app_setting', {
        key: 'eq_enabled_on_startup',
        value: newVal ? 'true' : 'false',
      })
        .then(() => {
          showMessage(
            newVal
              ? loc.notifications.eqAutostartOn
              : loc.notifications.eqAutostartOff
          );
        })
        .catch((e) => {
          showMessage(`${loc.common.errorPrefix} ${String(e)}`, true);
        });
      return newVal;
    });
  }, [loc.common.errorPrefix, loc.notifications.eqAutostartOff, loc.notifications.eqAutostartOn, showMessage]);

  // Initial audio settings push to GStreamer backend on mount
  useEffect(() => {
    // 1. ReplayGain
    const savedRgMode = (localStorage.getItem('auralune_replaygain_mode') as 'Off' | 'Track' | 'Album' | 'Auto') || 'Off';
    const savedRgPreAmp = parseFloat(localStorage.getItem('auralune_replaygain_preamp') || '0.0') || 0.0;
    const savedRgFallback = parseFloat(localStorage.getItem('auralune_replaygain_fallback') || '-6.0') || -6.0;
    const savedRgClipping = localStorage.getItem('auralune_replaygain_prevent_clipping') !== 'false';
    invoke('set_replaygain_config', {
      config: {
        mode: savedRgMode,
        pre_amp_db: savedRgPreAmp,
        fallback_gain_db: savedRgFallback,
        prevent_clipping: savedRgClipping,
      },
    }).catch((e) => console.warn('Błąd inicjalizacji ReplayGain:', e));

    // 2. Crossfeed
    const savedCfEnabled = localStorage.getItem('auralune_crossfeed_enabled') === 'true';
    const savedCfPreset = (localStorage.getItem('auralune_crossfeed_preset') as 'Default' | 'ChuMoy' | 'JanMeier' | 'Custom') || 'Default';
    const savedCfFcut = parseInt(localStorage.getItem('auralune_crossfeed_fcut') || '700', 10) || 700;
    const savedCfFeed = parseInt(localStorage.getItem('auralune_crossfeed_feed') || '45', 10) || 45;
    invoke('set_crossfeed_config', {
      config: {
        enabled: savedCfEnabled,
        preset: savedCfPreset,
        fcut_hz: savedCfFcut,
        feed_tenth_db: savedCfFeed,
      },
    }).catch((e) => console.warn('Błąd inicjalizacji Crossfeed:', e));

    // 3. Silence Trimming
    const savedStEnabled = localStorage.getItem('auralune_silence_trimming_enabled') === 'true';
    const savedStThreshold = parseFloat(localStorage.getItem('auralune_silence_trimming_threshold') || '-50.0') || -50.0;
    invoke('set_silence_trimming_config', {
      config: {
        enabled: savedStEnabled,
        threshold_db: savedStThreshold,
      },
    }).catch((e) => console.warn('Błąd inicjalizacji Silence Trimming:', e));

    // 4. Seek fade setting
    invoke<string | null>('get_app_setting', { key: 'seek_fade_enabled' })
      .then((val) => {
        if (val !== null && val !== undefined) {
          setSeekFadeEnabled(val !== 'false');
        }
      })
      .catch(() => {});

    // 5. EQ startup setting
    invoke<string | null>('get_app_setting', { key: 'eq_enabled_on_startup' })
      .then((val) => {
        if (val !== null && val !== undefined) {
          setEqAutoStartup(val === 'true');
        }
      })
      .catch(() => {});
  }, []);

  return {
    // Devices
    cards,
    setCards,
    refreshDevices,
    handleEnableProAudio,
    handleDisableProAudio,
    handleSetCardProfile,
    handleSetBluetoothCodec,

    // ReplayGain
    replaygainMode,
    setReplaygainMode,
    replaygainPreAmp,
    setReplaygainPreAmp,
    replaygainFallbackGain,
    setReplaygainFallbackGain,
    replaygainPreventClipping,
    setReplaygainPreventClipping,
    replaygainStatus,
    setReplaygainStatus,
    handleSetReplayGain,
    isReplaygainScanning,
    replaygainScanWriteTags,
    setReplaygainScanWriteTags,
    handleScanLibraryReplayGain,
    handleScanTrackReplayGain,

    // Crossfeed
    crossfeedEnabled,
    setCrossfeedEnabled,
    crossfeedPreset,
    setCrossfeedPreset,
    crossfeedFcut,
    setCrossfeedFcut,
    crossfeedFeed,
    setCrossfeedFeed,
    handleSetCrossfeed,

    // Silence Trimming
    silenceTrimmingEnabled,
    setSilenceTrimmingEnabled,
    silenceTrimmingThreshold,
    setSilenceTrimmingThreshold,
    handleSetSilenceTrimming,

    // Seek fade & EQ startup
    seekFadeEnabled,
    setSeekFadeEnabled,
    handleToggleSeekFade,
    eqAutoStartup,
    setEqAutoStartup,
    handleToggleEqAutoStartup,
  };
}
