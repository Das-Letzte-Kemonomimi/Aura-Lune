import React, { useCallback } from "react";
import { BarChart3,     FolderOpen,  Heart,                  } from "lucide-react";
import { LyricsView } from '../../components/player/LyricsView';
import {  type TapeType } from '../../components/player/TapeDeckWidget';
import { SpectrumVisualizer } from '../../components/player/SpectrumVisualizer';
import type { AlbumRecord, TrackRecord, PlaybackStatus } from '../../types/player';
import { type QueueItem, type PlaybackQueue, type QueueColumnConfig } from '../../types/queue';
import type { TrackBookmarkDto } from '../../types/player';
import type { DspCombinationInfo } from '../dsp/DspStudioView';
import { type Language, getTranslations } from '../../i18n';
import { useLiveStatus } from '../../state/livePlayback';
import { PlayerQueuePanel } from './sections/PlayerQueuePanel';
import { resolveQueueTrackMeta } from './queueTrackMeta';
import { PlayerDspMiniBar } from './sections/PlayerDspMiniBar';
import { PlayerTransportControls } from './sections/PlayerTransportControls';
import { PlayerProgressSection } from './sections/PlayerProgressSection';
import { PlayerQuickDspVibes } from './sections/PlayerQuickDspVibes';
import { PlayerVisualColumn } from './sections/PlayerVisualColumn';
import { PlayerToolbar } from './sections/PlayerToolbar';

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
  handleSeekPreview?: (ms: number) => void;
  handleSeekCommit?: (ms: number) => void;
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

export const PlayerView: React.FC<PlayerViewProps> = React.memo((props) => {
  const {
    layoutMaxWidth,
    language,
    loc,
    status: statusProp,
    currentPlayingTrack,
    tracks,
    albums,
    currentAlbum,
    cleanLiveTitle,
    effectiveDisplayTitle,
    effectiveDisplayArtist,
    filePath,
    setStatsModalTrack,
    showLyrics,
    setShowLyrics,
    nowPlayingVisualMode,
    handleSeek,
    handleToggleFavorite,
    handleOpenContainingFolder,
  } = props;
  // Pozycja/spektrum na żywo (livePlayback) — renderuje się ten komponent, nie cała aplikacja.
  const status = useLiveStatus(statusProp);
  const seekProgressPercent =
    status.duration_ms && status.duration_ms > 0
      ? Math.min(100, Math.max(0, (status.position_ms / status.duration_ms) * 100))
      : 0;
  const t = loc;

  const getQueueTrackMeta = useCallback(
    (item: QueueItem) => resolveQueueTrackMeta(item, tracks, albums),
    [tracks, albums]
  );

  return (
            <div style={{ maxWidth: layoutMaxWidth, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '32px' }}>
              <div className="glass-panel" style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Górny pasek narzędziowy: silnik audio i dyskretny przycisk otwarcia pliku */}
                <PlayerToolbar {...props} status={statusProp} />

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
                  <PlayerVisualColumn {...props} status={status} />

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
                    <PlayerQuickDspVibes {...props} t={t} />

                    {/* Pasek postępu z pętlą A-B i wizualizacją przebiegu utworu (Waveform) */}
                    <PlayerProgressSection {...props} status={status} seekProgressPercent={seekProgressPercent} />

                    {/* Przyciski sterowania odtwarzaniem */}
                    <PlayerTransportControls {...props} status={statusProp} />
                  </div>
                </div>

                {/* ZINTEGROWANY MINI-PASEK DSP (Zastępuje dawne puste wielkie karty z Image 2) */}
                <PlayerDspMiniBar {...props} status={statusProp} />
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
              <PlayerQueuePanel {...props} status={statusProp} t={t} getQueueTrackMeta={getQueueTrackMeta} />
            </div>
  );
});
