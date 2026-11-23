import type { AppTab } from '../types/navigation';
import { useEffect, useRef } from "react";
import type { PlaybackStatus } from "../types/player";
import type { getTranslations } from "../i18n";
import { fmt } from '../utils/fmt';
import { stepVolume } from '../utils/volumeScale';
import type { VolumeUnit } from './useVolumeUnit';

export interface UseHotkeysManagerProps {
  statusRef: React.MutableRefObject<PlaybackStatus>;
  handlePlayPause: () => void;
  handleNext: () => void;
  handlePrevious: () => void;
  handleSeek: (ms: number) => void;
  handleVolumeChange: (vol: number) => void;
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
  volumeUnit: VolumeUnit;
  showMessage: (msg: string, isError?: boolean) => void;
  t: ReturnType<typeof getTranslations>;
  librarySearchInputRef?: React.RefObject<HTMLInputElement | null>;
}

export function useHotkeysManager(props: UseHotkeysManagerProps) {
  // Nasłuch klawiatury rejestrowany jest raz; handler czyta najnowsze propsy z ref.
  // Wcześniej efekt z pustą listą zależności zamrażał wartości z pierwszego renderu
  // (np. tłumaczenia po zmianie języka i format jednostki głośności).
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
        volumeUnit,
        showMessage,
        t,
        librarySearchInputRef,
      } = propsRef.current;
      const activeEl = document.activeElement as HTMLElement | null;
      const activeTag = (activeEl?.tagName || '').toLowerCase();
      const isRangeInput = activeTag === 'input' && (activeEl as HTMLInputElement)?.type === 'range';
      const isTextInput = (activeTag === 'input' && !isRangeInput) || activeTag === 'textarea' || activeEl?.isContentEditable;

      // Klawisz Escape zamyka okna modalne, szufladę kolejki, tryb pełnoekranowy lub usuwa focus z pól tekstowych
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

      // Jeśli użytkownik wprowadza tekst, nie przechwytujemy skrótów odtwarzacza
      if (isTextInput) {
        return;
      }

      // Jeśli aktywny jest suwak (input range, np. suwak głośności, seek lub parametrów DSP),
      // klawisze strzałek w górę/dół normalnie zmieniają wartość natywnie o 1%.
      // Usuwamy natychmiast focus z suwaka i blokujemy domyślny event, aby zadziałał globalny skrót odtwarzacza (np. głośność ±5%, seek ±5s, spacja).
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

      // Spacja: Odtwarzaj / Wstrzymaj (Play / Pause)
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        handlePlayPause();
        return;
      }

      // Strzałka w prawo: przewijanie do przodu o 5s (lub Następny przy Ctrl)
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

      // Strzałka w lewo: przewijanie w tył o 5s (lub Poprzedni przy Ctrl)
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

      // Strzałka w górę: Głośność +5%
      if (e.code === 'ArrowUp' || e.key === 'ArrowUp') {
        e.preventDefault();
        const newVol = stepVolume(statusRef.current.volume, 1, volumeUnit);
        handleVolumeChange(newVol);
        const formatted = formatVolumeValue(newVol);
        showMessage(fmt(t.notifications.volumeMsg.replace('{0}%', formatted), formatted));
        return;
      }

      // Strzałka w dół: Głośność -5%
      if (e.code === 'ArrowDown' || e.key === 'ArrowDown') {
        e.preventDefault();
        const newVol = stepVolume(statusRef.current.volume, -1, volumeUnit);
        handleVolumeChange(newVol);
        const formatted = formatVolumeValue(newVol);
        showMessage(fmt(t.notifications.volumeMsg.replace('{0}%', formatted), formatted));
        return;
      }

      // Klawisz F2 lub Shift + M: Przełącznik Mini-Player
      if (e.code === 'F2' || (e.code === 'KeyM' && e.shiftKey) || (e.key === 'M' && e.shiftKey)) {
        e.preventDefault();
        toggleMiniPlayer();
        return;
      }

      // Klawisz F11: Pełny ekran Kiosk / Big Screen
      if (e.code === 'F11') {
        e.preventDefault();
        setIsBigScreen((prev) => !prev);
        return;
      }

      // Klawisz M: Mute / Unmute
      if (e.code === 'KeyM' || e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        const currentVol = statusRef.current.volume;
        const newVol = currentVol === 0 ? 1.0 : 0;
        handleVolumeChange(newVol);
        showMessage(newVol === 0 ? t.notifications.mutedMsg : t.notifications.unmutedMsg);
        return;
      }

      // Klawisze [ i ]: Zmiana wysokości dźwięku (Pitch Shift -1 / +1 półton)
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

      // Klawisze - i +: Zmiana tempa (Tempo Stretch -5% / +5%)
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

      // Klawisz 0: Reset parametrów DSP do stanu neutralnego
      if (e.key === '0' || e.code === 'Digit0') {
        e.preventDefault();
        handleResetDsp();
        return;
      }

      // Klawisz S: Przełącznik odtwarzania losowego (Shuffle)
      if (e.code === 'KeyS' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        handleToggleShuffle();
        return;
      }

      // Klawisz L: Cykliczne przełączanie trybu pętli (Loop Off -> Track -> Queue)
      if (e.code === 'KeyL' || e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        handleCycleLoopMode();
        return;
      }

      // Klawisze A, B, C: Punkty pętli A-B oraz wyczyszczenie
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

      // Klawisz ?: Okno skrótów klawiszowych
      if (e.key === '?' || (e.key === '/' && e.shiftKey) || (e.code === 'Slash' && e.shiftKey)) {
        e.preventDefault();
        setIsShortcutsModalOpen((prev) => !prev);
        return;
      }

      // Klawisz T: Przełącznik tekstów piosenek (Lyrics)
      if (e.code === 'KeyT' || e.key === 't' || e.key === 'T') {
        e.preventDefault();
        setShowLyrics((prev) => !prev);
        return;
      }

      // Klawisz N: Następny utwór
      if (e.code === 'KeyN' || e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        handleNext();
        return;
      }

      // Klawisz P: Poprzedni utwór
      if (e.code === 'KeyP' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        handlePrevious();
        return;
      }

      // Klawisz Q: Przełącznik szuflady kolejki
      if (e.code === 'KeyQ' || e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        setIsQueueOpen((prev) => !prev);
        return;
      }

      // Ctrl+K lub Cmd+K: Paleta komend / Spotlight
      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyK' || e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Ctrl/Cmd + Plus / NumpadAdd: Zwiększ skalę interfejsu (Zoom in)
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+' || e.code === 'NumpadAdd' || e.code === 'Equal')) {
        e.preventDefault();
        handleIncreaseScale();
        return;
      }

      // Ctrl/Cmd + Minus / NumpadSubtract: Zmniejsz skalę interfejsu (Zoom out)
      if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.code === 'Minus' || e.code === 'NumpadSubtract')) {
        e.preventDefault();
        handleDecreaseScale();
        return;
      }

      // Ctrl/Cmd + 0 / Numpad0: Resetuj skalę interfejsu do 100% (Reset zoom)
      if ((e.ctrlKey || e.metaKey) && (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0')) {
        e.preventDefault();
        handleResetScale();
        return;
      }

      // Klawisz F lub Ctrl+F: Skocz do wyszukiwarki w Bibliotece
      if (((e.code === 'KeyF' || e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey) || ((e.ctrlKey || e.metaKey) && (e.code === 'KeyF' || e.key === 'f' || e.key === 'F'))) {
        e.preventDefault();
        setActiveTab('library');
        setTimeout(() => {
          librarySearchInputRef?.current?.focus();
        }, 50);
        return;
      }

      // Cyfry 1-4: Szybkie przełączanie widoków aplikacji
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
