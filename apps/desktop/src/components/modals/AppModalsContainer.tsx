import type { AppTab } from '../../types/navigation';
import React from 'react';
import { invoke } from '../../api/ipc';
import { type Language, type Translations } from '../../i18n';
import {
  type TrackRecord,
  type AlbumRecord,
  type PlaybackStatus,
} from '../../types/player';
import { type EqualizerPreset } from '../../types/equalizer';
import { type QueueItem, type PlaybackQueue } from '../../types/queue';
import { type VolumeOsdPosition } from '../player/VolumeOsd';
import { DesktopLyricsOverlay } from '../player/DesktopLyricsOverlay';
import { formatTimeMs } from '../../utils/timeFormat';
import type { TrackStatsData } from './TrackStatsModal';

const PlaylistSelectModal = React.lazy(() => import('./PlaylistSelectModal').then((m) => ({ default: m.PlaylistSelectModal })));
const KeyboardShortcutsModal = React.lazy(() => import('./KeyboardShortcutsModal').then((m) => ({ default: m.KeyboardShortcutsModal })));
const CoverArtPickerModal = React.lazy(() => import('./CoverArtPickerModal').then((m) => ({ default: m.CoverArtPickerModal })));
const SleepTimerModal = React.lazy(() => import('./SleepTimerModal').then((m) => ({ default: m.SleepTimerModal })));
const AudioPathInspectorModal = React.lazy(() => import('./AudioPathInspectorModal').then((m) => ({ default: m.AudioPathInspectorModal })));
const AnalogLoFiModal = React.lazy(() => import('./AnalogLoFiModal').then((m) => ({ default: m.AnalogLoFiModal })));
const AudioHealthCheckModal = React.lazy(() => import('./AudioHealthCheckModal').then((m) => ({ default: m.AudioHealthCheckModal })));
const SoundscapeModal = React.lazy(() => import('./SoundscapeModal').then((m) => ({ default: m.SoundscapeModal })));
const HarmonicSuggesterModal = React.lazy(() => import('./HarmonicSuggesterModal').then((m) => ({ default: m.HarmonicSuggesterModal })));
const AutoEqModal = React.lazy(() => import('./AutoEqModal').then((m) => ({ default: m.AutoEqModal })));
const ParametricEqModal = React.lazy(() => import('./ParametricEqModal').then((m) => ({ default: m.ParametricEqModal })));
const DynamicsStudioModal = React.lazy(() => import('./DynamicsStudioModal').then((m) => ({ default: m.DynamicsStudioModal })));
const TrackStatsModal = React.lazy(() => import('./TrackStatsModal').then((m) => ({ default: m.TrackStatsModal })));
const LoopEditorModal = React.lazy(() => import('./LoopEditorModal').then((m) => ({ default: m.LoopEditorModal })));
const OnboardingModal = React.lazy(() => import('./OnboardingModal').then((m) => ({ default: m.OnboardingModal })));
const KeyBpmModal = React.lazy(() => import('./KeyBpmModal').then((m) => ({ default: m.KeyBpmModal })));
const MusicAnalysisModal = React.lazy(() => import('./MusicAnalysisModal').then((m) => ({ default: m.MusicAnalysisModal })));
const StemProjectStudioModal = React.lazy(() => import('./StemProjectStudioModal').then((m) => ({ default: m.StemProjectStudioModal })));
const CreateStemProjectModal = React.lazy(() => import('./CreateStemProjectModal').then((m) => ({ default: m.CreateStemProjectModal })));
const AuraluneRecapModal = React.lazy(() => import('./AuraluneRecapModal').then((m) => ({ default: m.AuraluneRecapModal })));
const TagEditorModal = React.lazy(() => import('./TagEditorModal').then((m) => ({ default: m.TagEditorModal })));
const CommandPaletteModal = React.lazy(() => import('./CommandPaletteModal').then((m) => ({ default: m.CommandPaletteModal })));
const UrlAudioImportModal = React.lazy(() => import('./UrlAudioImportModal').then((m) => ({ default: m.UrlAudioImportModal })));
const CueSheetModal = React.lazy(() => import('./CueSheetModal').then((m) => ({ default: m.CueSheetModal })));
const DownloadHubModal = React.lazy(() => import('./DownloadHubModal').then((m) => ({ default: m.DownloadHubModal })));
const TrackBookmarksModal = React.lazy(() => import('./TrackBookmarksModal').then((m) => ({ default: m.TrackBookmarksModal })));
const DuplicateFinderModal = React.lazy(() => import('./DuplicateFinderModal').then((m) => ({ default: m.DuplicateFinderModal })));
const FileRenamerModal = React.lazy(() => import('./FileRenamerModal').then((m) => ({ default: m.FileRenamerModal })));
const SaveQueueModal = React.lazy(() => import('./SaveQueueModal').then((m) => ({ default: m.SaveQueueModal })));
const AddRadioStationModal = React.lazy(() => import('./AddRadioStationModal').then((m) => ({ default: m.AddRadioStationModal })));
import { type AmbienceMode } from '../player/AnimeAmbienceFX';

