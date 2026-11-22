import { useState, useRef } from 'react';
import { invoke } from '../api/ipc';
import type { PlaybackStatus } from '../types/player';
import type { Translations } from '../i18n';

export interface UseAudioMasteringEffectsOptions {
  status: PlaybackStatus;
  setStatus: React.Dispatch<React.SetStateAction<PlaybackStatus>>;
  showMessage: (msg: string, isError?: boolean) => void;
  loc: Translations;
}

export function useAudioMasteringEffects({
  status,
  setStatus,
  showMessage,
  loc,
}: UseAudioMasteringEffectsOptions) {
  const [crossfadeDuration, setCrossfadeDuration] = useState<number>(1500);
  const [bassBoost, setBassBoost] = useState<number>(0);
  const lastBassBoostRef = useRef<number>(6.0);
  const [stereoWidenerActive, setStereoWidenerActive] = useState<boolean>(false);
  const [stereoWidenerAmount, setStereoWidenerAmount] = useState<number>(0.15);
  const [limiterEnabled, setLimiterEnabled] = useState<boolean>(true);

  const handleCrossfadeDurationChange = async (ms: number) => {
    const clamped = Math.max(0, Math.min(8000, ms));
    setCrossfadeDuration(clamped);
    try {
      await invoke('set_crossfade_duration', { durationMs: clamped });
      await invoke('set_app_setting', { key: 'crossfade_duration', value: clamped.toString() });
    } catch (e) {
      console.warn('Błąd zapisu crossfade_duration:', e);
    }
  };

  const handleToggleLimiter = async (enabled: boolean) => {
    setLimiterEnabled(enabled);
    try {
      await invoke('set_limiter_enabled', { enabled });
      await invoke('set_app_setting', { key: 'limiter_enabled', value: enabled ? 'true' : 'false' });
      showMessage(
        enabled
          ? loc.notifications.limiterOn
          : loc.notifications.limiterOff
      );
    } catch (e) {
      console.warn('Błąd przełączania limitera:', e);
    }
  };

  const handleBassBoostChange = async (boostDb: number) => {
    const clamped = Math.max(0, Math.min(12, boostDb));
    setBassBoost(clamped);
    if (clamped > 0) {
      lastBassBoostRef.current = clamped;
    }
    try {
      await invoke('set_app_setting', { key: 'bass_boost', value: clamped.toString() });
      const baseBands = [...(status.equalizer_bands || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0])];
      baseBands[0] = Math.min(12, Math.max(-24, clamped * 1.0));
      baseBands[1] = Math.min(12, Math.max(-24, clamped * 0.75));
      baseBands[2] = Math.min(12, Math.max(-24, clamped * 0.4));
      await invoke('set_equalizer_params', { enabled: true, bands: baseBands });
      setStatus((prev) => ({ ...prev, equalizer_bands: baseBands, equalizer_enabled: true }));
      if (clamped > 0 && !limiterEnabled) {
        handleToggleLimiter(true);
      }
      showMessage(
        clamped > 0
          ? loc.notifications.bassBoostOn.replace('{0}', clamped.toFixed(1))
          : loc.notifications.bassBoostOff
      );
    } catch (e) {
      console.warn('Błąd ustawiania Bass Boost:', e);
    }
  };

  const handleToggleStereoWidener = async (active: boolean) => {
    setStereoWidenerActive(active);
    try {
      await invoke('set_stereo_widener', { active, amount: stereoWidenerAmount });
      await invoke('set_app_setting', { key: 'stereo_widener_active', value: active ? 'true' : 'false' });
      showMessage(
        active
          ? loc.notifications.stereoWidenerOn.replace('{0}', Math.round(stereoWidenerAmount * 100).toString())
          : loc.notifications.stereoWidenerOff
      );
    } catch (e) {
      console.warn('Błąd przełączania stereo widenera:', e);
    }
  };

  const handleStereoWidenerAmountChange = async (amt: number) => {
    const clamped = Math.max(0, Math.min(1, amt));
    setStereoWidenerAmount(clamped);
    setStereoWidenerActive(true);
    try {
      await invoke('set_stereo_widener', { active: true, amount: clamped });
      await invoke('set_app_setting', { key: 'stereo_widener_amount', value: clamped.toString() });
      await invoke('set_app_setting', { key: 'stereo_widener_active', value: 'true' });
    } catch (e) {
      console.warn('Błąd ustawiania stereo widenera:', e);
    }
  };

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
