import type { AppTab } from '../types/navigation';
import { useEffect, useRef } from "react";
import type { PlaybackStatus } from "../types/player";
import type { getTranslations } from "../i18n";
import { fmt } from '../utils/fmt';
import { stepVolumeGain, volumeStepSize, type VolumeCurve } from '../utils/volumeCurve';

export interface UseHotkeysManagerProps {
  statusRef: React.MutableRefObject<PlaybackStatus>;
  handlePlayPause: () => void;
  handleNext: () => void;
  handlePrevious: () => void;
  handleSeek: (ms: number) => void;
  handleVolumeChange: (vol: number) => void;
  /** Mute / unmute that remembers the last level. */
  handleToggleMute: () => void;
  /** Slider curve: the arrow keys step the slider position, not the gain. */
  volumeCurve: VolumeCurve;
  handleToggleShuffle: () => void;
  handleCycleLoopMode: () => void;
  handlePitchChange: (st: number) => void;
  handleTempoChange: (t: number) => void;
  handleResetDsp: () => void;
  toggleMiniPlayer: () => void;
  setIsBigScreen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSettingsOpen: (v: boolean) => void;
  setIsQueueOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  setIsQuickLoadOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  setShowPlaylistModal: (v: boolean) => void;
  setIsScanFolderOpen: (v: boolean) => void;
  setIsShortcutsModalOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  setIsCommandPaletteOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  setShowLyrics: React.Dispatch<React.SetStateAction<boolean>>;
  setLoopPointA: (v: number | null) => void;
  setLoopPointB: (v: number | null) => void;
  setActiveTab: (tab: AppTab) => void;
  handleIncreaseScale: () => void;
  handleDecreaseScale: () => void;
  handleResetScale: () => void;
  formatTime: (ms: number) => string;
  formatVolumeValue: (vol: number) => string;
  showMessage: (msg: string, isError?: boolean) => void;
  t: ReturnType<typeof getTranslations>;
  librarySearchInputRef?: React.RefObject<HTMLInputElement | null>;
}