export interface AppModalsContainerProps {
  language: Language;
  loc: Translations;
  status: PlaybackStatus;
  tracks: TrackRecord[];
  albums: AlbumRecord[];
  playlists: Array<{ id: number; name: string; track_count: number }>;
  currentPlayingTrack: TrackRecord | null;
  currentAlbum: AlbumRecord | null;
  currentCover: string | null;
  effectiveDisplayTitle: string;
  effectiveDisplayArtist: string;
  filePath: string;
  queue: PlaybackQueue;
  filteredTracks: TrackRecord[];
  activeTrackId: number | null;
  loopPointA: number | null;
  loopPointB: number | null;
  setLoopPointA: (ms: number | null) => void;
  setLoopPointB: (ms: number | null) => void;
  crossfadeDuration: number;

  // Modal Visibility State & Setters
  showPlaylistModal: boolean;
  setShowPlaylistModal: (open: boolean) => void;
  trackToAddToPlaylist: TrackRecord | null;
  setTrackToAddToPlaylist: (track: TrackRecord | null) => void;
  handleAddTrackToPlaylist: (playlistId: number, trackId: number) => void;

  isShortcutsModalOpen: boolean;
  setIsShortcutsModalOpen: (open: boolean) => void;

  coverPickerState: { isOpen: boolean; albumId: number; title: string; artist: string } | null;
  setCoverPickerState: (state: { isOpen: boolean; albumId: number; title: string; artist: string } | null) => void;
  setTrackDirectCover: (cover: string | null) => void;
  setAlbums: React.Dispatch<React.SetStateAction<AlbumRecord[]>>;
  loadLibrary: () => Promise<void>;

  showDesktopLyrics: boolean;
  setShowDesktopLyrics: (show: boolean) => void;

  isSleepTimerOpen: boolean;
  setIsSleepTimerOpen: (open: boolean) => void;
  sleepTimerRemainingSec: number | null;
  sleepTimerTargetMode: 'time' | 'end_of_track' | null;
  sleepTimerFadeOut: boolean;
  handleSetSleepTimer: (minutes: number | 'end_of_track', fadeOut: boolean) => void;
  handleCancelSleepTimer: () => void;

  isAudioPathModalOpen: boolean;
  setIsAudioPathModalOpen: (open: boolean) => void;
  handleResetBitPerfect: () => void;

  isLoFiModalOpen: boolean;
  setIsLoFiModalOpen: (open: boolean) => void;

  isHealthCheckModalOpen: boolean;
  setIsHealthCheckModalOpen: (open: boolean) => void;

  isSoundscapeOpen: boolean;
  setIsSoundscapeOpen: (open: boolean) => void;

  isHarmonicSuggesterOpen: boolean;
  setIsHarmonicSuggesterOpen: (open: boolean) => void;
  handleTempoChange: (tempo: number) => void | Promise<void>;
  handleNext: () => Promise<void>;
  handlePlayLibraryTrack: (track: TrackRecord) => void;
  handleAddTrackNextToQueue: (track: TrackRecord) => void;
  handleAddTrackToQueue: (track: TrackRecord) => void;
  handleCrossfadeDurationChange: (durationMs: number) => void;
  handleTrackKeyBpmUpdated: (trackId: number, bpm: number, keyName: string) => void;

  isAutoEqOpen: boolean;
  setIsAutoEqOpen: (open: boolean) => void;
  setEqPresets: React.Dispatch<React.SetStateAction<EqualizerPreset[]>>;
  setSelectedEqPreset: (preset: string) => void;
  setStatus: React.Dispatch<React.SetStateAction<PlaybackStatus>>;
  handleResetEq: () => void;

  isParametricEqOpen: boolean;
  setIsParametricEqOpen: (open: boolean) => void;

  isDynamicsStudioOpen: boolean;
  setIsDynamicsStudioOpen: (open: boolean) => void;

  statsModalTrack: TrackStatsData | null;
  setStatsModalTrack: (track: TrackStatsData | null) => void;
  handleResetTrackPlays: (trackId: number) => void;

  isLoopEditorOpen: boolean;
  setIsLoopEditorOpen: (open: boolean) => void;
  handleExportLoopFromModal: (a: number | null, b: number | null) => void;
  handleSaveLoopAsBookmarks: (a: number | null, b: number | null) => void;

  isOnboardingOpen: boolean;
  setIsOnboardingOpen: (open: boolean) => void;
  setLanguage: (lang: Language) => void;
  recapOptIn: boolean;
  setRecapOptIn: (opt: boolean) => void;
  instantVolume: boolean;
  setInstantVolume: (inst: boolean) => void;
  volumeOsdPosition: VolumeOsdPosition;
  setVolumeOsdPosition: (pos: VolumeOsdPosition) => void;

  isKeyBpmModalOpen: boolean;
  setIsKeyBpmModalOpen: (open: boolean) => void;
  handlePitchChange: (pitch: number) => void;

  isAnalysisModalOpen: boolean;
  setIsAnalysisModalOpen: (open: boolean) => void;
  analysisInitialTab: 'chords' | 'pianoroll' | 'stems' | 'projects' | 'models';

  isStemStudioOpen: boolean;
  setIsStemStudioOpen: (open: boolean) => void;
  activeStemProjectId: number | null;
  setActiveStemProjectId: (id: number | null) => void;

