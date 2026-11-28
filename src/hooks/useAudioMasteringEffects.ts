import { useState, useRef } from 'react';
import { invoke } from '../api/ipc';
import { setSetting } from '../api/settings';
import { useStableCallback } from './useStableCallback';
import type { PlaybackStatus } from '../types/player';
import type { Translations } from '../i18n';
import { fmt } from '../utils/fmt';
import { CROSSFADE_DEFAULT_MS, clampCrossfadeMs } from '../utils/crossfade';

export interface UseAudioMasteringEffectsOptions {
  status: PlaybackStatus;
  setStatus: React.Dispatch<React.SetStateAction<PlaybackStatus>>;
  showMessage: (msg: string, isError?: boolean) => void;
  loc: Translations;
}

export function useAudioMasteringEffects({
  showMessage,
  loc,
}: UseAudioMasteringEffectsOptions) {
  const [crossfadeDuration, setCrossfadeDuration] = useState<number>(CROSSFADE_DEFAULT_MS);
  // Slider drags fire many changes; chaining the writes keeps the engine and the database on the last value.
  const crossfadeWriteChain = useRef<Promise<void>>(Promise.resolve());
  const [bassBoost, setBassBoost] = useState<number>(0);
  const lastBassBoostRef = useRef<number>(6.0);
  const [stereoWidenerActive, setStereoWidenerActive] = useState<boolean>(false);
  const [stereoWidenerAmount, setStereoWidenerAmount] = useState<number>(0.15);
  const [limiterEnabled, setLimiterEnabled] = useState<boolean>(true);

  const handleCrossfadeDurationChange = useStableCallback(async (ms: number) => {
    const clamped = clampCrossfadeMs(ms);
    setCrossfadeDuration(clamped);
    const write = crossfadeWriteChain.current.then(async () => {
      try {
        await invoke('set_crossfade_duration', { durationMs: clamped });
      } catch (e: unknown) {
        console.warn('Failed to apply crossfade_duration:', e);
      }
      try {
        await setSetting('crossfade_duration', clamped.toString());
      } catch (e: unknown) {
        console.warn('Failed to save crossfade_duration:', e);
      }
    });
    crossfadeWriteChain.current = write;
    await write;
  });

  const handleToggleLimiter = useStableCallback(async (enabled: boolean) => {
    setLimiterEnabled(enabled);
    try {
      await invoke('set_limiter_enabled', { enabled });
      await setSetting('limiter_enabled', enabled ? 'true' : 'false');
      showMessage(
        enabled
          ? loc.notifications.limiterOn
          : loc.notifications.limiterOff
      );
    } catch (e) {
      console.warn('Failed to toggle the limiter:', e);
    }
  });

  const handleBassBoostChange = useStableCallback(async (boostDb: number) => {
    const clamped = Math.max(0, Math.min(12, boostDb));
    setBassBoost(clamped);
    if (clamped > 0) {
      lastBassBoostRef.current = clamped;
    }
    try {
      await setSetting('bass_boost', clamped.toString());
      // Bass Boost is its own engine stage: it must never write into the graphic EQ bands.
      await invoke('set_bass_boost', { boostDb: clamped });
      if (clamped > 0 && !limiterEnabled) {
        handleToggleLimiter(true);
      }
      showMessage(
        clamped > 0
          ? fmt(loc.notifications.bassBoostOn, clamped.toFixed(1))
          : loc.notifications.bassBoostOff
      );
    } catch (e) {
      console.warn('Failed to set Bass Boost:', e);
    }
  });

  const handleToggleStereoWidener = useStableCallback(async (active: boolean) => {
    setStereoWidenerActive(active);
    try {
      await invoke('set_stereo_widener', { active, amount: stereoWidenerAmount });
      await setSetting('stereo_widener_active', active ? 'true' : 'false');
      showMessage(
        active
          ? fmt(loc.notifications.stereoWidenerOn, Math.round(stereoWidenerAmount * 100).toString())
          : loc.notifications.stereoWidenerOff
      );
    } catch (e) {
      console.warn('Failed to toggle the stereo widener:', e);
    }
  });

  const handleStereoWidenerAmountChange = useStableCallback(async (amt: number) => {
    const clamped = Math.max(0, Math.min(1, amt));
    setStereoWidenerAmount(clamped);
    setStereoWidenerActive(true);
    try {
      await invoke('set_stereo_widener', { active: true, amount: clamped });
      await setSetting('stereo_widener_amount', clamped.toString());
      await setSetting('stereo_widener_active', 'true');
    } catch (e) {
      console.warn('Failed to set the stereo widener:', e);
    }
  });

  return {
    crossfadeDuration,
    setCrossfadeDuration,
    bassBoost,
    setBassBoost,
    lastBassBoostRef,
    stereoWidenerActive,
    setStereoWidenerActive,
    stereoWidenerAmount,
    setStereoWidenerAmount,
    limiterEnabled,
    setLimiterEnabled,
    handleCrossfadeDurationChange,
    handleBassBoostChange,
    handleToggleStereoWidener,
    handleStereoWidenerAmountChange,
    handleToggleLimiter,
  };
}