export function useHotkeysManager(props: UseHotkeysManagerProps) {
  // The keyboard listener is registered once; the handler reads the latest props from a ref.
  // The effect used to have an empty dependency list, which froze the values from the first render
  // (e.g. the translations after a language change and the volume unit format).
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const {
        statusRef,
        handlePlayPause,
        handleNext,
        handlePrevious,
        handleSeek,
        handleVolumeChange,
        handleToggleMute,
        volumeCurve,
        handleToggleShuffle,
        handleCycleLoopMode,
        handlePitchChange,
        handleTempoChange,
        handleResetDsp,
        toggleMiniPlayer,
        setIsBigScreen,
        setIsSettingsOpen,
        setIsQueueOpen,
        setIsQuickLoadOpen,
        setShowPlaylistModal,
        setIsScanFolderOpen,
        setIsShortcutsModalOpen,
        setIsCommandPaletteOpen,
        setShowLyrics,
        setLoopPointA,
        setLoopPointB,
        setActiveTab,
        handleIncreaseScale,
        handleDecreaseScale,
        handleResetScale,
        formatTime,
        formatVolumeValue,
        showMessage,
        t,
        librarySearchInputRef,
      } = propsRef.current;
      const activeEl = document.activeElement as HTMLElement | null;
      const activeTag = (activeEl?.tagName || '').toLowerCase();
      const isRangeInput = activeTag === 'input' && (activeEl as HTMLInputElement)?.type === 'range';
      const isTextInput = (activeTag === 'input' && !isRangeInput) || activeTag === 'textarea' || activeEl?.isContentEditable;

      // Escape closes modals, the queue drawer and full-screen mode, or removes focus from text fields
      if (e.key === 'Escape') {
        setIsBigScreen(false);
        if (activeEl) {
          activeEl.blur();
        }
        setIsSettingsOpen(false);
        setIsQueueOpen(false);
        setIsQuickLoadOpen(false);
        setShowPlaylistModal(false);
        setIsScanFolderOpen(false);
        setIsShortcutsModalOpen(false);
        return;
      }

      // While the user is typing, player shortcuts are not intercepted
      if (isTextInput) {
        return;
      }

      // When a slider is focused (a range input, e.g. the volume, seek or DSP parameter slider),
      // the up/down arrow keys natively change its value by 1%.
      // Focus is removed from the slider right away and the default event is blocked, so the global player shortcut runs (e.g. volume ±5%, seek ±5s, space).
      if (isRangeInput) {
        const isPlayerControlKey = [
          'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
          'KeyM', 'KeyN', 'KeyP', 'KeyQ', 'KeyT', 'KeyF', 'KeyK',
          'BracketLeft', 'BracketRight', 'Minus', 'Equal', 'Digit0',
          'KeyS', 'KeyL', 'KeyA', 'KeyB', 'KeyC', 'Slash',
        ].includes(e.code) || ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'm', 'M', 'n', 'N', 'p', 'P', 'q', 'Q', 't', 'T', 'f', 'F', '[', ']', '-', '=', '0', 's', 'S', 'l', 'L', 'a', 'A', 'b', 'B', 'c', 'C', '?'].includes(e.key);

        if (isPlayerControlKey) {
          e.preventDefault();
          activeEl?.blur();
        }
      }

      // Space: play / pause
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        handlePlayPause();
        return;
      }

      // Right arrow: seek forward 5 s (or Next with Ctrl)
      if (e.code === 'ArrowRight' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
          handleNext();
        } else {
          const currentPos = statusRef.current.position_ms;
          const duration = statusRef.current.duration_ms || 3600000;
          const newPos = Math.min(duration, currentPos + 5000);
          handleSeek(newPos);
          showMessage(`Seek: +5s (${formatTime(newPos)})`);
        }
        return;
      }

      // Left arrow: seek back 5 s (or Previous with Ctrl)
      if (e.code === 'ArrowLeft' || e.key === 'ArrowLeft') {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
          handlePrevious();
        } else {
          const currentPos = statusRef.current.position_ms;
          const newPos = Math.max(0, currentPos - 5000);
          handleSeek(newPos);
          showMessage(`Seek: -5s (${formatTime(newPos)})`);
        }
        return;
      }

      // Up / Down arrow: slider position ±2% (Shift 0.5%, Ctrl 5%) on the user's volume curve
      if (e.code === 'ArrowUp' || e.key === 'ArrowUp') {
        e.preventDefault();
        const newVol = stepVolumeGain(statusRef.current.volume, volumeStepSize(e), volumeCurve);
        handleVolumeChange(newVol);
        showMessage(fmt(t.notifications.volumeMsg, formatVolumeValue(newVol)));
        return;
      }

      if (e.code === 'ArrowDown' || e.key === 'ArrowDown') {
        e.preventDefault();
        const newVol = stepVolumeGain(statusRef.current.volume, -volumeStepSize(e), volumeCurve);
        handleVolumeChange(newVol);
        showMessage(fmt(t.notifications.volumeMsg, formatVolumeValue(newVol)));
        return;
      }

      // F2 or Shift + M: toggle the mini-player
      if (e.code === 'F2' || (e.code === 'KeyM' && e.shiftKey) || (e.key === 'M' && e.shiftKey)) {
        e.preventDefault();
        toggleMiniPlayer();
        return;
      }

      // F11: Kiosk / Big Screen full screen
      if (e.code === 'F11') {
        e.preventDefault();
        setIsBigScreen((prev) => !prev);
        return;
      }

      // M: mute / unmute, restoring the level from before the mute
      if (e.code === 'KeyM' || e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        const wasMuted = statusRef.current.volume === 0;
        handleToggleMute();
        showMessage(wasMuted ? t.notifications.unmutedMsg : t.notifications.mutedMsg);
        return;
      }

      // [ and ]: pitch shift -1 / +1 semitone
      if (e.key === '[' || e.code === 'BracketLeft') {
        e.preventDefault();
        handlePitchChange(Math.max(-12, (statusRef.current.pitch_semitones ?? 0) - 1.0));
        return;
      }
      if (e.key === ']' || e.code === 'BracketRight') {
        e.preventDefault();
        handlePitchChange(Math.min(12, (statusRef.current.pitch_semitones ?? 0) + 1.0));
        return;
      }

      // - and +: tempo change (tempo stretch -5% / +5%)
      if (e.key === '-' || e.key === '_' || e.code === 'Minus') {
        e.preventDefault();
        handleTempoChange(Math.max(0.25, Math.round(((statusRef.current.tempo_ratio ?? 1.0) - 0.05) * 100) / 100));
        return;
      }
      if (e.key === '=' || e.key === '+' || e.code === 'Equal') {
        e.preventDefault();
        handleTempoChange(Math.min(3.0, Math.round(((statusRef.current.tempo_ratio ?? 1.0) + 0.05) * 100) / 100));
        return;
      }

      // 0: reset the DSP parameters to neutral
      if (e.key === '0' || e.code === 'Digit0') {
        e.preventDefault();
        handleResetDsp();
        return;
      }

      // S: toggle shuffle
      if (e.code === 'KeyS' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        handleToggleShuffle();
        return;
      }

      // L: cycle the loop mode (Off -> Track -> Queue)
      if (e.code === 'KeyL' || e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        handleCycleLoopMode();
        return;
      }

      // A, B, C: A-B loop points and clearing them
      if (e.code === 'KeyA' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        setLoopPointA(statusRef.current.position_ms);
        return;
      }
      if (e.code === 'KeyB' || e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        setLoopPointB(statusRef.current.position_ms);
        return;
      }
      if (e.code === 'KeyC' || e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setLoopPointA(null);
        setLoopPointB(null);
        return;
      }

      // ?: keyboard shortcuts window
      if (e.key === '?' || (e.key === '/' && e.shiftKey) || (e.code === 'Slash' && e.shiftKey)) {
        e.preventDefault();
        setIsShortcutsModalOpen((prev) => !prev);
        return;
      }

      // T: toggle lyrics
      if (e.code === 'KeyT' || e.key === 't' || e.key === 'T') {
        e.preventDefault();
        setShowLyrics((prev) => !prev);
        return;
      }

      // N: next track
      if (e.code === 'KeyN' || e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        handleNext();
        return;
      }

      // P: previous track
      if (e.code === 'KeyP' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        handlePrevious();
        return;
      }

      // Q: toggle the queue drawer
      if (e.code === 'KeyQ' || e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        setIsQueueOpen((prev) => !prev);
        return;
      }

      // Ctrl+K or Cmd+K: command palette / Spotlight
      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyK' || e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Ctrl/Cmd + Plus / NumpadAdd: increase the UI scale (zoom in)
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+' || e.code === 'NumpadAdd' || e.code === 'Equal')) {
        e.preventDefault();
        handleIncreaseScale();
        return;
      }

      // Ctrl/Cmd + Minus / NumpadSubtract: decrease the UI scale (zoom out)
      if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.code === 'Minus' || e.code === 'NumpadSubtract')) {
        e.preventDefault();
        handleDecreaseScale();
        return;
      }

      // Ctrl/Cmd + 0 / Numpad0: reset the UI scale to 100% (reset zoom)
      if ((e.ctrlKey || e.metaKey) && (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0')) {
        e.preventDefault();
        handleResetScale();
        return;
      }

      // F or Ctrl+F: jump to the Library search
      if (((e.code === 'KeyF' || e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey) || ((e.ctrlKey || e.metaKey) && (e.code === 'KeyF' || e.key === 'f' || e.key === 'F'))) {
        e.preventDefault();
        setActiveTab('library');
        setTimeout(() => {
          librarySearchInputRef?.current?.focus();
        }, 50);
        return;
      }

      // Digits 1-4: quickly switch app views
      if (e.key === '1') {
        setActiveTab('player');
      } else if (e.key === '2') {
        setActiveTab('library');
      } else if (e.key === '3') {
        setActiveTab('playlists');
      } else if (e.key === '4') {
        setActiveTab('dsp');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