  isCreateStemProjectOpen: boolean;
  setIsCreateStemProjectOpen: (open: boolean) => void;
  createStemProjectTrack: TrackRecord | null;
  setCreateStemProjectTrack: (track: TrackRecord | null) => void;

  isRecapModalOpen: boolean;
  setIsRecapModalOpen: (open: boolean) => void;

  tagEditorTrack: TrackRecord | null;
  setTagEditorTrack: (track: TrackRecord | null) => void;

  isCommandPaletteOpen: boolean;
  setIsCommandPaletteOpen: (open: boolean) => void;
  handlePlayPause: () => void;
  handlePrevious: () => void;
  handleToggleShuffle: () => void;
  handleToggleStopAfterCurrent: () => void;
  setAmbienceMode: (mode: AmbienceMode) => void;
  handleEngineChange: (engine: any) => void;
  handleResetDsp: () => void;
  setIsBigScreen: (open: boolean) => void;
  setActiveTab: (tab: AppTab) => void;
  handleShuffleAll: () => void;

  isUrlImportModalOpen: boolean;
  setIsUrlImportModalOpen: (open: boolean) => void;
  setTracks: React.Dispatch<React.SetStateAction<TrackRecord[]>>;

  isCueModalOpen: boolean;
  setIsCueModalOpen: (open: boolean) => void;
  handleLoadFile: (filePath: string) => Promise<void>;
  handleSeek: (ms: number) => void;
  refreshQueue: () => Promise<void>;

  showDownloadHub: boolean;
  setShowDownloadHub: (show: boolean) => void;

  isBookmarksModalOpen: boolean;
  setIsBookmarksModalOpen: (open: boolean) => void;
  refreshTrackBookmarks: () => void | Promise<void>;

  isDuplicateFinderOpen: boolean;
  setIsDuplicateFinderOpen: (open: boolean) => void;

  isFileRenamerOpen: boolean;
  setIsFileRenamerOpen: (open: boolean) => void;

  isSaveQueueModalOpen: boolean;
  setIsSaveQueueModalOpen: (open: boolean) => void;
  handleConfirmSaveQueueAsPlaylist: (playlistName: string) => Promise<void>;

  isAddStationModalOpen: boolean;
  setIsAddStationModalOpen: (open: boolean) => void;
  handleSaveCustomStation: (station: { name: string; url: string; genre: string }) => void;

  showMessage: (msg: string, isError?: boolean) => void;
}

