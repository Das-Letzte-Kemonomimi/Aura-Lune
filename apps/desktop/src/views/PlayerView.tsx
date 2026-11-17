import React from "react";
import {
  BarChart3,
  Bookmark,
  BookmarkPlus,
  CassetteTape,
  Check,
  ChevronDown,
  ChevronUp,
  Disc,
  Disc3,
  FolderOpen,
  Gauge,
  Heart,
  Image as ImageIcon,
  Infinity as InfinityIcon,
  Keyboard,
  ListMusic,
  Mic2,
  Moon,
  Music,
  Pause,
  Play,
  Plus,
  Radio,
  Repeat,
  Repeat1,
  RotateCcw,
  Search,
  Settings,
  Shuffle,
  SkipBack,
  SkipForward,
  Sliders,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { LyricsView } from "../components/LyricsView";
import { TapeDeckWidget, type TapeType } from "../components/TapeDeckWidget";
import { VinylTurntable } from "../components/VinylTurntable";
import { VuMeterWidget } from "../components/VuMeterWidget";
import { WaveformCanvas } from "../components/WaveformCanvas";
import { SpectrumVisualizer } from "../components/SpectrumVisualizer";
import type { AlbumRecord, TrackRecord, PlaybackStatus, SampleTrackDto } from "../types/player";
import {
  type QueueItem,
  type PlaybackQueue,
  type QueueColumnConfig,
  getQueueGridTemplate,
} from "../types/queue";
import type { TrackBookmarkDto } from "../components/TrackBookmarksModal";
import type { DspCombinationInfo } from "./DspStudioView";
import { type Language, getTranslations } from "../i18n";

export interface PlayerViewProps {
  layoutMaxWidth: string;
  language: Language;
  loc: ReturnType<typeof getTranslations>;
  status: PlaybackStatus;
  activeTrackId?: number | null;
  currentPlayingTrack?: TrackRecord | null;
  tracks: TrackRecord[];
  albums: AlbumRecord[];
  currentAlbum?: AlbumRecord | null;
  currentCover?: string | null;
  cleanLiveTitle?: string | null;
  effectiveDisplayTitle: string;
  effectiveDisplayArtist: string;
  filePath: string | null;
  setFilePath: (p: any) => void;
  seekProgressPercent: number;
  volumeProgressPercent: number;
  volumeUnit: "percent" | "db";
  formatVolumeValue: (vol: number, unit?: "percent" | "db") => string;
  handleToggleVolumeUnit: () => void;
  seekFadeEnabled: boolean;
  handleToggleSeekFade: () => void;
  infinityQueue: boolean;
  handleToggleInfinityQueue: () => void;
  sleepTimerRemainingSec: number | null;
  sleepTimerTargetMode: "time" | "end_of_track" | null;
  setIsSleepTimerOpen: (v: boolean) => void;
  setIsAudioPathModalOpen: (v: boolean) => void;
  setIsLoFiModalOpen: (v: boolean) => void;
  setIsShortcutsModalOpen: (v: boolean) => void;
  setIsLoopEditorOpen: (v: boolean) => void;
  setIsBookmarksModalOpen: (v: boolean) => void;
  setIsSaveQueueModalOpen: (v: boolean) => void;
  setStatsModalTrack: (t: TrackRecord | null) => void;
  setActiveTab: (tab: any) => void;
  showLyrics: boolean;
  setShowLyrics: (v: boolean | ((p: boolean) => boolean)) => void;
  nowPlayingVisualMode: "cover" | "turntable" | "tape" | "vumeter";
  handleSelectNowPlayingVisualMode: (m: "cover" | "turntable" | "tape" | "vumeter") => void;
  vinylRpm: 33 | 45;
  handleSelectVinylRpm: (rpm: 33 | 45) => void;
  tapeSpeed: "7.5" | "3.75";
  handleSelectTapeSpeed: (s: "7.5" | "3.75") => void;
  tapeType: TapeType;
  handleSelectTapeType: (t: TapeType) => void;
  activeDspVibe: "nightcore" | "slowed" | "vocal" | "bass" | "flat" | null;
  handleApplyDspVibe: (v: "nightcore" | "slowed" | "vocal" | "bass" | "flat") => void | Promise<void>;
  dspBadgeText: string;
  dspBadgeTitle: string;
  dspCombination: DspCombinationInfo;
  lastActiveDspEngineRef: React.MutableRefObject<string>;
  trackWaveformPeaks: number[] | null;
  loopPointA: number | null;
  setLoopPointA: (v: number | null) => void;
  loopPointB: number | null;
  setLoopPointB: (v: number | null) => void;
  currentBookmark: number | null;
  currentTrackBookmarks: TrackBookmarkDto[];
  handleSaveBookmark: () => void | Promise<void>;
  handleDeleteBookmark: (e?: React.MouseEvent) => void | Promise<void>;
  handleJumpToBookmark: (pos: number) => void | Promise<void>;
  queue: PlaybackQueue;
  filteredQueueItems: { it: QueueItem; originalIdx: number }[];
  queueSearchQuery: string;
  setQueueSearchQuery: (q: string) => void;
  queueColumns: QueueColumnConfig;
  isColumnConfigOpen: boolean;
  setIsColumnConfigOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  toggleQueueColumn: (key: keyof QueueColumnConfig) => void;
  resetQueueColumns: () => void;
  isQuickLoadOpen: boolean;
  setIsQuickLoadOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  draggedQueueIdx: number | null;
  dragOverQueueIdx: number | null;
  handleQueueDragStart: (idx: number, e: React.DragEvent) => void;
  handleQueueDragOver: (idx: number, e: React.DragEvent) => void;
  handleQueueDrop: (idx: number, e: React.DragEvent) => void;
  handleMoveQueueItem: (from: number, to: number, e?: React.MouseEvent) => void | Promise<void>;
  handlePlayQueueIndex: (idx: number, item?: QueueItem) => void;
  handleRemoveFromQueue: (id: string, e?: React.MouseEvent) => void | Promise<void>;
  handleClearQueue: () => void;
  totalQueueDurationMs: number;
  formatTotalDuration: (ms: number) => string;
  queueListRef: React.RefObject<HTMLDivElement | null>;
  queueStartIndex: number;
  queueEndIndex: number;
  queueTopSpacer: number;
  queueBottomSpacer: number;
  handleSeek: (ms: number) => void;
  handlePlayPause: () => void;
  handleStop: () => void;
  handlePrevious: () => void;
  handleNext: () => void;
  handleToggleShuffle: () => void;
  handleCycleLoopMode: () => void;
  handleToggleStopAfterCurrent: () => void;
  handleToggleMute: () => void;
  handleVolumeChange: (vol: number) => void;
  handlePitchChange: (st: number) => void;
  handleTempoChange: (t: number) => void;
  handleEngineChange: (engine: any) => void;
  handleToggleFavorite: (trackId: number, e?: React.MouseEvent) => void;
  handleOpenContainingFolder: (path: string, e?: React.MouseEvent) => void;
  handleOpenCoverPicker: (album: AlbumRecord) => void;
  handleUploadCustomCoverDirect: (album?: AlbumRecord | null) => void;
  handleRestoreOriginalTrack: () => void;
  handleLoadFile: (path: string) => void | Promise<void>;
  handlePickFiles: () => void;
  formatTime: (ms: number) => string;
  formatTimeMs: (ms: number) => string;
  showMessage: (msg: string, isError?: boolean) => void;
}

export const PlayerView: React.FC<PlayerViewProps> = ({
  layoutMaxWidth,
  language,
  loc,
  status,
  activeTrackId,
  currentPlayingTrack,
  tracks,
  albums,
  currentAlbum,
  currentCover,
  cleanLiveTitle,
  effectiveDisplayTitle,
  effectiveDisplayArtist,
  filePath,
  setFilePath,
  seekProgressPercent,
  volumeProgressPercent,
  volumeUnit,
  formatVolumeValue,
  handleToggleVolumeUnit,
  seekFadeEnabled,
  handleToggleSeekFade,
  infinityQueue,
  handleToggleInfinityQueue,
  sleepTimerRemainingSec,
  sleepTimerTargetMode,
  setIsSleepTimerOpen,
  setIsAudioPathModalOpen,
  setIsLoFiModalOpen,
  setIsShortcutsModalOpen,
  setIsLoopEditorOpen,
  setIsBookmarksModalOpen,
  setIsSaveQueueModalOpen,
  setStatsModalTrack,
  setActiveTab,
  showLyrics,
  setShowLyrics,
  nowPlayingVisualMode,
  handleSelectNowPlayingVisualMode,
  vinylRpm,
  handleSelectVinylRpm,
  tapeSpeed,
  handleSelectTapeSpeed,
  tapeType,
  handleSelectTapeType,
  activeDspVibe,
  handleApplyDspVibe,
  dspBadgeText,
  dspBadgeTitle,
  dspCombination,
  lastActiveDspEngineRef,
  trackWaveformPeaks,
  loopPointA,
  setLoopPointA,
  loopPointB,
  setLoopPointB,
  currentBookmark,
  currentTrackBookmarks,
  handleSaveBookmark,
  handleDeleteBookmark,
  handleJumpToBookmark,
  queue,
  filteredQueueItems,
  queueSearchQuery,
  setQueueSearchQuery,
  queueColumns,
  isColumnConfigOpen,
  setIsColumnConfigOpen,
  toggleQueueColumn,
  resetQueueColumns,
  isQuickLoadOpen,
  setIsQuickLoadOpen,
  draggedQueueIdx,
  dragOverQueueIdx,
  handleQueueDragStart,
  handleQueueDragOver,
  handleQueueDrop,
  handleMoveQueueItem,
  handlePlayQueueIndex,
  handleRemoveFromQueue,
  handleClearQueue,
  totalQueueDurationMs,
  formatTotalDuration,
  queueListRef,
  queueStartIndex,
  queueEndIndex,
  queueTopSpacer,
  queueBottomSpacer,
  handleSeek,
  handlePlayPause,
  handleStop,
  handlePrevious,
  handleNext,
  handleToggleShuffle,
  handleCycleLoopMode,
  handleToggleStopAfterCurrent,
  handleToggleMute,
  handleVolumeChange,
  handlePitchChange,
  handleTempoChange,
  handleEngineChange,
  handleToggleFavorite,
  handleOpenContainingFolder,
  handleOpenCoverPicker,
  handleUploadCustomCoverDirect,
  handleRestoreOriginalTrack,
  handleLoadFile,
  handlePickFiles,
  formatTime,
  formatTimeMs,
  showMessage,
}) => {
  const t = loc;

  const getQueueTrackMeta = (item: QueueItem) => {
    const tr = tracks.find(
      (t) =>
        (item.track_id != null && t.id === item.track_id) ||
        t.path === item.uri
    );
    let al = tr && tr.album_id ? albums.find((a) => a.id === tr.album_id) : null;
    if (!al && item.album) {
      const albTitle = item.album.trim().toLowerCase();
      al = albums.find((a) => a.title.trim().toLowerCase() === albTitle) || null;
    }
    const ext = item.uri.split('.').pop()?.toUpperCase() || 'AUDIO';
    return {
      track: tr,
      album: al,
      cover: al?.cover_path || null,
      format: tr?.format || ext,
      sampleRate: tr?.sample_rate,
      bitDepth: tr?.bit_depth,
    };
  };

  return (
            <div style={{ maxWidth: layoutMaxWidth, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '32px' }}>
              <div className="glass-panel" style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Górny pasek narzędziowy: silnik audio i dyskretny przycisk otwarcia pliku */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setIsAudioPathModalOpen(true)}
                      title={language === 'pl' ? 'Kliknij, aby otworzyć Audio Path & Bit-Perfect Stream Inspector' : 'Click to inspect Bit-Perfect Audio Signal Path'}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        background: status.engine === 'Bypass' && !status.equalizer_enabled
                          ? 'rgba(16, 185, 129, 0.15)'
                          : 'rgba(6, 182, 212, 0.15)',
                        border: status.engine === 'Bypass' && !status.equalizer_enabled
                          ? '1px solid rgba(16, 185, 129, 0.45)'
                          : '1px solid rgba(6, 182, 212, 0.45)',
                        color: status.engine === 'Bypass' && !status.equalizer_enabled
                          ? '#34d399'
                          : 'var(--accent-cyan)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      }}
                    >
                      <Radio size={13} /> PipeWire {status.engine === 'Bypass' && !status.equalizer_enabled ? 'Bit-Perfect' : 'Hi-Fi'} • {status.engine}
                    </button>

                    {status.equalizer_enabled && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 9px',
                          borderRadius: '20px',
                          background: 'rgba(168, 85, 247, 0.15)',
                          border: '1px solid rgba(168, 85, 247, 0.35)',
                          color: 'var(--accent-purple)',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                        }}
                      >
                        10-Band EQ
                      </span>
                    )}
                  </div>

                  {/* Dyskretne otwieranie pliku zamiast wielkiego pola tekstowego */}
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setIsQuickLoadOpen(!isQuickLoadOpen)}
                      className="glass-card"
                      style={{
                        padding: '7px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '7px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: isQuickLoadOpen ? 'var(--accent-pink)' : 'var(--text-secondary)',
                        border: isQuickLoadOpen ? '1px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                      }}
                      title={loc.player.quickLoadHint}
                    >
                      <FolderOpen size={15} />
                      <span>{loc.player.openFile}</span>
                    </button>

                    {/* Zwijany elegancki dropdown szybkiego ładowania */}
                    {isQuickLoadOpen && (
                      <div
                        className="glass-panel"
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: '100%',
                          marginTop: '8px',
                          width: '380px',
                          padding: '16px',
                          zIndex: 50,
                          boxShadow: '0 16px 36px rgba(0, 0, 0, 0.65)',
                          border: '1px solid var(--border-accent)',
                          borderRadius: '14px',
                          background: 'var(--bg-surface)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>{loc.player.quickLoadTitle}</span>
                          <button
                            onClick={() => setIsQuickLoadOpen(false)}
                            style={{ background: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                          >
                            <X size={15} />
                          </button>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                          <input
                            type="text"
                            value={filePath || ''}
                            onChange={(e) => setFilePath(e.target.value)}
                            placeholder="tests/fixtures/test_sine_440hz.wav"
                            style={{
                              flex: 1,
                              padding: '8px 12px',
                              borderRadius: '8px',
                              border: '1px solid var(--border-subtle)',
                              background: 'rgba(0,0,0,0.4)',
                              color: '#fff',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.8rem',
                            }}
                          />
                          <button
                            onClick={() => {
                              handleLoadFile(filePath || '');
                              setIsQuickLoadOpen(false);
                            }}
                            style={{
                              padding: '8px 14px',
                              borderRadius: '8px',
                              background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                              color: '#fff',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                            }}
                          >
                            {loc.player.load}
                          </button>
                        </div>

                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                            {loc.player.testSamples}
                          </span>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={async () => {
                                try {
                                  const sample = await invoke<SampleTrackDto | null>('get_sample_track');
                                  if (sample) {
                                    setFilePath(sample.path);
                                    handleLoadFile(sample.path);
                                  }
                                } catch (e) {
                                  console.warn('Błąd ładowania próbki Skrzydła Białe:', e);
                                }
                                setIsQuickLoadOpen(false);
                              }}
                              className="glass-card"
                              style={{ flex: 1, padding: '6px 10px', fontSize: '0.75rem', color: 'var(--accent-pink)', textAlign: 'center', fontWeight: 600 }}
                            >
                              🌸 Skrzydła Białe
                            </button>
                            <button
                              onClick={() => {
                                setFilePath('tests/fixtures/test_sine_440hz.wav');
                                handleLoadFile('tests/fixtures/test_sine_440hz.wav');
                                setIsQuickLoadOpen(false);
                              }}
                              className="glass-card"
                              style={{ flex: 1, padding: '6px 10px', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}
                            >
                              WAV 440 Hz
                            </button>
                            <button
                              onClick={() => {
                                setFilePath('tests/fixtures/test_sine_440hz.opus');
                                handleLoadFile('tests/fixtures/test_sine_440hz.opus');
                                setIsQuickLoadOpen(false);
                              }}
                              className="glass-card"
                              style={{ flex: 1, padding: '6px 10px', fontSize: '0.75rem', color: 'var(--accent-cyan)', textAlign: 'center' }}
                            >
                              Opus 48 kHz
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Główny pulpit odtwarzacza: układ 2-kolumnowy (Okładka/Winyl + Kontrolki & Spektrogram) */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: nowPlayingVisualMode === 'cover' ? '240px 1fr' : '275px 1fr',
                    gap: '26px',
                    alignItems: 'center',
                    transition: 'grid-template-columns 0.2s ease',
                  }}
                >
                  {/* Kolumna lewa: Okładka / Winyl / Tape / VU-Meter */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                    {/* Selektor trybu wizualnego: Okładka • Winyl Hi-Fi • Taśma • Wskaźnik VU */}
                    <div
                      style={{
                        display: 'flex',
                        gap: '4px',
                        marginBottom: '10px',
                        background: 'rgba(0, 0, 0, 0.35)',
                        padding: '3px',
                        borderRadius: '8px',
                        width: '100%',
                        maxWidth: nowPlayingVisualMode === 'cover' ? '240px' : '275px',
                        transition: 'max-width 0.2s ease',
                      }}
                    >
                      <button
                        onClick={() => handleSelectNowPlayingVisualMode('cover')}
                        style={{
                          flex: 1,
                          padding: '4px 6px',
                          borderRadius: '6px',
                          border: 'none',
                          background: nowPlayingVisualMode === 'cover' ? 'var(--accent-pink)' : 'transparent',
                          color: nowPlayingVisualMode === 'cover' ? '#fff' : 'var(--text-muted)',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                        }}
                      >
                        <Disc size={13} /> {language === 'pl' ? 'Okładka' : 'Cover'}
                      </button>
                      <button
                        onClick={() => handleSelectNowPlayingVisualMode('turntable')}
                        style={{
                          flex: 1,
                          padding: '4px 6px',
                          borderRadius: '6px',
                          border: 'none',
                          background: nowPlayingVisualMode === 'turntable' ? 'var(--accent-pink)' : 'transparent',
                          color: nowPlayingVisualMode === 'turntable' ? '#fff' : 'var(--text-muted)',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                        }}
                      >
                        <Disc3 size={13} /> {language === 'pl' ? 'Winyl' : 'Vinyl'}
                      </button>
                      <button
                        onClick={() => handleSelectNowPlayingVisualMode('tape')}
                        style={{
                          flex: 1,
                          padding: '4px 6px',
                          borderRadius: '6px',
                          border: 'none',
                          background: nowPlayingVisualMode === 'tape' ? 'var(--accent-pink)' : 'transparent',
                          color: nowPlayingVisualMode === 'tape' ? '#fff' : 'var(--text-muted)',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                        }}
                      >
                        <CassetteTape size={13} /> {language === 'pl' ? 'Taśma' : 'Tape'}
                      </button>
                      <button
                        onClick={() => handleSelectNowPlayingVisualMode('vumeter')}
                        style={{
                          flex: 1,
                          padding: '4px 6px',
                          borderRadius: '6px',
                          border: 'none',
                          background: nowPlayingVisualMode === 'vumeter' ? 'var(--accent-pink)' : 'transparent',
                          color: nowPlayingVisualMode === 'vumeter' ? '#fff' : 'var(--text-muted)',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                        }}
                      >
                        <Gauge size={13} /> VU
                      </button>
                    </div>

                    {nowPlayingVisualMode === 'turntable' ? (
                      <VinylTurntable
                        coverUrl={currentCover}
                        isPlaying={status.state === 'Playing'}
                        tempo={status.tempo_ratio ?? 1.0}
                        rate={status.rate_ratio ?? 1.0}
                        engine={status.engine}
                        isDspActive={status.engine !== 'Bypass'}
                        bpm={
                          currentPlayingTrack?.bpm ||
                          tracks.find(
                            (t) =>
                              (status.current_track?.track_id && t.id === status.current_track.track_id) ||
                              t.path === status.current_track?.uri
                          )?.bpm ||
                          null
                        }
                        trackTitle={status.current_track?.title || currentPlayingTrack?.title}
                        artistName={status.current_track?.artist || currentPlayingTrack?.artist}
                        onTogglePlayPause={handlePlayPause}
                        rpm={vinylRpm}
                        onRpmChange={handleSelectVinylRpm}
                        onOpenLoFi={() => setIsLoFiModalOpen(true)}
                        size={265}
                      />
                    ) : nowPlayingVisualMode === 'tape' ? (
                      <TapeDeckWidget
                        isPlaying={status.state === 'Playing'}
                        positionMs={status.position_ms ?? 0}
                        durationMs={status.current_track?.duration_ms ?? 180000}
                        tempo={status.tempo_ratio ?? 1.0}
                        rate={status.rate_ratio ?? 1.0}
                        engine={status.engine}
                        isDspActive={status.engine !== 'Bypass'}
                        trackTitle={status.current_track?.title || currentPlayingTrack?.title}
                        artistName={status.current_track?.artist || currentPlayingTrack?.artist}
                        tapeType={tapeType}
                        onTapeTypeChange={handleSelectTapeType}
                        tapeSpeed={tapeSpeed}
                        onTapeSpeedChange={handleSelectTapeSpeed}
                        onOpenLoFi={() => setIsLoFiModalOpen(true)}
                        size={265}
                      />
                    ) : nowPlayingVisualMode === 'vumeter' ? (
                      <VuMeterWidget
                        spectrum={status.spectrum}
                        volume={status.volume}
                        isPlaying={status.state === 'Playing'}
                        style={{ width: '100%', height: '175px' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '220px',
                          height: '220px',
                          borderRadius: '20px',
                          position: 'relative',
                          overflow: 'hidden',
                          background: currentCover
                            ? `url("${currentCover}") center/cover no-repeat`
                            : 'radial-gradient(circle at center, #1e1b4b 0%, #0f172a 60%, #030712 100%)',
                          boxShadow: status.state === 'Playing'
                            ? '0 0 28px rgba(244, 63, 94, 0.45), 0 0 50px rgba(168, 85, 247, 0.3)'
                            : 'var(--shadow-card)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'box-shadow 0.3s ease',
                          willChange: 'transform',
                          transform: 'translateZ(0)',
                        }}
                      >
                        {!currentCover && (
                          <div
                            style={{
                              width: '188px',
                              height: '188px',
                              borderRadius: '50%',
                              background: 'radial-gradient(circle, #0b0f19 35%, #182032 50%, #0f172a 75%, #050811 100%)',
                              border: '2px solid rgba(255, 255, 255, 0.08)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: 'inset 0 0 18px rgba(0,0,0,0.85), 0 0 10px rgba(0,0,0,0.5)',
                              animation: status.state === 'Playing' ? 'spin 12s linear infinite' : 'none',
                            }}
                          >
                            {/* Centrum winylu z logo Kitsune */}
                            <div
                              style={{
                                width: '64px',
                                height: '64px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '3px solid rgba(0,0,0,0.6)',
                                boxShadow: '0 0 10px rgba(244, 63, 94, 0.5)',
                              }}
                            >
                              <Disc size={28} color="#fff" />
                            </div>
                          </div>
                        )}

                        {/* Badge formatu na okładce */}
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '10px',
                            right: '10px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: 'rgba(0, 0, 0, 0.88)',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            color: 'var(--accent-cyan)',
                            border: '1px solid rgba(6, 182, 212, 0.35)',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {status.current_track?.duration_ms ? 'HI-RES AUDIO' : 'PIPEWIRE'}
                        </div>
                      </div>
                    )}

                    {/* Przyciski lub kontrolki pod elementem wizualnym w zależności od trybu */}
                    {nowPlayingVisualMode === 'cover' ? (
                      <div style={{ marginTop: '10px', display: 'flex', gap: '8px', width: '100%', maxWidth: '240px' }}>
                        <button
                          onClick={() => {
                            if (currentAlbum) {
                              handleOpenCoverPicker(currentAlbum);
                            } else {
                              const trackAlbum = currentPlayingTrack?.album_id
                                ? albums.find((a) => a.id === currentPlayingTrack.album_id)?.title
                                : null;
                              const targetTitle =
                                status.current_track?.album ||
                                trackAlbum ||
                                status.current_track?.title ||
                                currentPlayingTrack?.title ||
                                'Unknown Album';
                              const targetArtist =
                                status.current_track?.artist ||
                                currentPlayingTrack?.artist ||
                                'Unknown Artist';
                              handleOpenCoverPicker({
                                id: 0,
                                title: targetTitle,
                                album_artist: targetArtist,
                                year: null,
                                cover_path: null,
                                release_mbid: null,
                              });
                            }
                          }}
                          title={loc.covers.matchCoverTitle}
                          style={{
                            flex: 1,
                            padding: '7px 8px',
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.2), rgba(168, 85, 247, 0.2))',
                            border: '1px solid rgba(244, 63, 94, 0.35)',
                            color: '#fff',
                            fontSize: '0.73rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px',
                            transition: 'all 0.2s',
                          }}
                        >
                          <Sparkles size={12} color="var(--accent-pink)" /> {loc.covers.matchCover}
                        </button>
                        <button
                          onClick={() => handleUploadCustomCoverDirect(currentAlbum)}
                          title={loc.covers.uploadCustomCover}
                          style={{
                            flex: 1,
                            padding: '7px 8px',
                            borderRadius: '8px',
                            background: 'rgba(6, 182, 212, 0.15)',
                            border: '1px solid rgba(6, 182, 212, 0.35)',
                            color: '#fff',
                            fontSize: '0.73rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px',
                            transition: 'all 0.2s',
                          }}
                        >
                          <Upload size={12} color="var(--accent-cyan)" /> {loc.covers.uploadCustomCover}
                        </button>
                      </div>
                    ) : nowPlayingVisualMode === 'turntable' ? (
                      <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'center', width: '100%' }}>
                        <div
                          title={dspBadgeTitle}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            background: 'rgba(0, 0, 0, 0.4)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-muted)',
                            fontSize: '0.68rem',
                            fontFamily: 'var(--font-mono)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            flexWrap: 'wrap',
                            justifyContent: 'center',
                            textAlign: 'center',
                          }}
                        >
                          <Disc3 size={11} color="var(--accent-pink)" />
                          {status.state === 'Playing'
                            ? (language === 'pl'
                              ? `${vinylRpm === 33 ? '33⅓' : '45'} RPM • Ramię opuszczone (${dspBadgeText})`
                              : `${vinylRpm === 33 ? '33⅓' : '45'} RPM • Tonearm Engaged (${dspBadgeText})`)
                            : (language === 'pl' ? `Pauza • ${vinylRpm === 33 ? '33⅓' : '45'} RPM • Ramię zaparkowane` : `Paused • ${vinylRpm === 33 ? '33⅓' : '45'} RPM • Tonearm Parked`)}
                        </div>
                      </div>
                    ) : nowPlayingVisualMode === 'tape' ? (
                      <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'center', width: '100%' }}>
                        <div
                          title={dspBadgeTitle}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            background: 'rgba(0, 0, 0, 0.4)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-muted)',
                            fontSize: '0.68rem',
                            fontFamily: 'var(--font-mono)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            flexWrap: 'wrap',
                            justifyContent: 'center',
                            textAlign: 'center',
                          }}
                        >
                          <CassetteTape size={11} color="var(--accent-pink)" />
                          {status.state === 'Playing'
                            ? (language === 'pl'
                              ? `${tapeSpeed === '7.5' ? '7½' : '3¾'} IPS • ${tapeType === 'TYPE_I' ? 'FE-I' : tapeType === 'TYPE_II' ? 'CR-II' : 'METAL'} • Rolka zaciśnięta (${dspBadgeText})`
                              : `${tapeSpeed === '7.5' ? '7.5' : '3.75'} IPS • ${tapeType === 'TYPE_I' ? 'FE-I' : tapeType === 'TYPE_II' ? 'CR-II' : 'METAL'} • Pinch Roller Engaged (${dspBadgeText})`)
                            : (language === 'pl' ? `Pauza • ${tapeSpeed === '7.5' ? '7½' : '3¾'} IPS • ${tapeType === 'TYPE_I' ? 'FE-I' : tapeType === 'TYPE_II' ? 'CR-II' : 'METAL'} • Transport zatrzymany` : `Paused • ${tapeSpeed === '7.5' ? '7.5' : '3.75'} IPS • ${tapeType === 'TYPE_I' ? 'FE-I' : tapeType === 'TYPE_II' ? 'CR-II' : 'METAL'} • Transport Stopped`)}
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          marginTop: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          width: '100%',
                          maxWidth: '280px',
                          padding: '0 4px',
                        }}
                      >
                        <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          0 VU = +4 dBu (1.23V)
                        </span>
                        <span
                          style={{
                            fontSize: '0.66rem',
                            color: status.state === 'Playing' ? 'var(--accent-green)' : 'var(--text-muted)',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <span
                            style={{
                              width: '5px',
                              height: '5px',
                              borderRadius: '50%',
                              background: status.state === 'Playing' ? 'var(--accent-green)' : 'var(--text-muted)',
                              boxShadow: status.state === 'Playing' ? '0 0 6px var(--accent-green)' : 'none',
                            }}
                          />
                          {status.state === 'Playing'
                            ? (language === 'pl' ? 'Miernik aktywny' : 'Meter Active')
                            : (language === 'pl' ? 'Czuwanie' : 'Standby')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Kolumna prawa: Tytuł, Wykonawca, Spektrogram, Seeker i Przyciski */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background:
                              status.state === 'Playing'
                                ? 'var(--accent-green)'
                                : status.state === 'Paused'
                                  ? 'var(--accent-amber)'
                                  : 'var(--text-muted)',
                            boxShadow: status.state === 'Playing' ? '0 0 8px var(--accent-green)' : 'none',
                          }}
                        />
                        <span
                          style={{
                            fontSize: '0.72rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            color: 'var(--text-muted)',
                            fontWeight: 700,
                          }}
                        >
                          {status.state === 'Playing' ? loc.player.statePlaying : status.state === 'Paused' ? loc.player.statePaused : loc.player.stateStopped}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <h3
                            style={{
                              margin: 0,
                              fontSize: '1.35rem',
                              fontWeight: 800,
                              color: '#fff',
                              letterSpacing: '-0.02em',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {effectiveDisplayTitle}
                          </h3>
                          <p
                            style={{
                              margin: '4px 0 0 0',
                              fontSize: '0.88rem',
                              color: 'var(--accent-pink)',
                              fontWeight: 600,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {effectiveDisplayArtist} {currentAlbum?.title || status.current_track?.album ? `• ${currentAlbum?.title || status.current_track?.album}` : ''}
                          </p>
                          {cleanLiveTitle && (
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                marginTop: '6px',
                                padding: '3px 10px',
                                borderRadius: '12px',
                                background: 'rgba(236, 72, 153, 0.15)',
                                border: '1px solid rgba(236, 72, 153, 0.35)',
                                color: 'var(--accent-pink)',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                              }}
                            >
                              <span
                                style={{
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  background: '#ff4757',
                                  boxShadow: '0 0 8px #ff4757',
                                }}
                              />
                              <span>LIVE: {cleanLiveTitle}</span>
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <button
                            onClick={() => {
                              if (currentPlayingTrack) {
                                setStatsModalTrack(currentPlayingTrack);
                              } else if (status.current_track) {
                                setStatsModalTrack({
                                  id: status.current_track.track_id || 0,
                                  title: status.current_track.title || (filePath ? filePath.split('/').pop() || 'Auralune Audio Player' : 'Auralune Audio Player'),
                                  artist: status.current_track.artist || loc.player.unknownArtist,
                                  album_artist: status.current_track.artist || null, album_id: null, disc_no: null, track_no: null, bit_depth: null, file_size: 0, modified_time: 0,
                                  path: status.current_track.uri || filePath || '',
                                  duration_ms: status.duration_ms || 0,
                                  format: 'AUDIO',
                                  sample_rate: 44100,
                                  channels: 2,
                                  play_count: 0,
                                  last_played_at: null,
                                });
                              }
                            }}
                            title={loc.player.trackStats}
                            style={{
                              background: 'rgba(245, 158, 11, 0.15)',
                              border: '1px solid rgba(245, 158, 11, 0.35)',
                              borderRadius: '8px',
                              color: 'var(--accent-amber)',
                              padding: '6px 12px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              transition: 'all 0.2s ease',
                            }}
                          >
                            <BarChart3 size={16} />
                            <span>{currentPlayingTrack?.play_count || 0} {loc.player.plays}</span>
                          </button>

                          {currentPlayingTrack && (
                            <button
                              onClick={(e) => handleToggleFavorite(currentPlayingTrack.id, e)}
                              title={currentPlayingTrack.is_favorite ? loc.player.favoriteRemove : loc.player.favoriteAdd}
                              style={{
                                background: currentPlayingTrack.is_favorite ? 'rgba(255, 77, 148, 0.22)' : 'rgba(255, 255, 255, 0.06)',
                                border: currentPlayingTrack.is_favorite ? '1px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
                                borderRadius: '8px',
                                color: currentPlayingTrack.is_favorite ? 'var(--accent-pink)' : 'var(--text-muted)',
                                padding: '6px 12px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                transition: 'all 0.2s ease',
                              }}
                            >
                              <Heart size={16} fill={currentPlayingTrack.is_favorite ? 'var(--accent-pink)' : 'none'} />
                              {currentPlayingTrack.is_favorite ? loc.player.favoriteRemove : loc.player.favoriteAdd}
                            </button>
                          )}

                          {(currentPlayingTrack?.path || status.current_track?.uri || filePath) && (
                            <button
                              onClick={(e) =>
                                handleOpenContainingFolder(
                                  currentPlayingTrack?.path || status.current_track?.uri || filePath || '',
                                  e
                                )
                              }
                              title={loc.queue.openContainingFolder}
                              style={{
                                background: 'rgba(6, 182, 212, 0.15)',
                                border: '1px solid rgba(6, 182, 212, 0.35)',
                                borderRadius: '8px',
                                color: 'var(--accent-cyan)',
                                padding: '6px 12px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                transition: 'all 0.2s ease',
                              }}
                            >
                              <FolderOpen size={15} />
                              <span>Dolphin</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Żywy animowany Canvas Spectrum Visualizer */}
                    <SpectrumVisualizer
                      spectrum={status.spectrum}
                      isPlaying={status.state === 'Playing'}
                    />

                    {/* Szybkie Profile Klimatyczne DSP (Quick DSP Vibes) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', margin: '2px 0 0 0' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em' }}>
                        {t.quickVibes.label}
                      </span>
                      {[
                        { id: 'nightcore', label: t.quickVibes.nightcore, desc: t.quickVibes.nightcoreDesc },
                        { id: 'slowed', label: t.quickVibes.slowed, desc: t.quickVibes.slowedDesc },
                        { id: 'vocal', label: t.quickVibes.vocal, desc: t.quickVibes.vocalDesc },
                        { id: 'bass', label: t.quickVibes.bass, desc: t.quickVibes.bassDesc },
                        { id: 'flat', label: t.quickVibes.flat, desc: t.quickVibes.flatDesc },
                      ].map((v) => {
                        const isSelected = activeDspVibe === v.id;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => handleApplyDspVibe(v.id as any)}
                            title={v.desc}
                            style={{
                              padding: '5px 12px',
                              borderRadius: '16px',
                              fontSize: '0.74rem',
                              fontWeight: isSelected ? 700 : 600,
                              background: isSelected
                                ? 'linear-gradient(135deg, rgba(244, 63, 94, 0.35), rgba(168, 85, 247, 0.35))'
                                : 'rgba(255, 255, 255, 0.05)',
                              border: isSelected
                                ? '1px solid var(--accent-pink)'
                                : '1px solid var(--border-subtle)',
                              color: isSelected ? '#fff' : 'var(--text-secondary)',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              boxShadow: isSelected ? '0 0 14px rgba(244, 63, 94, 0.45)' : undefined,
                            }}
                          >
                            {isSelected && (
                              <span
                                style={{
                                  display: 'inline-block',
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  background: 'var(--accent-pink)',
                                  boxShadow: '0 0 6px var(--accent-pink)',
                                }}
                              />
                            )}
                            {v.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Pasek postępu z pętlą A-B i wizualizacją przebiegu utworu (Waveform) */}
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '6px',
                          fontSize: '0.78rem',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {formatTime(status.position_ms)}
                          </span>
                          {/* Wskaźnik prędkości i transpozycji DSP jeśli tempo, szybkość lub pitch jest modyfikowane */}
                          {(dspCombination.hasTempo || dspCombination.hasRate || dspCombination.hasPitch) && (
                            <span
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: 'rgba(168, 85, 247, 0.25)',
                                color: 'var(--accent-purple)',
                                border: '1px solid rgba(168, 85, 247, 0.45)',
                              }}
                              title={`DSP (${dspCombination.engine}): Σ Speed ${dspCombination.totalSpeedRatio.toFixed(2)}x, Σ Pitch ${dspCombination.totalPitchSemitones > 0 ? `+${dspCombination.totalPitchSemitones.toFixed(2)}` : dspCombination.totalPitchSemitones.toFixed(2)}st (Tempo: ${dspCombination.tempoRatio.toFixed(2)}x, Pitch: ${dspCombination.pitchSt.toFixed(2)}st, Rate: ${dspCombination.rateRatio.toFixed(2)}x)`}
                            >
                              DSP {dspCombination.totalSpeedRatio !== 1.0 ? `${dspCombination.totalSpeedRatio.toFixed(2)}x` : ''}
                              {dspCombination.totalSpeedRatio !== 1.0 && Math.abs(dspCombination.totalPitchSemitones) > 0.005 ? ', ' : ''}
                              {Math.abs(dspCombination.totalPitchSemitones) > 0.005 ? `${dspCombination.totalPitchSemitones > 0 ? `+${dspCombination.totalPitchSemitones.toFixed(2)}` : dspCombination.totalPitchSemitones.toFixed(2)}st` : ''}
                            </span>
                          )}
                          {(loopPointA !== null || loopPointB !== null) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span
                                onClick={() => setIsLoopEditorOpen(true)}
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  background: loopPointA !== null && loopPointB !== null ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                                  color: loopPointA !== null && loopPointB !== null ? 'var(--accent-cyan)' : '#fbbf24',
                                  border: loopPointA !== null && loopPointB !== null ? '1px solid rgba(6, 182, 212, 0.45)' : '1px solid rgba(251, 191, 36, 0.4)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                                title={`${loc.player.editLoop || (language === 'pl' ? 'Edytuj pętlę A-B' : 'Edit A-B loop')} (${language === 'pl' ? 'Kliknij, aby edytować milisekundy' : 'Click to edit milliseconds'})`}
                              >
                                <span>🔁 {loc.player.loopAB}:</span>
                                <span style={{ color: 'var(--accent-cyan)' }}>{loopPointA !== null ? formatTimeMs(loopPointA) : '0:00.000'}</span>
                                <span>→</span>
                                <span style={{ color: 'var(--accent-pink)' }}>{loopPointB !== null ? formatTimeMs(loopPointB) : '—'}</span>
                                {loopPointA !== null && loopPointB !== null && loopPointB > loopPointA && (
                                  <span style={{ opacity: 0.85, fontSize: '0.62rem' }}>
                                    ({((loopPointB - loopPointA) / 1000).toFixed(1)}s)
                                  </span>
                                )}
                              </span>
                              <button
                                onClick={() => {
                                  setLoopPointA(null);
                                  setLoopPointB(null);
                                  showMessage(language === 'pl' ? 'Wyczyszczono pętlę A-B (Skrót: C)' : 'Cleared A-B loop (Key: C)');
                                }}
                                style={{
                                  padding: '1px 5px',
                                  fontSize: '0.65rem',
                                  background: 'rgba(244, 63, 94, 0.2)',
                                  border: '1px solid rgba(244, 63, 94, 0.45)',
                                  color: '#ff6b81',
                                  borderRadius: '3px',
                                  cursor: 'pointer',
                                }}
                                title={loc.player.clearLoop || (language === 'pl' ? 'Wyczyść pętlę A-B' : 'Clear A-B loop')}
                              >
                                ✕
                              </button>
                            </div>
                          )}

                          {/* Przełącznik płynnego wyciszenia paska postępu (Fade Seek) */}
                          <button
                            onClick={handleToggleSeekFade}
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '1px 8px',
                              borderRadius: '4px',
                              background: seekFadeEnabled ? 'rgba(236, 72, 153, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                              color: seekFadeEnabled ? 'var(--accent-pink)' : 'var(--text-muted)',
                              border: seekFadeEnabled ? '1px solid rgba(236, 72, 153, 0.45)' : '1px solid var(--border-subtle)',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                            title={loc.player.seekFadeDesc}
                          >
                            {seekFadeEnabled ? loc.player.seekFadeOn : loc.player.seekFadeOff}
                          </button>
                        </div>
                        <span>{status.duration_ms ? formatTime(status.duration_ms) : '--:--'}</span>
                      </div>

                      {/* Wizualizacja przebiegu utworu (Waveform) - interaktywna fala zsynchronizowana z DSP */}
                      <WaveformCanvas
                        peaks={trackWaveformPeaks || []}
                        progress={status.duration_ms && status.duration_ms > 0 ? (status.position_ms / status.duration_ms) * 100 : 0}
                        durationMs={status.duration_ms || 0}
                        positionMs={status.position_ms || 0}
                        loopPointA={loopPointA}
                        loopPointB={loopPointB}
                        isPlaying={status.state === 'Playing'}
                        height={66}
                        colorPlayedStart="#f43f5e"
                        colorPlayedEnd="#a855f7"
                        currentLang={language}
                        onSeek={(pct) => {
                          if (status.duration_ms && status.duration_ms > 0) {
                            handleSeek(Math.floor(pct * status.duration_ms));
                          }
                        }}
                        title={`${loc.waveform.title} (${loc.waveform.hint})`}
                        style={{ marginBottom: '10px' }}
                      />

                      {/* Kontener suwaka z podświetleniem pętli A-B oraz znacznikiem zakładki */}
                      <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
                        {loopPointA !== null && loopPointB !== null && status.duration_ms && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              left: `${(loopPointA / status.duration_ms) * 100}%`,
                              width: `${Math.max(2, ((loopPointB - loopPointA) / status.duration_ms) * 100)}%`,
                              height: '8px',
                              borderRadius: '4px',
                              background: 'linear-gradient(90deg, rgba(6, 182, 212, 0.65), rgba(244, 63, 94, 0.65))',
                              boxShadow: '0 0 10px rgba(6, 182, 212, 0.6)',
                              pointerEvents: 'none',
                              zIndex: 1,
                            }}
                          />
                        )}
                        {loopPointA !== null && status.duration_ms && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSeek(loopPointA);
                              showMessage(language === 'pl' ? `Skok do Punktu A: ${formatTimeMs(loopPointA)}` : `Jump to Point A: ${formatTimeMs(loopPointA)}`);
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setIsLoopEditorOpen(true);
                            }}
                            style={{
                              position: 'absolute',
                              top: '-16px',
                              left: `${(loopPointA / status.duration_ms) * 100}%`,
                              transform: 'translateX(-50%)',
                              fontSize: '0.62rem',
                              fontWeight: 800,
                              color: 'var(--accent-cyan)',
                              background: '#090d16',
                              border: '1px solid var(--accent-cyan)',
                              borderRadius: '3px',
                              padding: '0 4px',
                              cursor: 'pointer',
                              zIndex: 2,
                            }}
                            title={language === 'pl' ? `Punkt A: ${formatTimeMs(loopPointA)} (${loopPointA} ms) - kliknij, aby skoczyć (podwójny klik: edytor)` : `Point A: ${formatTimeMs(loopPointA)} (${loopPointA} ms) - click to jump (double click: editor)`}
                          >
                            A
                          </div>
                        )}
                        {loopPointB !== null && status.duration_ms && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSeek(loopPointB);
                              showMessage(language === 'pl' ? `Skok do Punktu B: ${formatTimeMs(loopPointB)}` : `Jump to Point B: ${formatTimeMs(loopPointB)}`);
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setIsLoopEditorOpen(true);
                            }}
                            style={{
                              position: 'absolute',
                              top: '-16px',
                              left: `${(loopPointB / status.duration_ms) * 100}%`,
                              transform: 'translateX(-50%)',
                              fontSize: '0.62rem',
                              fontWeight: 800,
                              color: 'var(--accent-pink)',
                              background: '#090d16',
                              border: '1px solid var(--accent-pink)',
                              borderRadius: '3px',
                              padding: '0 4px',
                              cursor: 'pointer',
                              zIndex: 2,
                            }}
                            title={language === 'pl' ? `Punkt B: ${formatTimeMs(loopPointB)} (${loopPointB} ms) - kliknij, aby skoczyć (podwójny klik: edytor)` : `Point B: ${formatTimeMs(loopPointB)} (${loopPointB} ms) - click to jump (double click: editor)`}
                          >
                            B
                          </div>
                        )}
                        {/* Wskaźnik zapisanej zakładki na osi czasu */}
                        {currentBookmark !== null && status.duration_ms && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSeek(currentBookmark);
                            }}
                            style={{
                              position: 'absolute',
                              top: '-18px',
                              left: `${(currentBookmark / status.duration_ms) * 100}%`,
                              transform: 'translateX(-50%)',
                              fontSize: '0.62rem',
                              fontWeight: 800,
                              color: '#fbbf24',
                              background: '#090d16',
                              border: '1px solid #fbbf24',
                              borderRadius: '3px',
                              padding: '0 4px',
                              cursor: 'pointer',
                              zIndex: 3,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '2px',
                              boxShadow: '0 0 8px rgba(251, 191, 36, 0.4)',
                            }}
                            title={`${(loc.player.bookmarkJump || (language === 'pl' ? 'Skocz do zakładki ({0})' : 'Jump to bookmark ({0})')).replace('{0}', formatTime(currentBookmark))} (${language === 'pl' ? 'Kliknij, aby skoczyć' : 'Click to jump'})`}
                          >
                            <Bookmark size={9} fill="#fbbf24" /> {formatTime(currentBookmark)}
                          </div>
                        )}
                        {/* Wskaźniki wielopunktowych zakładek (Track Bookmarks / Cue Points) na osi czasu */}
                        {status.duration_ms && status.duration_ms > 0 && currentTrackBookmarks.map((bm) => {
                          const leftPct = Math.min(100, Math.max(0, (bm.position_ms / status.duration_ms!) * 100));
                          return (
                            <div
                              key={`bm-${bm.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSeek(bm.position_ms);
                                showMessage(`📌 ${bm.name} (${formatTimeMs(bm.position_ms)})`);
                              }}
                              style={{
                                position: 'absolute',
                                top: '50%',
                                left: `${leftPct}%`,
                                transform: 'translate(-50%, -50%) rotate(45deg)',
                                width: '8px',
                                height: '8px',
                                backgroundColor: 'var(--accent-cyan, #06b6d4)',
                                border: '1px solid #fff',
                                borderRadius: '2px',
                                zIndex: 4,
                                cursor: 'pointer',
                                boxShadow: '0 0 6px rgba(6, 182, 212, 0.9)',
                              }}
                              title={`📌 ${bm.name} - ${formatTimeMs(bm.position_ms)} (${language === 'pl' ? 'Kliknij, aby skoczyć' : 'Click to jump'})`}
                            />
                          );
                        })}
                        <input
                          type="range"
                          min={0}
                          max={status.duration_ms || 100}
                          value={status.position_ms}
                          onChange={(e) => handleSeek(Number(e.target.value))}
                          onPointerUp={(e) => e.currentTarget.blur()}
                          onMouseUp={(e) => e.currentTarget.blur()}
                          onKeyDown={(e) => {
                            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) || ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
                              e.currentTarget.blur();
                            }
                          }}
                          style={{
                            width: '100%',
                            position: 'relative',
                            zIndex: 3,
                            background: `linear-gradient(to right, var(--accent-pink) 0%, var(--accent-purple) ${seekProgressPercent}%, rgba(255, 255, 255, 0.12) ${seekProgressPercent}%, rgba(255, 255, 255, 0.12) 100%)`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Przyciski sterowania odtwarzaniem */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {/* Narzędzia lewe: Zakładka, Pętla A-B, Sleep Timer, Skróty */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {/* 1. Przycisk Zakładki (Bookmark) */}
                        {currentBookmark === null ? (
                          <button
                            onClick={handleSaveBookmark}
                            title={loc.player.bookmarkDesc || (language === 'pl' ? 'Zapisz zakładkę odtwarzania' : 'Save playback bookmark')}
                            className="glass-card"
                            style={{
                              height: '32px',
                              padding: '0 11px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                              color: activeTrackId ? '#fbbf24' : 'var(--text-muted)',
                              background: activeTrackId ? 'rgba(251, 191, 36, 0.08)' : 'rgba(255, 255, 255, 0.04)',
                              border: activeTrackId ? '1px solid rgba(251, 191, 36, 0.35)' : '1px solid var(--border-subtle)',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              borderRadius: '8px',
                              cursor: 'pointer',
                            }}
                          >
                            <Bookmark size={13} fill={activeTrackId ? '#fbbf24' : 'none'} color="#fbbf24" />
                            <span>{loc.player.bookmark}</span>
                          </button>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
                            <button
                              onClick={handleSaveBookmark}
                              className="glass-card"
                              style={{
                                padding: '6px 9px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                color: '#fbbf24',
                                background: 'rgba(251, 191, 36, 0.15)',
                                border: '1px solid rgba(251, 191, 36, 0.45)',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                borderRadius: '8px 0 0 8px',
                                cursor: 'pointer',
                                height: '32px',
                              }}
                            >
                              <Bookmark size={13} fill="#fbbf24" color="#fbbf24" /> {loc.player.bookmark}
                            </button>
                            <button
                              onClick={() => handleJumpToBookmark(currentBookmark)}
                              className="glass-card"
                              title={(loc.player.bookmarkJump || (language === 'pl' ? 'Skocz do zakładki ({0})' : 'Jump to bookmark ({0})')).replace('{0}', formatTime(currentBookmark))}
                              style={{
                                padding: '6px 6px',
                                fontSize: '0.72rem',
                                fontFamily: 'monospace',
                                fontWeight: 700,
                                color: '#fbbf24',
                                background: 'rgba(251, 191, 36, 0.12)',
                                borderTop: '1px solid rgba(251, 191, 36, 0.45)',
                                borderBottom: '1px solid rgba(251, 191, 36, 0.45)',
                                borderLeft: 'none',
                                borderRight: '1px solid rgba(251, 191, 36, 0.3)',
                                cursor: 'pointer',
                                height: '32px',
                              }}
                            >
                              {formatTime(currentBookmark)}
                            </button>
                            <button
                              onClick={handleDeleteBookmark}
                              className="glass-card"
                              title={loc.player.bookmarkDelete || (language === 'pl' ? 'Usuń zakładkę' : 'Delete bookmark')}
                              style={{
                                padding: '6px 6px',
                                color: '#ff6b81',
                                background: 'rgba(251, 191, 36, 0.12)',
                                border: '1px solid rgba(251, 191, 36, 0.45)',
                                borderLeft: 'none',
                                borderRadius: '0 8px 8px 0',
                                cursor: 'pointer',
                                height: '32px',
                              }}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        )}

                        {/* 2. Przycisk Wielopunktowych Zakładek (Points / Cue Points) */}
                        <button
                          onClick={() => {
                            if (!activeTrackId && !status.current_track?.track_id) {
                              showMessage(language === 'pl' ? 'Załaduj utwór, aby zarządzać znacznikami' : 'Load track to manage cue points', true);
                              return;
                            }
                            setIsBookmarksModalOpen(true);
                          }}
                          className="glass-card"
                          style={{
                            height: '32px',
                            padding: '0 10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: 'var(--accent-cyan)',
                            background: 'rgba(6, 182, 212, 0.12)',
                            border: '1px solid rgba(6, 182, 212, 0.4)',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            borderRadius: '8px',
                            cursor: 'pointer',
                          }}
                          title={language === 'pl' 
                            ? `Wielopunktowe znaczniki utworu (Cue Points)${currentTrackBookmarks.length > 0 ? ` [${currentTrackBookmarks.length} zapisanych]` : ''}` 
                            : `Track Cue Points & Bookmarks${currentTrackBookmarks.length > 0 ? ` [${currentTrackBookmarks.length} saved]` : ''}`}
                        >
                          <Bookmark size={13} color="var(--accent-cyan)" />
                          <span>{currentTrackBookmarks.length > 0 ? `${currentTrackBookmarks.length}` : (language === 'pl' ? 'Punkty' : 'Points')}</span>
                        </button>

                        {/* 3. Przycisk Punktu A */}
                        <button
                          onClick={() => {
                            const pos = status.position_ms;
                            setLoopPointA(pos);
                            showMessage(language === 'pl' 
                              ? `Ustawiono Punkt A: ${formatTimeMs(pos)} (Skrót: A)` 
                              : `Set Point A: ${formatTimeMs(pos)} (Key: A)`);
                          }}
                          className="glass-card"
                          style={{
                            minWidth: '32px',
                            height: '32px',
                            padding: '0 8px',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            borderRadius: '8px',
                            color: loopPointA !== null ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                            background: loopPointA !== null ? 'rgba(6, 182, 212, 0.22)' : 'rgba(255, 255, 255, 0.05)',
                            border: loopPointA !== null ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease',
                          }}
                          title={loopPointA !== null
                            ? (language === 'pl' 
                                ? `Punkt A: ${formatTimeMs(loopPointA)} — kliknij, aby ustawić na nowo na ${formatTime(status.position_ms)} (Klawisz: A)`
                                : `Point A: ${formatTimeMs(loopPointA)} — click to update to ${formatTime(status.position_ms)} (Key: A)`)
                            : (language === 'pl' ? 'Ustaw Punkt A na bieżącej pozycji (Klawisz: A)' : 'Set Point A at current position (Key: A)')}
                        >
                          A
                        </button>

                        {/* 4. Przycisk Punktu B */}
                        <button
                          onClick={() => {
                            const pos = status.position_ms;
                            setLoopPointB(pos);
                            showMessage(language === 'pl' 
                              ? `Ustawiono Punkt B: ${formatTimeMs(pos)} (Skrót: B)` 
                              : `Set Point B: ${formatTimeMs(pos)} (Key: B)`);
                          }}
                          className="glass-card"
                          style={{
                            minWidth: '32px',
                            height: '32px',
                            padding: '0 8px',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            borderRadius: '8px',
                            color: loopPointB !== null ? 'var(--accent-pink)' : 'var(--text-secondary)',
                            background: loopPointB !== null ? 'rgba(244, 63, 94, 0.22)' : 'rgba(255, 255, 255, 0.05)',
                            border: loopPointB !== null ? '1px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease',
                          }}
                          title={loopPointB !== null
                            ? (language === 'pl' 
                                ? `Punkt B: ${formatTimeMs(loopPointB)} — kliknij, aby ustawić na nowo na ${formatTime(status.position_ms)} (Klawisz: B)`
                                : `Point B: ${formatTimeMs(loopPointB)} — click to update to ${formatTime(status.position_ms)} (Key: B)`)
                            : (language === 'pl' ? 'Ustaw Punkt B na bieżącej pozycji (Klawisz: B)' : 'Set Point B at current position (Key: B)')}
                        >
                          B
                        </button>

                        {/* 5. Przycisk Edytora Pętli A-B (Sliders) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <button
                            onClick={() => setIsLoopEditorOpen(true)}
                            className="glass-card"
                            style={{
                              minWidth: '32px',
                              height: '32px',
                              padding: '0 8px',
                              borderRadius: (loopPointA !== null || loopPointB !== null) ? '8px 0 0 8px' : '8px',
                              color: (loopPointA !== null && loopPointB !== null) ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                              background: (loopPointA !== null && loopPointB !== null) ? 'rgba(6, 182, 212, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                              border: (loopPointA !== null && loopPointB !== null) ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            title={loc.player.editLoop || (language === 'pl' ? 'Edytuj zakres pętli A-B w milisekundach' : 'Edit loop range in milliseconds')}
                          >
                            <Sliders size={13} />
                          </button>
                          {(loopPointA !== null || loopPointB !== null) && (
                            <button
                              onClick={() => {
                                setLoopPointA(null);
                                setLoopPointB(null);
                                showMessage(language === 'pl' ? 'Wyczyszczono pętlę A-B (Skrót: C)' : 'Cleared A-B loop (Key: C)');
                              }}
                              className="glass-card"
                              style={{
                                minWidth: '22px',
                                height: '32px',
                                padding: '0 4px',
                                borderRadius: '0 8px 8px 0',
                                color: '#ff6b81',
                                background: 'rgba(255, 107, 129, 0.15)',
                                border: '1px solid rgba(255, 107, 129, 0.35)',
                                borderLeft: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                              title={loc.shortcuts.loopClear}
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>

                        {/* 6. Przycisk Wyłącznika czasowego (Sleep Timer) */}
                        <button
                          onClick={() => setIsSleepTimerOpen(true)}
                          className="glass-card"
                          style={{
                            minWidth: '32px',
                            height: '32px',
                            padding: '0 8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            fontSize: '0.75rem',
                            borderRadius: '8px',
                            color:
                              sleepTimerRemainingSec !== null || sleepTimerTargetMode === 'end_of_track'
                                ? 'var(--accent-purple)'
                                : 'var(--text-secondary)',
                            border:
                              sleepTimerRemainingSec !== null || sleepTimerTargetMode === 'end_of_track'
                                ? '1px solid var(--accent-purple)'
                                : '1px solid var(--border-subtle)',
                            background:
                              sleepTimerRemainingSec !== null || sleepTimerTargetMode === 'end_of_track'
                                ? 'rgba(168, 85, 247, 0.18)'
                                : 'rgba(255, 255, 255, 0.05)',
                            cursor: 'pointer',
                          }}
                          title={loc.player.sleepTimer}
                        >
                          <Moon size={13} />
                          {(sleepTimerRemainingSec !== null || sleepTimerTargetMode === 'end_of_track') && (
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.68rem', marginLeft: '2px' }}>
                              {sleepTimerRemainingSec !== null
                                ? `${Math.floor(sleepTimerRemainingSec / 60)}:${(sleepTimerRemainingSec % 60) < 10 ? '0' : ''}${sleepTimerRemainingSec % 60}`
                                : (language === 'pl' ? 'Koniec' : 'End')}
                            </span>
                          )}
                        </button>

                        {/* 7. Przycisk Skrótów klawiszowych */}
                        <button
                          onClick={() => setIsShortcutsModalOpen(true)}
                          className="glass-card"
                          style={{
                            minWidth: '32px',
                            height: '32px',
                            padding: '0 8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            borderRadius: '8px',
                            color: 'var(--text-secondary)',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid var(--border-subtle)',
                            cursor: 'pointer',
                          }}
                          title={loc.shortcuts.title}
                        >
                          <Keyboard size={13} />
                        </button>

                        {/* 8. Przycisk Tekstów piosenki (Lyrics) */}
                        <button
                          onClick={() => setShowLyrics(!showLyrics)}
                          className="glass-card"
                          style={{
                            height: '32px',
                            padding: '0 10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            borderRadius: '8px',
                            color: showLyrics ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                            border: showLyrics ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                            background: showLyrics ? 'rgba(6, 182, 212, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                            cursor: 'pointer',
                          }}
                          title={loc.shortcuts.lyrics}
                        >
                          <Mic2 size={13} />
                          <span>{loc.player.lyrics}</span>
                        </button>

                        {/* Shuffle Button */}
                        <button
                          onClick={handleToggleShuffle}
                          title={loc.shortcuts.shuffle}
                          className="glass-card"
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: queue.shuffle ? 'rgba(6, 182, 212, 0.25)' : 'rgba(255,255,255,0.06)',
                            border: queue.shuffle ? '1px solid var(--accent-cyan)' : 'none',
                            color: queue.shuffle ? 'var(--accent-cyan)' : 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <Shuffle size={16} />
                        </button>

                        {/* Previous Button */}
                        <button
                          onClick={handlePrevious}
                          title={loc.player.previous}
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '50%',
                            background: 'rgba(255,255,255,0.08)',
                            border: 'none',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <SkipBack size={18} />
                        </button>

                        {/* Stop Button */}
                        <button
                          onClick={handleStop}
                          title={loc.player.stop}
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '50%',
                            background: 'rgba(255,255,255,0.08)',
                            border: 'none',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <Square size={16} />
                        </button>

                        {/* Play / Pause Button */}
                        <button
                          onClick={handlePlayPause}
                          style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                            border: 'none',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: 'var(--shadow-glow)',
                            cursor: 'pointer',
                          }}
                        >
                          {status.state === 'Playing' ? <Pause size={24} /> : <Play size={24} style={{ marginLeft: '3px' }} />}
                        </button>

                        {/* Next Button */}
                        <button
                          onClick={handleNext}
                          title={loc.player.next}
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '50%',
                            background: 'rgba(255,255,255,0.08)',
                            border: 'none',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <SkipForward size={18} />
                        </button>

                        {/* Repeat Button */}
                        <button
                          onClick={handleCycleLoopMode}
                          title={queue.loop_mode === 'Track' ? loc.player.loopTrack : queue.loop_mode === 'Queue' ? loc.player.loopQueue : loc.player.loopOff}
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: queue.loop_mode !== 'None' ? 'rgba(255, 77, 148, 0.25)' : 'rgba(255,255,255,0.06)',
                            border: queue.loop_mode !== 'None' ? '1px solid var(--accent-pink)' : 'none',
                            color: queue.loop_mode !== 'None' ? 'var(--accent-pink)' : 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            position: 'relative',
                          }}
                        >
                          {queue.loop_mode === 'Track' ? <Repeat1 size={16} /> : <Repeat size={16} />}
                          {queue.loop_mode === 'Queue' && (
                            <span style={{ position: 'absolute', bottom: '3px', right: '3px', width: '4px', height: '4px', borderRadius: '50%', background: 'var(--accent-pink)' }} />
                          )}
                        </button>
                      </div>

                      {/* Volume Slider */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={handleToggleMute}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                          title={status.volume === 0 ? loc.player.unmute : loc.player.mute}
                        >
                          {status.volume === 0 ? <VolumeX size={16} color="var(--text-muted)" /> : <Volume2 size={16} color="var(--text-secondary)" />}
                        </button>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.01}
                          value={status.volume}
                          onChange={(e) => handleVolumeChange(Number(e.target.value))}
                          onPointerUp={(e) => e.currentTarget.blur()}
                          onMouseUp={(e) => e.currentTarget.blur()}
                          onKeyDown={(e) => {
                            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) || ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
                              e.currentTarget.blur();
                            }
                          }}
                          style={{
                            width: '120px',
                            cursor: 'pointer',
                            background: `linear-gradient(to right, var(--accent-purple) 0%, var(--accent-pink) ${volumeProgressPercent}%, rgba(255, 255, 255, 0.12) ${volumeProgressPercent}%, rgba(255, 255, 255, 0.12) 100%)`,
                          }}
                          title={`${loc.player.volume}: ${formatVolumeValue(status.volume)} (${Math.round(status.volume * 100)}%)`}
                        />
                        <button
                          type="button"
                          onClick={handleToggleVolumeUnit}
                          title={language === 'pl' ? 'Kliknij, aby przełączyć jednostkę: % ↔ dB' : 'Click to toggle unit: % ↔ dB'}
                          style={{
                            background: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '6px',
                            padding: '2px 6px',
                            fontSize: '0.74rem',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            color: volumeUnit === 'db' ? 'var(--accent-cyan)' : 'var(--accent-pink)',
                            cursor: 'pointer',
                            minWidth: '52px',
                            textAlign: 'center',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {formatVolumeValue(status.volume)}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ZINTEGROWANY MINI-PASEK DSP (Zastępuje dawne puste wielkie karty z Image 2) */}
                <div
                  className="glass-card"
                  style={{
                    padding: '10px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderRadius: '12px',
                    background: 'rgba(0,0,0,0.28)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      DSP:
                    </span>

                    {/* Szybki przełącznik Bypass / DSP */}
                    <button
                      onClick={() => handleEngineChange(status.engine === 'Bypass' ? (lastActiveDspEngineRef.current || 'RubberBand') : 'Bypass')}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: status.engine === 'Bypass' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
                        color: status.engine === 'Bypass' ? 'var(--accent-green)' : 'var(--accent-pink)',
                        border: status.engine === 'Bypass' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(244, 63, 94, 0.4)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      title={status.engine === 'Bypass' ? loc.dsp.enableDspTooltip : loc.dsp.disableDspTooltip}
                    >
                      {status.engine === 'Bypass' ? '● BYPASS' : `● ${status.engine === 'RubberBand' ? 'Rubber Band' : 'SoundTouch'}`}
                    </button>

                    {/* Wskaźnik i przycisk powrotu ze stemów (jeśli stemy są aktywne) */}
                    {status.is_stems_active && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '3px 8px',
                          borderRadius: '8px',
                          background: 'rgba(236, 72, 153, 0.2)',
                          border: '1px solid rgba(236, 72, 153, 0.45)',
                          fontSize: '0.75rem',
                          color: '#f43f5e',
                          fontWeight: 700,
                        }}
                      >
                        <Sliders size={12} />
                        <span>{language === 'pl' ? 'Miks stemów' : 'Stem Mix'}</span>
                        <button
                          onClick={handleRestoreOriginalTrack}
                          title={language === 'pl' ? 'Wróć do oryginalnego utworu (wyjście ze stemów)' : 'Return to original track (exit stems)'}
                          style={{
                            background: 'rgba(255, 255, 255, 0.18)',
                            border: '1px solid rgba(255, 255, 255, 0.28)',
                            borderRadius: '6px',
                            color: '#fff',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '2px 6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <RotateCcw size={11} />
                          {language === 'pl' ? 'Wróć do utworu' : 'Restore original'}
                        </button>
                      </div>
                    )}

                    {/* Pitch Chip */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Pitch:</span>
                      <span style={{ color: 'var(--accent-pink)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                        {status.pitch_semitones > 0 ? `+${status.pitch_semitones.toFixed(1)}` : status.pitch_semitones.toFixed(1)} st
                      </span>
                      {status.pitch_semitones !== 0 && (
                        <button
                          onClick={() => handlePitchChange(0)}
                          title={loc.dsp.resetPitchTooltip}
                          style={{ background: 'none', color: 'var(--text-muted)', padding: '2px', cursor: 'pointer', display: 'flex' }}
                        >
                          <RotateCcw size={12} />
                        </button>
                      )}
                    </div>

                    {/* Tempo Chip */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Tempo:</span>
                      <span style={{ color: 'var(--accent-cyan)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                        {status.tempo_ratio.toFixed(2)}x
                      </span>
                      {status.tempo_ratio !== 1 && (
                        <button
                          onClick={() => handleTempoChange(1.0)}
                          title={loc.dsp.resetTempoTooltip}
                          style={{ background: 'none', color: 'var(--text-muted)', padding: '2px', cursor: 'pointer', display: 'flex' }}
                        >
                          <RotateCcw size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Szybkie przejście do pełnego korektora DSP */}
                  <button
                    onClick={() => setActiveTab('dsp')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'rgba(168, 85, 247, 0.15)',
                      border: '1px solid rgba(168, 85, 247, 0.35)',
                      color: 'var(--accent-purple)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      padding: '5px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    <Sliders size={13} />
                    <span>{loc.nav.dsp} &rarr;</span>
                  </button>
                </div>
              </div>

              {/* SEKCJA ZSYNCHRONIZOWANYCH TEKSTÓW PIOSENEK (LRC & LRCLIB) */}
              {showLyrics && (
                <div style={{ height: '420px', width: '100%', marginBottom: '4px' }}>
                  <LyricsView
                    trackTitle={effectiveDisplayTitle}
                    trackArtist={effectiveDisplayArtist}
                    trackAlbum={currentAlbum?.title || status.current_track?.album || null}
                    trackPath={currentPlayingTrack?.path || status.current_track?.uri || filePath || null}
                    durationSec={status.duration_ms ? status.duration_ms / 1000 : null}
                    currentPositionMs={status.position_ms}
                    currentLang={language}
                    onSeek={handleSeek}
                    onClose={() => setShowLyrics(false)}
                  />
                </div>
              )}

              {/* SEKCJA KOLEJKI ODTWARZANIA Z KONFIGURACJĄ KOLUMN */}
              <div
                className="glass-panel"
                style={{
                  padding: '22px 26px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  position: 'relative',
                }}
              >
                {/* Pasek nagłówkowy kolejki */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.25), rgba(168, 85, 247, 0.25))',
                        border: '1px solid rgba(236, 72, 153, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 0 16px rgba(236, 72, 153, 0.2)',
                      }}
                    >
                      <ListMusic size={20} color="var(--accent-pink)" />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>
                          {loc.queue.title}
                        </h3>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '12px',
                            background: 'rgba(236, 72, 153, 0.15)',
                            color: 'var(--accent-pink)',
                            border: '1px solid rgba(236, 72, 153, 0.3)',
                          }}
                        >
                          {queue.items.length}{' '}
                          {queue.items.length === 1
                            ? loc.queue.itemSingle
                            : queue.items.length >= 2 && queue.items.length <= 4
                              ? loc.queue.itemFew
                              : loc.queue.itemMany}
                        </span>
                        {queue.items.length > 0 && (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--text-muted)',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            • {formatTotalDuration(totalQueueDurationMs)}
                          </span>
                        )}
                      </div>
                      <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {loc.queue.dragHint}
                      </p>
                    </div>
                  </div>

                  {/* Przyciski kontroli i dostosowywania */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
                    {/* Tryb Pętli Badge Button */}
                    <button
                      onClick={handleCycleLoopMode}
                      title={`${loc.shortcuts.loop}: ${queue.loop_mode === 'None' ? loc.queue.loopNone : queue.loop_mode === 'Track' ? loc.queue.loopTrack : loc.queue.loopQueue}`}
                      className="glass-card"
                      style={{
                        padding: '6px 11px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: queue.loop_mode !== 'None' ? 'var(--accent-pink)' : 'var(--text-muted)',
                        border: queue.loop_mode !== 'None' ? '1px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      {queue.loop_mode === 'Track' ? <Repeat1 size={14} /> : <Repeat size={14} />}
                      <span>{queue.loop_mode === 'None' ? loc.queue.loopNone : queue.loop_mode === 'Track' ? loc.queue.loopTrack : loc.queue.loopQueue}</span>
                    </button>

                    {/* Shuffle Badge Button */}
                    <button
                      onClick={handleToggleShuffle}
                      title={`${loc.shortcuts.shuffle}: ${queue.shuffle ? loc.queue.shuffleOn : loc.queue.shuffleOff}`}
                      className="glass-card"
                      style={{
                        padding: '6px 11px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: queue.shuffle ? 'var(--accent-cyan)' : 'var(--text-muted)',
                        border: queue.shuffle ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      <Shuffle size={14} />
                      <span>{queue.shuffle ? loc.queue.shuffleOn : loc.queue.shuffleOff}</span>
                    </button>

                    {/* Infinity Queue / Auto-DJ Button */}
                    <button
                      onClick={handleToggleInfinityQueue}
                      title={loc.queue.autoDjHint}
                      className="glass-card"
                      style={{
                        padding: '6px 11px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: infinityQueue ? 'var(--accent-pink)' : 'var(--text-muted)',
                        border: infinityQueue ? '1px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
                        background: infinityQueue ? 'rgba(236, 72, 153, 0.2)' : 'transparent',
                        borderRadius: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      <InfinityIcon size={14} />
                      <span>Auto-DJ {infinityQueue ? 'ON' : 'OFF'}</span>
                    </button>

                    {/* Stop After Current Badge Button (foobar2000 classic) */}
                    <button
                      onClick={handleToggleStopAfterCurrent}
                      title={language === 'pl' ? 'Zatrzymaj odtwarzanie po zakończeniu bieżącego utworu (Stop After Current Track — foobar2000)' : 'Stop playback after current track finishes (Stop After Current Track — foobar2000)'}
                      className="glass-card"
                      style={{
                        padding: '6px 11px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: status.stop_after_current ? '#eab308' : 'var(--text-muted)',
                        border: status.stop_after_current ? '1px solid #eab308' : '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: status.stop_after_current ? 'rgba(234, 179, 8, 0.22)' : 'transparent',
                        boxShadow: status.stop_after_current ? '0 0 10px rgba(234, 179, 8, 0.35)' : 'none',
                      }}
                    >
                      <Square size={13} style={{ fill: status.stop_after_current ? '#eab308' : 'none' }} />
                      <span>Stop After Track {status.stop_after_current ? '(ON)' : ''}</span>
                    </button>

                    {/* Pole wyszukiwania w kolejce */}
                    {queue.items.length > 0 && (
                      <div style={{ position: 'relative', width: '180px' }}>
                        <Search
                          size={13}
                          style={{
                            position: 'absolute',
                            left: '9px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--text-muted)',
                            pointerEvents: 'none',
                          }}
                        />
                        <input
                          type="text"
                          placeholder={loc.queue.search}
                          value={queueSearchQuery}
                          onChange={(e) => setQueueSearchQuery(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '6px 8px 6px 28px',
                            borderRadius: '8px',
                            fontSize: '0.75rem',
                            background: 'rgba(0, 0, 0, 0.45)',
                            border: '1px solid var(--border-subtle)',
                            color: '#fff',
                            outline: 'none',
                          }}
                        />
                        {queueSearchQuery && (
                          <button
                            onClick={() => setQueueSearchQuery('')}
                            style={{
                              position: 'absolute',
                              right: '7px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              display: 'flex',
                              padding: 0,
                            }}
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Przycisk Konfiguracji Kolumn */}
                    <div style={{ position: 'relative' }}>
                      <button
                        onClick={() => setIsColumnConfigOpen(!isColumnConfigOpen)}
                        className="glass-card"
                        style={{
                          padding: '6px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: isColumnConfigOpen ? 'var(--accent-purple)' : 'var(--text-secondary)',
                          border: isColumnConfigOpen ? '1px solid var(--accent-purple)' : '1px solid var(--border-subtle)',
                          borderRadius: '8px',
                          cursor: 'pointer',
                        }}
                        title={loc.queue.customizeView}
                      >
                        <SlidersHorizontal size={14} />
                        <span>{loc.queue.customizeView}</span>
                      </button>

                      {/* Popover Konfiguracji Kolumn */}
                      {isColumnConfigOpen && (
                        <div
                          className="glass-panel"
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: '100%',
                            marginTop: '8px',
                            width: '320px',
                            padding: '16px',
                            zIndex: 70,
                            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.75)',
                            border: '1px solid var(--border-accent)',
                            borderRadius: '14px',
                            background: 'var(--bg-surface)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Settings size={15} color="var(--accent-purple)" />
                              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>{t.queue.customizeTitle}</span>
                            </div>
                            <button
                              onClick={() => setIsColumnConfigOpen(false)}
                              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                            >
                              <X size={15} />
                            </button>
                          </div>

                          <p style={{ margin: '0 0 12px 0', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                            {t.queue.customizeDesc}
                          </p>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {[
                              { key: 'showIndex', label: t.queue.colIndex },
                              { key: 'showCover', label: t.queue.colCover },
                              { key: 'showArtist', label: t.queue.colArtist },
                              { key: 'showAlbum', label: t.queue.colAlbum },
                              { key: 'showFormatBadge', label: t.queue.colFormat },
                              { key: 'showDuration', label: t.queue.colDuration },
                              { key: 'showPath', label: t.queue.colPath },
                              { key: 'compactMode', label: t.queue.compactMode },
                            ].map((col) => {
                              const active = queueColumns[col.key as keyof QueueColumnConfig];
                              return (
                                <div
                                  key={col.key}
                                  onClick={() => toggleQueueColumn(col.key as keyof QueueColumnConfig)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '7px 10px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    background: active ? 'rgba(168, 85, 247, 0.12)' : 'rgba(255,255,255,0.02)',
                                    border: active ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid transparent',
                                  }}
                                >
                                  <span style={{ fontSize: '0.78rem', color: active ? '#fff' : 'var(--text-muted)' }}>{col.label}</span>
                                  <div
                                    style={{
                                      width: '18px',
                                      height: '18px',
                                      borderRadius: '4px',
                                      border: active ? '1px solid var(--accent-purple)' : '1px solid var(--border-subtle)',
                                      background: active ? 'var(--accent-purple)' : 'transparent',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    {active && <Check size={12} color="#fff" />}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                            <button
                              onClick={resetQueueColumns}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                fontSize: '0.72rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <RotateCcw size={12} /> {t.queue.resetDefaults}
                            </button>
                            <button
                              onClick={() => setIsColumnConfigOpen(false)}
                              style={{
                                padding: '4px 12px',
                                borderRadius: '6px',
                                background: 'var(--accent-purple)',
                                color: '#fff',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                border: 'none',
                                cursor: 'pointer',
                              }}
                            >
                              {t.queue.done}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Przycisk Wybierz i dodaj utwory przez systemowy dialog (Dolphin / zenity) */}
                    <button
                      onClick={handlePickFiles}
                      className="glass-card"
                      style={{
                        padding: '6px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--accent-cyan)',
                        border: '1px solid rgba(6, 182, 212, 0.4)',
                        background: 'rgba(6, 182, 212, 0.1)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                      }}
                      title={t.queue.addTracksTooltip}
                    >
                      <Plus size={14} />
                      <span>{t.queue.addTracks}</span>
                    </button>

                    {/* Przycisk Zapisz kolejkę jako playlistę */}
                    {queue.items.length > 0 && (
                      <button
                        onClick={() => setIsSaveQueueModalOpen(true)}
                        className="glass-card"
                        style={{
                          padding: '6px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: 'var(--accent-purple)',
                          border: '1px solid rgba(168, 85, 247, 0.4)',
                          background: 'rgba(168, 85, 247, 0.12)',
                          borderRadius: '8px',
                          cursor: 'pointer',
                        }}
                        title={loc.queue.saveAsPlaylistTitle}
                      >
                        <BookmarkPlus size={14} />
                        <span>{loc.queue.saveAsPlaylist}</span>
                      </button>
                    )}

                    {/* Przycisk Wyczyść kolejkę */}
                    {queue.items.length > 0 && (
                      <button
                        onClick={handleClearQueue}
                        className="glass-card"
                        style={{
                          padding: '6px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: '#ff6b81',
                          border: '1px solid rgba(255, 107, 129, 0.3)',
                          borderRadius: '8px',
                          cursor: 'pointer',
                        }}
                        title={t.queue.clearTooltip}
                      >
                        <Trash2 size={14} />
                        <span>{t.queue.clear}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Zawartość Kolejki: Tabela utworów lub Pusty stan */}
                {queue.items.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '48px 24px',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '12px',
                      border: '2px dashed rgba(255, 255, 255, 0.08)',
                      borderRadius: '14px',
                      background: 'rgba(0, 0, 0, 0.15)',
                    }}
                  >
                    <div
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        background: 'rgba(236, 72, 153, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <ListMusic size={28} color="var(--accent-pink)" style={{ opacity: 0.8 }} />
                    </div>
                    <div>
                      <p style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#fff' }}>
                        {t.queue.empty}
                      </p>
                      <p style={{ fontSize: '0.8rem', marginTop: '4px', color: 'var(--text-secondary)' }}>
                        {t.queue.emptyHint}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                      <button
                        onClick={() => setActiveTab('library')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '7px',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                          color: '#fff',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <Music size={15} />
                        <span>{t.queue.browseLibrary}</span>
                      </button>
                      <button
                        onClick={handlePickFiles}
                        className="glass-card"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '7px',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          color: 'var(--text-secondary)',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        <FolderOpen size={15} />
                        <span>{t.queue.pickFromDisk}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div ref={queueListRef} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {/* Pasek nagłówków kolumn */}
                    <div
                      style={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 10,
                        background: 'rgba(20, 16, 32, 0.95)',
                        backdropFilter: 'blur(12px)',
                        display: 'grid',
                        gridTemplateColumns: getQueueGridTemplate(queueColumns),
                        padding: '8px 14px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        borderBottom: '1px solid var(--border-subtle)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        alignItems: 'center',
                        gap: '12px',
                      }}
                    >
                      {queueColumns.showIndex && <span style={{ width: '28px', textAlign: 'center' }}>{t.queue.headerIndex}</span>}
                      {queueColumns.showCover && (
                        <span
                          style={{
                            width: queueColumns.compactMode ? '34px' : '44px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          title={t.queue.headerCover}
                        >
                          <ImageIcon size={14} style={{ opacity: 0.7 }} />
                        </span>
                      )}
                      <span>{t.queue.headerTitleArtist}</span>
                      {queueColumns.showAlbum && <span>{t.queue.headerAlbum}</span>}
                      {queueColumns.showFormatBadge && <span>{t.queue.headerQuality}</span>}
                      {queueColumns.showPath && <span>{t.queue.headerPath}</span>}
                      {queueColumns.showDuration && <span style={{ textAlign: 'right' }}>{t.queue.headerTime}</span>}
                      <span style={{ textAlign: 'right', paddingRight: '6px' }}>{t.queue.headerActions}</span>
                    </div>

                    {/* Lista wierszy utworów */}
                    {filteredQueueItems.length === 0 && queueSearchQuery ? (
                      <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {t.queue.noMatch.replace('{q}', queueSearchQuery)}
                      </div>
                    ) : (
                      <>
                        {queueTopSpacer > 0 && <div style={{ height: `${queueTopSpacer}px`, pointerEvents: 'none' }} />}
                        {filteredQueueItems.slice(queueStartIndex, queueEndIndex).map(({ it: item, originalIdx: idx }) => {
                          const isCurrent = idx === queue.current_index;
                          const isPlaying = isCurrent && status.state === 'Playing';
                          const meta = getQueueTrackMeta(item);
                          const isDragOver = dragOverQueueIdx === idx;

                          return (
                            <div
                              key={item.id}
                              draggable
                              onDragStart={(e) => handleQueueDragStart(idx, e)}
                              onDragOver={(e) => handleQueueDragOver(idx, e)}
                              onDrop={(e) => handleQueueDrop(idx, e)}
                              onClick={() => handlePlayQueueIndex(idx, item)}
                              onDoubleClick={() => handlePlayQueueIndex(idx, item)}
                              className="glass-card"
                              style={{
                                display: 'grid',
                                gridTemplateColumns: getQueueGridTemplate(queueColumns),
                                alignItems: 'center',
                                padding: queueColumns.compactMode ? '6px 12px' : '10px 14px',
                                gap: '12px',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                background: isCurrent
                                  ? 'linear-gradient(90deg, rgba(236, 72, 153, 0.18), rgba(168, 85, 247, 0.1))'
                                  : 'rgba(255, 255, 255, 0.02)',
                                border: isCurrent
                                  ? '1px solid var(--accent-pink)'
                                  : isDragOver
                                    ? '2px solid var(--accent-purple)'
                                    : '1px solid rgba(255, 255, 255, 0.05)',
                                boxShadow: isCurrent ? '0 0 20px rgba(236, 72, 153, 0.25)' : 'none',
                                transition: 'all 0.15s ease',
                                opacity: draggedQueueIdx === idx ? 0.35 : 1,
                              }}
                            >
                              {/* Numer pozycji / Wskaźnik odtwarzania */}
                              {queueColumns.showIndex && (
                                <div
                                  style={{
                                    width: '28px',
                                    textAlign: 'center',
                                    color: isCurrent ? 'var(--accent-pink)' : 'var(--text-muted)',
                                    fontSize: '0.8rem',
                                    fontWeight: isCurrent ? 700 : 400,
                                    fontFamily: 'var(--font-mono)',
                                  }}
                                >
                                  {isPlaying ? (
                                    <Zap size={16} color="var(--accent-pink)" />
                                  ) : (
                                    idx + 1
                                  )}
                                </div>
                              )}

                              {/* Miniaturka okładki (kliknij aby otworzyć wybór okładki) */}
                              {queueColumns.showCover && (
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (meta.album) {
                                      handleOpenCoverPicker(meta.album);
                                    } else {
                                      handleUploadCustomCoverDirect(null);
                                    }
                                  }}
                                  style={{
                                    width: queueColumns.compactMode ? '34px' : '44px',
                                    height: queueColumns.compactMode ? '34px' : '44px',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    background: meta.cover
                                      ? `url("${meta.cover}") center/cover no-repeat`
                                      : 'linear-gradient(135deg, rgba(236,72,153,0.3), rgba(168,85,247,0.3))',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    flexShrink: 0,
                                    cursor: 'pointer',
                                  }}
                                  title={loc.covers.matchCoverTitle}
                                >
                                  {!meta.cover && (
                                    <Disc size={queueColumns.compactMode ? 16 : 20} color="rgba(255,255,255,0.4)" />
                                  )}
                                </div>
                              )}

                              {/* Tytuł i Wykonawca */}
                              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                <p
                                  style={{
                                    margin: 0,
                                    fontSize: queueColumns.compactMode ? '0.82rem' : '0.88rem',
                                    fontWeight: isCurrent ? 700 : 600,
                                    color: isCurrent ? '#fff' : 'var(--text-primary)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {item.title}
                                </p>
                                {queueColumns.showArtist && (
                                  <p
                                    style={{
                                      margin: '2px 0 0 0',
                                      fontSize: '0.74rem',
                                      color: isCurrent ? 'var(--accent-cyan)' : 'var(--text-muted)',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    {item.artist || 'Nieznany wykonawca'}
                                  </p>
                                )}
                              </div>

                              {/* Album */}
                              {queueColumns.showAlbum && (
                                <span
                                  style={{
                                    fontSize: '0.78rem',
                                    color: 'var(--text-secondary)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {meta.album?.title || item.album || '—'}
                                </span>
                              )}

                              {/* Format & Jakość */}
                              {queueColumns.showFormatBadge && (
                                <div>
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '2px 7px',
                                      borderRadius: '6px',
                                      fontSize: '0.67rem',
                                      fontWeight: 700,
                                      fontFamily: 'var(--font-mono)',
                                      background:
                                        meta.format.includes('FLAC') || meta.format.includes('WAV')
                                          ? 'rgba(6, 182, 212, 0.15)'
                                          : 'rgba(168, 85, 247, 0.15)',
                                      color:
                                        meta.format.includes('FLAC') || meta.format.includes('WAV')
                                          ? 'var(--accent-cyan)'
                                          : 'var(--accent-purple)',
                                      border:
                                        meta.format.includes('FLAC') || meta.format.includes('WAV')
                                          ? '1px solid rgba(6, 182, 212, 0.3)'
                                          : '1px solid rgba(168, 85, 247, 0.3)',
                                    }}
                                  >
                                    {meta.format} {meta.bitDepth ? `${meta.bitDepth}b` : ''}
                                  </span>
                                </div>
                              )}

                              {/* Ścieżka pliku */}
                              {queueColumns.showPath && (
                                <span
                                  title={`${item.uri.replace(/^file:\/\//, '')} • ${loc.queue.openContainingFolder}`}
                                  onClick={(e) => handleOpenContainingFolder(item.uri, e)}
                                  style={{
                                    fontSize: '0.72rem',
                                    fontFamily: 'var(--font-mono)',
                                    color: 'var(--text-muted)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    cursor: 'pointer',
                                    textDecoration: 'underline dotted rgba(255, 255, 255, 0.25)',
                                    transition: 'color 0.15s ease',
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-cyan)')}
                                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                                >
                                  {item.uri.replace(/^file:\/\//, '')}
                                </span>
                              )}

                              {/* Czas trwania */}
                              {queueColumns.showDuration && (
                                <span
                                  style={{
                                    fontSize: '0.75rem',
                                    fontFamily: 'var(--font-mono)',
                                    color: isCurrent ? 'var(--accent-pink)' : 'var(--text-muted)',
                                    fontWeight: isCurrent ? 700 : 400,
                                    textAlign: 'right',
                                  }}
                                >
                                  {formatTime(item.duration_ms)}
                                </span>
                              )}

                              {/* Akcje */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px', minWidth: '136px' }}>
                                {!isCurrent && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePlayQueueIndex(idx, item);
                                    }}
                                    title={loc.queue.playThis}
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      color: 'var(--text-muted)',
                                      cursor: 'pointer',
                                      padding: '4px',
                                      borderRadius: '6px',
                                      display: 'flex',
                                    }}
                                  >
                                    <Play size={14} />
                                  </button>
                                )}
                                <button
                                  disabled={idx === 0}
                                  onClick={(e) => handleMoveQueueItem(idx, idx - 1, e)}
                                  title={loc.queue.moveUp}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: idx === 0 ? 'rgba(255,255,255,0.1)' : 'var(--text-muted)',
                                    cursor: idx === 0 ? 'default' : 'pointer',
                                    padding: '4px',
                                    borderRadius: '6px',
                                    display: 'flex',
                                  }}
                                >
                                  <ChevronUp size={15} />
                                </button>
                                <button
                                  disabled={idx === queue.items.length - 1}
                                  onClick={(e) => handleMoveQueueItem(idx, idx + 1, e)}
                                  title={loc.queue.moveDown}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: idx === queue.items.length - 1 ? 'rgba(255,255,255,0.1)' : 'var(--text-muted)',
                                    cursor: idx === queue.items.length - 1 ? 'default' : 'pointer',
                                    padding: '4px',
                                    borderRadius: '6px',
                                    display: 'flex',
                                  }}
                                >
                                  <ChevronDown size={15} />
                                </button>
                                <button
                                  onClick={(e) => handleOpenContainingFolder(item.uri, e)}
                                  title={loc.queue.openContainingFolder}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    transition: 'color 0.15s ease',
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-cyan)')}
                                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                                >
                                  <FolderOpen size={14} />
                                </button>
                                <button
                                  onClick={(e) => handleRemoveFromQueue(item.id, e)}
                                  title={loc.queue.remove}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'rgba(255, 107, 129, 0.7)',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    transition: 'color 0.15s ease',
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-pink)')}
                                  onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 107, 129, 0.7)')}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        {queueBottomSpacer > 0 && <div style={{ height: `${queueBottomSpacer}px`, pointerEvents: 'none' }} />}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
  );
};