export const AppModalsContainer: React.FC<AppModalsContainerProps> = ({
  language,
  loc,
  status,
  tracks,
  albums,
  playlists,
  currentPlayingTrack,
  currentAlbum,
  currentCover,
  effectiveDisplayTitle,
  effectiveDisplayArtist,
  filePath,
  queue,
  filteredTracks,
  activeTrackId,
  loopPointA,
  loopPointB,
  setLoopPointA,
  setLoopPointB,
  crossfadeDuration,

  showPlaylistModal,
  setShowPlaylistModal,
  trackToAddToPlaylist,
  setTrackToAddToPlaylist,
  handleAddTrackToPlaylist,

  isShortcutsModalOpen,
  setIsShortcutsModalOpen,

  coverPickerState,
  setCoverPickerState,
  setTrackDirectCover,
  setAlbums,
  loadLibrary,

  showDesktopLyrics,
  setShowDesktopLyrics,

  isSleepTimerOpen,
  setIsSleepTimerOpen,
  sleepTimerRemainingSec,
  sleepTimerTargetMode,
  sleepTimerFadeOut,
  handleSetSleepTimer,
  handleCancelSleepTimer,

  isAudioPathModalOpen,
  setIsAudioPathModalOpen,
  handleResetBitPerfect,

  isLoFiModalOpen,
  setIsLoFiModalOpen,

  isHealthCheckModalOpen,
  setIsHealthCheckModalOpen,

  isSoundscapeOpen,
  setIsSoundscapeOpen,

  isHarmonicSuggesterOpen,
  setIsHarmonicSuggesterOpen,
  handleTempoChange,
  handleNext,
  handlePlayLibraryTrack,
  handleAddTrackNextToQueue,
  handleAddTrackToQueue,
  handleCrossfadeDurationChange,
  handleTrackKeyBpmUpdated,

  isAutoEqOpen,
  setIsAutoEqOpen,
  setEqPresets,
  setSelectedEqPreset,
  setStatus,
  handleResetEq,

  isParametricEqOpen,
  setIsParametricEqOpen,

  isDynamicsStudioOpen,
  setIsDynamicsStudioOpen,

  statsModalTrack,
  setStatsModalTrack,
  handleResetTrackPlays,

  isLoopEditorOpen,
  setIsLoopEditorOpen,
  handleExportLoopFromModal,
  handleSaveLoopAsBookmarks,

  isOnboardingOpen,
  setIsOnboardingOpen,
  setLanguage,
  recapOptIn,
  setRecapOptIn,
  instantVolume,
  setInstantVolume,
  volumeOsdPosition,
  setVolumeOsdPosition,

  isKeyBpmModalOpen,
  setIsKeyBpmModalOpen,
  handlePitchChange,

  isAnalysisModalOpen,
  setIsAnalysisModalOpen,
  analysisInitialTab,

  isStemStudioOpen,
  setIsStemStudioOpen,
  activeStemProjectId,
  setActiveStemProjectId,

  isCreateStemProjectOpen,
  setIsCreateStemProjectOpen,
  createStemProjectTrack,
  setCreateStemProjectTrack,

  isRecapModalOpen,
  setIsRecapModalOpen,

  tagEditorTrack,
  setTagEditorTrack,

  isCommandPaletteOpen,
  setIsCommandPaletteOpen,
  handlePlayPause,
  handlePrevious,
  handleToggleShuffle,
  handleToggleStopAfterCurrent,
  setAmbienceMode,
  handleEngineChange,
  handleResetDsp,
  setIsBigScreen,
  setActiveTab,
  handleShuffleAll,

  isUrlImportModalOpen,
  setIsUrlImportModalOpen,
  setTracks,

  isCueModalOpen,
  setIsCueModalOpen,
  handleLoadFile,
  handleSeek,
  refreshQueue,

  showDownloadHub,
  setShowDownloadHub,

  isBookmarksModalOpen,
  setIsBookmarksModalOpen,
  refreshTrackBookmarks,

  isDuplicateFinderOpen,
  setIsDuplicateFinderOpen,

  isFileRenamerOpen,
  setIsFileRenamerOpen,

  isSaveQueueModalOpen,
  setIsSaveQueueModalOpen,
  handleConfirmSaveQueueAsPlaylist,

  isAddStationModalOpen,
  setIsAddStationModalOpen,
  handleSaveCustomStation,

  showMessage,
}) => {
  return (
    <React.Suspense fallback={null}>
      {/* Modal dodawania utworu do playlisty */}
      <PlaylistSelectModal
        isOpen={showPlaylistModal}
        onClose={() => {
          setShowPlaylistModal(false);
          setTrackToAddToPlaylist(null);
        }}
        track={trackToAddToPlaylist}
        playlists={playlists}
        onSelectPlaylist={(playlistId, trackId) => {
          handleAddTrackToPlaylist(playlistId, trackId);
        }}
        loc={loc}
      />

      {/* Modal Skrótów Klawiszowych */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
        currentLang={language}
      />

      {/* Online Cover Art Picker Modal */}
      {coverPickerState && (
        <CoverArtPickerModal
          isOpen={coverPickerState.isOpen}
          onClose={() => setCoverPickerState(null)}
          albumId={coverPickerState.albumId}
          initialAlbum={coverPickerState.title}
          initialArtist={coverPickerState.artist}
          trackId={currentPlayingTrack?.id || null}
          currentLang={language}
          onCoverApplied={async (coverDataUri) => {
            setTrackDirectCover(coverDataUri);
            setAlbums((prev) =>
              prev.map((a) =>
                a.id === coverPickerState.albumId ? { ...a, cover_path: coverDataUri } : a
              )
            );
            showMessage(loc.notifications.mbCoverMatched.replace('{0}', coverPickerState.title));
            await loadLibrary();
          }}
        />
      )}

      {/* Pływający widżet tekstu na pulpicie (Desktop Lyrics Overlay) */}
      <DesktopLyricsOverlay
        isOpen={showDesktopLyrics}
        onClose={() => {
          setShowDesktopLyrics(false);
          try {
            localStorage.setItem('auralune_desktop_lyrics_open', 'false');
          } catch { }
        }}
        trackTitle={effectiveDisplayTitle}
        trackArtist={effectiveDisplayArtist}
        trackAlbum={currentAlbum?.title || status.current_track?.album || null}
        trackPath={currentPlayingTrack?.path || status.current_track?.uri || filePath || null}
        coverUrl={currentCover}
        durationMs={status.duration_ms}
        positionMs={status.position_ms}
        isPlaying={status.state === 'Playing'}
        currentLang={language}
        onPlayPause={handlePlayPause}
        onPrev={handlePrevious}
        onNext={handleNext}
        onSeek={handleSeek}
      />

      {/* Modal Wyłącznika Czasowego (Sleep Timer z łagodnym Fade-Out) */}
      <SleepTimerModal
        isOpen={isSleepTimerOpen}
        onClose={() => setIsSleepTimerOpen(false)}
        currentLang={language}
        remainingSec={sleepTimerRemainingSec}
        targetMode={sleepTimerTargetMode}
        fadeOut={sleepTimerFadeOut}
        onSetTimer={handleSetSleepTimer}
        onCancelTimer={handleCancelSleepTimer}
      />

      {/* Modal Inspektora Toru Audio & Bit-Perfect (Audio Path Inspector) */}
      <AudioPathInspectorModal
        isOpen={isAudioPathModalOpen}
        onClose={() => setIsAudioPathModalOpen(false)}
        status={status}
        currentTrack={currentPlayingTrack}
        currentLang={language}
        onResetBitPerfect={handleResetBitPerfect}
      />

      {/* Modal Studio Analogowego Lo-Fi FX (Winyl & Taśma) */}
      <AnalogLoFiModal
        isOpen={isLoFiModalOpen}
        onClose={() => setIsLoFiModalOpen(false)}
        isPlaying={status.state === 'Playing'}
        currentLang={language}
      />

      {/* Modal Testu Środowiska Audio (Health Check 1.0) */}
      <AudioHealthCheckModal
        isOpen={isHealthCheckModalOpen}
        onClose={() => setIsHealthCheckModalOpen(false)}
        currentLang={language}
      />

      {/* Modal Generatora Dźwięków Tła (Soundscape / Lofi Ambience) */}
      <SoundscapeModal
        isOpen={isSoundscapeOpen}
        onClose={() => setIsSoundscapeOpen(false)}
        currentLang={language}
      />

      {/* Modal Miksowania Harmonicznego & DJ Crossfade */}
      <HarmonicSuggesterModal
        isOpen={isHarmonicSuggesterOpen}
        onClose={() => setIsHarmonicSuggesterOpen(false)}
        currentTrack={
          currentPlayingTrack
            ? {
              id: currentPlayingTrack.id,
              uri: currentPlayingTrack.path,
              title: currentPlayingTrack.title,
              artist: currentPlayingTrack.artist,
              album: currentPlayingTrack.album_id
                ? albums.find((a) => a.id === currentPlayingTrack.album_id)?.title || null
                : null,
              duration_ms: currentPlayingTrack.duration_ms,
              bpm: currentPlayingTrack.bpm,
              initial_key: currentPlayingTrack.initial_key,
            }
            : status.current_track
              ? {
                id: status.current_track.track_id || 0,
                uri: status.current_track.uri,
                title: status.current_track.title,
                artist: status.current_track.artist,
                album: status.current_track.album,
                duration_ms: status.current_track.duration_ms,
                bpm:
                  tracks.find(
                    (t) =>
                      (status.current_track?.track_id && t.id === status.current_track.track_id) ||
                      t.path === status.current_track?.uri
                  )?.bpm || null,
                initial_key:
                  tracks.find(
                    (t) =>
                      (status.current_track?.track_id && t.id === status.current_track.track_id) ||
                      t.path === status.current_track?.uri
                  )?.initial_key || null,
              }
              : null
        }
        libraryTracks={tracks.map((t) => ({
          id: t.id,
          uri: t.path,
          title: t.title,
          artist: t.artist,
          album: t.album_id ? albums.find((a) => a.id === t.album_id)?.title || null : null,
          duration_ms: t.duration_ms,
          bpm: t.bpm,
          initial_key: t.initial_key,
        }))}
        onPlayTrack={async (ht) => {
          const fullTrack = tracks.find((t) => t.id === ht.id);
          if (fullTrack) {
            setIsHarmonicSuggesterOpen(false);
            if (status.state === 'Playing') {
              const curBpm =
                currentPlayingTrack?.bpm || tracks.find((t) => t.path === status.current_track?.uri)?.bpm;
              const targetBpm = fullTrack.bpm;
              if (curBpm && curBpm > 0 && targetBpm && targetBpm > 0) {
                const ratio = Math.min(1.25, Math.max(0.8, Math.round((targetBpm / curBpm) * 100) / 100));
                if (Math.abs(ratio - 1.0) > 0.01) {
                  await handleTempoChange(ratio);
                }
              }

              const matchingAlbum = albums.find((a) => a.id === fullTrack.album_id);
              const queueItem: QueueItem = {
                id: `mix-${fullTrack.id}-${Date.now()}`,
                track_id: fullTrack.id,
                uri: fullTrack.path,
                title: fullTrack.title,
                artist: fullTrack.artist,
                album: matchingAlbum?.title || null,
                duration_ms: (fullTrack.duration_ms || 0) as any,
              };

              await invoke('add_next_to_queue', { item: queueItem });
              await handleNext();
              showMessage(
                loc.notifications.djMixTransition
                  .replace('{0}', fullTrack.title)
                  .replace('{1}', (crossfadeDuration / 1000).toFixed(1))
              );
            } else {
              handlePlayLibraryTrack(fullTrack);
            }
          }
        }}
        onEnqueueTrack={(ht, playNext) => {
          const fullTrack = tracks.find((t) => t.id === ht.id);
          if (fullTrack) {
            if (playNext) {
              handleAddTrackNextToQueue(fullTrack);
            } else {
              handleAddTrackToQueue(fullTrack);
            }
          }
        }}
        onSyncTempo={(targetBpm) => {
          const curBpm = currentPlayingTrack?.bpm;
          if (curBpm && curBpm > 0) {
            const ratio = Math.min(3.0, Math.max(0.25, Math.round((targetBpm / curBpm) * 100) / 100));
            handleTempoChange(ratio);
            showMessage(
              loc.notifications.tempoMatched
                .replace('{0}', String(ratio))
                .replace('{1}', curBpm.toFixed(1))
                .replace('{2}', targetBpm.toFixed(1))
            );
          } else {
            showMessage(loc.notifications.noBpmDetected, true);
          }
        }}
        crossfadeDurationMs={crossfadeDuration}
        onSetCrossfadeDuration={handleCrossfadeDurationChange}
        onTrackKeyBpmUpdated={handleTrackKeyBpmUpdated}
        currentLang={language}
      />

      {/* Modal Bazy Profili Słuchawkowych AutoEQ */}
      <AutoEqModal
        isOpen={isAutoEqOpen}
        onClose={() => setIsAutoEqOpen(false)}
        currentBands={status.equalizer_bands || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]}
        onApplyProfile={async (bands, preampDb, profileName) => {
          try {
            await invoke('apply_auto_eq_profile', {
              profileName,
              bands,
              preampDb: preampDb || 0,
            });
            const autoEqLabel = `🎧 ${profileName} (AutoEQ)`;
            setEqPresets((prev) => {
              if (prev.some((p) => p.name === autoEqLabel)) return prev;
              return [...prev, { name: autoEqLabel, bands }];
            });
            setSelectedEqPreset(autoEqLabel);
            setStatus((prev: PlaybackStatus) => ({ ...prev, equalizer_bands: bands, equalizer_enabled: true }));
            showMessage(
              preampDb !== 0
                ? loc.notifications.autoEqAppliedWithPreamp
                    .replace('{0}', profileName)
                    .replace('{1}', preampDb.toFixed(1))
                : loc.notifications.autoEqApplied.replace('{0}', profileName)
            );
            setIsAutoEqOpen(false);
          } catch (e: unknown) {
            showMessage(`${loc.common.errorPrefix} ${e}`, true);
          }
        }}
        onResetFlat={handleResetEq}
        currentLang={language}
      />

      {/* Modal Wielopasmowego Korektora Parametrycznego PEQ Studio */}
      <ParametricEqModal
        isOpen={isParametricEqOpen}
        onClose={() => setIsParametricEqOpen(false)}
        currentLang={language}
      />

      {/* Modal Studia Dynamiki & Nasycenia Analogowego (Kompresor, Lampa, Taśma, Limiter) */}
      <DynamicsStudioModal
        isOpen={isDynamicsStudioOpen}
        onClose={() => setIsDynamicsStudioOpen(false)}
        currentLang={language}
      />

      {/* Modal Szczegółowych Statystyk Utworu */}
      {statsModalTrack && (
        <TrackStatsModal
          track={statsModalTrack}
          currentLang={language}
          onClose={() => setStatsModalTrack(null)}
          onResetPlays={handleResetTrackPlays}
        />
      )}

      {/* Modal Precyzyjnej Edycji Pętli A-B (co do milisekundy) */}
      <LoopEditorModal
        isOpen={isLoopEditorOpen}
        onClose={() => setIsLoopEditorOpen(false)}
        loopPointA={loopPointA}
        loopPointB={loopPointB}
        currentPositionMs={status.position_ms}
        durationMs={status.duration_ms}
        onApplyLoop={(a, b) => {
          setLoopPointA(a);
          setLoopPointB(b);
          if (a !== null && b !== null) {
            showMessage(
              loc.notifications.loopSetRange
                .replace('{0}', formatTimeMs(a))
                .replace('{1}', formatTimeMs(b))
                .replace('{2}', String(b - a))
            );
          } else {
            showMessage(loc.shortcuts.loopClear);
          }
        }}
        onSeek={handleSeek}
        onExportLoop={handleExportLoopFromModal}
        onSaveAsTrackBookmarks={handleSaveLoopAsBookmarks}
        loc={loc}
      />

      {/* Kreator pierwszego uruchomienia i wprowadzenie (Onboarding & Disclaimer) */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        currentLang={language}
        onLanguageChange={setLanguage}
        recapOptIn={recapOptIn}
        onRecapOptInChange={(opt) => {
          setRecapOptIn(opt);
          try {
            localStorage.setItem('auralune_recap_opt_in', String(opt));
          } catch { }
        }}
        instantVolume={instantVolume}
        onInstantVolumeChange={(inst) => {
          setInstantVolume(inst);
          try {
            localStorage.setItem('auralune_instant_volume', String(inst));
          } catch { }
        }}
        volumeOsdPosition={volumeOsdPosition}
        onVolumeOsdPositionChange={(pos) => {
          setVolumeOsdPosition(pos as VolumeOsdPosition);
          try {
            localStorage.setItem('auralune_volume_osd_position', pos);
          } catch { }
        }}
      />

      {/* Menu / Modal Tonacji i Tempa (Key & BPM A/B DSP) */}
      <KeyBpmModal
        isOpen={isKeyBpmModalOpen}
        onClose={() => setIsKeyBpmModalOpen(false)}
        currentTrackTitle={currentPlayingTrack?.title || status.current_track?.title || undefined}
        currentTrackId={activeTrackId || status.current_track?.track_id || undefined}
        currentTrackPath={currentPlayingTrack?.path || status.current_track?.uri || filePath || undefined}
        pitchSemitones={status.pitch_semitones ?? 0}
        tempoRatio={status.tempo_ratio ?? 1}
        rateRatio={status.rate_ratio ?? 1}
        onPitchChange={handlePitchChange}
        onTempoChange={handleTempoChange}
        onTrackKeyBpmUpdated={handleTrackKeyBpmUpdated}
        currentLang={language}
      />

      {/* Studio Analizy Muzycznej (Akordy, Piano-Roll, Stemy, Modele AI) */}
      <MusicAnalysisModal
        isOpen={isAnalysisModalOpen}
        onClose={() => setIsAnalysisModalOpen(false)}
        trackId={activeTrackId || status.current_track?.track_id || undefined}
        trackPath={currentPlayingTrack?.path || status.current_track?.uri || filePath || undefined}
        trackTitle={currentPlayingTrack?.title || status.current_track?.title || undefined}
        trackArtist={currentPlayingTrack?.artist || status.current_track?.artist || undefined}
        currentTimeMs={status.position_ms}
        durationMs={status.duration_ms ?? undefined}
        pitchSemitones={status.pitch_semitones ?? 0}
        onSeek={handleSeek}
        onSetLoop={(start, end) => {
          setLoopPointA(start);
          setLoopPointB(end);
        }}
        initialTab={analysisInitialTab}
        onOpenStemProject={(pid) => {
          setIsAnalysisModalOpen(false);
          setActiveStemProjectId(pid);
          setIsStemStudioOpen(true);
        }}
        onOpenCreateProject={() => {
          setIsAnalysisModalOpen(false);
          setCreateStemProjectTrack(currentPlayingTrack || null);
          setIsCreateStemProjectOpen(true);
        }}
        currentLang={language}
      />

      {/* Moises-Style Stem Project Studio Modal */}
      {isStemStudioOpen && activeStemProjectId && (
        <StemProjectStudioModal
          isOpen={isStemStudioOpen}
          onClose={() => setIsStemStudioOpen(false)}
          projectId={activeStemProjectId}
          currentTimeMs={status.position_ms}
          durationMs={status.duration_ms ?? undefined}
          isPlaying={status.state === 'Playing'}
          onPlayPause={handlePlayPause}
          onSeek={handleSeek}
          currentLang={language}
        />
      )}

      {/* Tworzenie nowego projektu stemów */}
      <CreateStemProjectModal
        isOpen={isCreateStemProjectOpen}
        onClose={() => setIsCreateStemProjectOpen(false)}
        track={createStemProjectTrack}
        onProjectCreated={(newProjectId) => {
          setActiveStemProjectId(newProjectId);
          setIsStemStudioOpen(true);
        }}
        currentLang={language}
      />

      {/* Podsumowanie Tygodnia, Miesiąca i Roku (Auralune Recap / Wrapped) */}
      <AuraluneRecapModal
        isOpen={isRecapModalOpen}
        onClose={() => setIsRecapModalOpen(false)}
        currentLang={language}
        onPlayTrackId={(id) => {
          const tr = tracks.find((t) => t.id === id);
          if (tr) handlePlayLibraryTrack(tr);
        }}
      />

      {/* Modal Edytora Tagów (foobar2000 style Properties) */}
      {tagEditorTrack && (
        <TagEditorModal
          trackId={tagEditorTrack.id}
          filePath={tagEditorTrack.path}
          format={tagEditorTrack.format}
          bitDepth={tagEditorTrack.bit_depth}
          sampleRate={tagEditorTrack.sample_rate}
          channels={tagEditorTrack.channels}
          fileSize={tagEditorTrack.file_size}
          currentLang={language}
          onClose={() => setTagEditorTrack(null)}
          onSaveSuccess={() => {
            loadLibrary();
            showMessage(loc.tagEditor.successMsg);
          }}
        />
      )}

      {/* Modal Palety Komend (Ctrl+K omnibar) */}
      {isCommandPaletteOpen && (
        <CommandPaletteModal
          tracks={tracks}
          albums={albums}
          isPlaying={status.state === 'Playing'}
          currentLang={language}
          stopAfterCurrent={status.stop_after_current ?? false}
          onClose={() => setIsCommandPaletteOpen(false)}
          onPlayTrack={(t) => handlePlayLibraryTrack(t)}
          onAddToQueue={(t) => handleAddTrackToQueue(t)}
          onTogglePlay={handlePlayPause}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onToggleShuffle={handleToggleShuffle}
          onToggleStopAfterCurrent={handleToggleStopAfterCurrent}
          onOpenUrlImportModal={() => setIsUrlImportModalOpen(true)}
          onSetAmbience={(m) => {
            setAmbienceMode(m);
            localStorage.setItem('auralune_ambience_mode', m);
          }}
          onSetDspEngine={(eng) => handleEngineChange(eng)}
          onResetDsp={handleResetDsp}
          onOpenBigScreen={() => setIsBigScreen(true)}
          onOpenReplayGainScanner={() => {
            setActiveTab('devices');
          }}
          onOpenSoundscape={() => setIsSoundscapeOpen(true)}
          onOpenHarmonicSuggester={() => setIsHarmonicSuggesterOpen(true)}
          onOpenAutoEq={() => setIsAutoEqOpen(true)}
          onOpenParametricEq={() => setIsParametricEqOpen(true)}
          onOpenDynamicsStudio={() => setIsDynamicsStudioOpen(true)}
          onShuffleAll={() => handleShuffleAll()}
          onOpenHealthCheck={() => setIsHealthCheckModalOpen(true)}
          onSelectTab={(tab) => setActiveTab(tab)}
        />
      )}

      {/* Modal Wbudowanego Importera Audio z URL (yt-dlp) */}
      <UrlAudioImportModal
        isOpen={isUrlImportModalOpen}
        currentLang={language}
        onClose={() => setIsUrlImportModalOpen(false)}
        onPlayTrack={(t) => handlePlayLibraryTrack(t)}
        onAddToQueue={(t) => handleAddTrackToQueue(t)}
        onLibraryUpdated={async () => {
          try {
            const updatedTracks = await invoke<TrackRecord[]>('get_library_tracks');
            const updatedAlbums = await invoke<AlbumRecord[]>('get_library_albums');
            setTracks(updatedTracks);
            setAlbums(updatedAlbums);
          } catch { }
        }}
      />

      {/* Modal Arkusza CUE (.cue sheet) */}
      {isCueModalOpen && (
        <CueSheetModal
          currentLang={language}
          onClose={() => setIsCueModalOpen(false)}
          onPlayCueTrack={(audioFile, cueTrack) => {
            let targetPath = audioFile;
            const matching = tracks.find((t) => t.path.endsWith(audioFile) || t.path.includes(audioFile));
            if (matching) {
              targetPath = matching.path;
            }
            handleLoadFile(targetPath).then(async () => {
              await invoke('play');
              handleSeek(cueTrack.start_offset_ms);
            });
            showMessage(
              loc.notifications.cuePlaybackStarted
                .replace('{0}', cueTrack.title)
                .replace('{1}', String(cueTrack.number))
            );
          }}
          onAddCueTracksToQueue={async (audioFile, cueTracks) => {
            let targetPath = audioFile;
            const matching = tracks.find((t) => t.path.endsWith(audioFile) || t.path.includes(audioFile));
            if (matching) {
              targetPath = matching.path;
            }
            const matchingAlb = matching?.album_id ? albums.find((a) => a.id === matching.album_id) : null;
            for (const ct of cueTracks) {
              const item: QueueItem = {
                id: `cue-${ct.number}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                track_id: matching?.id ?? null,
                uri: targetPath,
                title: ct.title,
                artist: ct.performer || matching?.artist || 'Unknown',
                album: matchingAlb?.title || null,
                duration_ms: ct.duration_ms || 180000,
              };
              await invoke('add_to_queue', { item });
            }
            await refreshQueue();
            showMessage(loc.notifications.cueTracksAdded.replace('{0}', String(cueTracks.length)));
          }}
        />
      )}

      {/* MODAL 10: LEGAL DOWNLOAD HUB (ETAP 7) */}
      <DownloadHubModal
        isOpen={showDownloadHub}
        onClose={() => setShowDownloadHub(false)}
        onRefreshLibrary={loadLibrary}
        onPlayPath={(path) => {
          handleLoadFile(path).then(async () => {
            await invoke('play');
          });
        }}
        currentLang={language}
      />

      {/* Modal Wielopunktowych Zakładek (Cue Points) */}
      {isBookmarksModalOpen && activeTrackId && (
        <TrackBookmarksModal
          trackId={activeTrackId}
          trackTitle={status.current_track?.title || filePath || loc.player.track}
          currentPositionMs={status.position_ms}
          durationMs={status.duration_ms}
          onSeek={(posMs) => handleSeek(posMs)}
          onClose={() => setIsBookmarksModalOpen(false)}
          onBookmarksUpdated={refreshTrackBookmarks}
          onExportRange={(startMs, endMs) => {
            if (startMs !== null && endMs !== null) {
              handleExportLoopFromModal(startMs, endMs);
            }
          }}
          onSetAsLoop={(startMs, endMs) => {
            if (startMs !== null) setLoopPointA(startMs);
            if (endMs !== null) setLoopPointB(endMs);
            if (startMs !== null && endMs !== null) {
              showMessage(
                loc.notifications.loopSetMarkers
                  .replace('{0}', formatTimeMs(startMs))
                  .replace('{1}', formatTimeMs(endMs))
              );
            }
          }}
          currentLang={language}
        />
      )}

      {/* Modal Wyszukiwarki Duplikatów (Duplicate Finder) */}
      {isDuplicateFinderOpen && (
        <DuplicateFinderModal
          onClose={() => setIsDuplicateFinderOpen(false)}
          onPlayTrack={(path) => {
            handleLoadFile(path).then(async () => {
              await invoke('play');
            });
          }}
          onLibraryChanged={loadLibrary}
          currentLang={language}
        />
      )}

      {/* Modal Masowego Renamera Plików (foobar2000 File Ops) */}
      {isFileRenamerOpen && (
        <FileRenamerModal
          tracks={filteredTracks.map((t) => ({
            id: t.id,
            title: t.title,
            artist: t.artist,
            path: t.path,
          }))}
          onClose={() => setIsFileRenamerOpen(false)}
          onRenamedSuccess={() => {
            loadLibrary();
            showMessage(loc.fileRenamer.renameSuccess.replace('{0}', '').replace('  ', ' ').trim());
          }}
          currentLang={language}
        />
      )}

      {/* Modal Zapisywania Kolejki jako Playlisty */}
      <SaveQueueModal
        isOpen={isSaveQueueModalOpen}
        currentLang={language}
        queueLength={queue.items.length}
        onClose={() => setIsSaveQueueModalOpen(false)}
        onSave={handleConfirmSaveQueueAsPlaylist}
      />

      {/* Modal Dodawania Własnej Stacji Radiowej */}
      <AddRadioStationModal
        isOpen={isAddStationModalOpen}
        currentLang={language}
        onClose={() => setIsAddStationModalOpen(false)}
        onSave={handleSaveCustomStation}
      />
    </React.Suspense>
  );
};
