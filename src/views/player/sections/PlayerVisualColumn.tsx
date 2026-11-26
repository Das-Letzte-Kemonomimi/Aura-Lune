import React, { useMemo } from 'react';
import { CassetteTape, Disc, Disc3, Gauge, Sparkles, Upload } from 'lucide-react';
import { TapeDeckWidget } from '../../../components/player/TapeDeckWidget';
import { VinylTurntable } from '../../../components/player/VinylTurntable';
import { VuMeterWidget } from '../../../components/player/VuMeterWidget';
import type { PlaybackStatus } from '../../../types/player';
import type { PlayerViewProps } from '../PlayerView';
import { fmt } from '../../../utils/fmt';
import { arePlayerVisualColumnPropsEqual } from './playerVisualColumnMemo';
import { cn } from '../../../utils/cn';

export type PlayerVisualColumnProps = Pick<PlayerViewProps, 'nowPlayingVisualMode' | 'handleSelectNowPlayingVisualMode' | 'loc' | 'language' | 'currentCover' | 'currentPlayingTrack' | 'tracks' | 'handlePlayPause' | 'vinylRpm' | 'handleSelectVinylRpm' | 'setIsLoFiModalOpen' | 'tapeType' | 'handleSelectTapeType' | 'tapeSpeed' | 'handleSelectTapeSpeed' | 'currentAlbum' | 'handleOpenCoverPicker' | 'albums' | 'handleUploadCustomCoverDirect' | 'dspBadgeTitle' | 'dspBadgeText'> & {
  status: PlaybackStatus;
};

const PlayerVisualColumnBase: React.FC<PlayerVisualColumnProps> = ({
  albums,
  currentAlbum,
  currentCover,
  currentPlayingTrack,
  dspBadgeText,
  dspBadgeTitle,
  handleOpenCoverPicker,
  handlePlayPause,
  handleSelectNowPlayingVisualMode,
  handleSelectTapeSpeed,
  handleSelectTapeType,
  handleSelectVinylRpm,
  handleUploadCustomCoverDirect,
  language,
  loc,
  nowPlayingVisualMode,
  setIsLoFiModalOpen,
  status,
  tapeSpeed,
  tapeType,
  tracks,
  vinylRpm,
}) => {
  // BPM of the current track: looked up in the library only when the track/library changes, not on every tick
  const currentTrackId = status.current_track?.track_id;
  const currentTrackUri = status.current_track?.uri;
  const turntableBpm = useMemo(
    () =>
      currentPlayingTrack?.bpm ||
      tracks.find((t) => (currentTrackId && t.id === currentTrackId) || t.path === currentTrackUri)?.bpm ||
      null,
    [currentPlayingTrack?.bpm, tracks, currentTrackId, currentTrackUri]
  );

  return (
    <div className="flex w-full flex-col items-center">
      {/* Visual mode selector: cover • hi-fi vinyl • tape • VU meter */}
      <div
        className={cn(
          'mb-2.5 flex w-full gap-1 rounded-lg bg-black/35 p-1 transition-[max-width] duration-200',
          nowPlayingVisualMode === 'cover' ? 'max-w-60' : 'max-w-69',
        )}
      >
        <button
          onClick={() => handleSelectNowPlayingVisualMode('cover')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1 rounded-md border-0 px-1.5 py-1 text-xs font-bold',
            nowPlayingVisualMode === 'cover' ? 'bg-accent-pink text-fg' : 'bg-transparent text-fg-muted',
          )}
        >
          <Disc size={13} /> {loc.player.displayCover}
        </button>
        <button
          onClick={() => handleSelectNowPlayingVisualMode('turntable')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1 rounded-md border-0 px-1.5 py-1 text-xs font-bold',
            nowPlayingVisualMode === 'turntable' ? 'bg-accent-pink text-fg' : 'bg-transparent text-fg-muted',
          )}
        >
          <Disc3 size={13} /> {loc.player.displayVinyl}
        </button>
        <button
          onClick={() => handleSelectNowPlayingVisualMode('tape')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1 rounded-md border-0 px-1.5 py-1 text-xs font-bold',
            nowPlayingVisualMode === 'tape' ? 'bg-accent-pink text-fg' : 'bg-transparent text-fg-muted',
          )}
        >
          <CassetteTape size={13} /> {loc.player.displayTape}
        </button>
        <button
          onClick={() => handleSelectNowPlayingVisualMode('vumeter')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1 rounded-md border-0 px-1.5 py-1 text-xs font-bold',
            nowPlayingVisualMode === 'vumeter' ? 'bg-accent-pink text-fg' : 'bg-transparent text-fg-muted',
          )}
        >
          <Gauge size={13} /> VU
        </button>
      </div>

      {nowPlayingVisualMode === 'turntable' ? (
        <VinylTurntable
          currentLang={language}
          coverUrl={currentCover}
          isPlaying={status.state === 'Playing'}
          tempo={status.tempo_ratio ?? 1.0}
          rate={status.rate_ratio ?? 1.0}
          engine={status.engine}
          isDspActive={status.engine !== 'Bypass'}
          bpm={turntableBpm}
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
          currentLang={language}
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
          className="h-44 w-full"
        />
      ) : (
        <div
          className={cn(
            'relative flex size-55 transform-gpu items-center justify-center overflow-hidden rounded-3xl transition-shadow duration-300 will-change-transform',
            status.state === 'Playing' ? 'shadow-halo-xl shadow-accent-pink/45' : 'shadow-panel',
          )}
          style={{
            background: currentCover
              ? `url("${currentCover}") center/cover no-repeat`
              : 'radial-gradient(circle at center, #1e1b4b 0%, #0f172a 60%, #030712 100%)',
          }}
        >
          {!currentCover && (
            <div
              className={cn(
                'flex h-47 w-47 items-center justify-center rounded-full border-2 border-white/8',
                status.state === 'Playing' && 'animate-spin',
              )}
              style={{
                background: 'radial-gradient(circle, #0b0f19 35%, #182032 50%, #0f172a 75%, #050811 100%)',
                boxShadow: 'inset 0 0 18px rgba(0,0,0,0.85), 0 0 10px rgba(0,0,0,0.5)',
              }}
            >
              {/* Vinyl centre with the Kitsune logo */}
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full border-3 border-black/60 bg-accent-gradient shadow-halo-sm shadow-accent-pink/50"
              >
                <Disc size={28} className="text-fg" />
              </div>
            </div>
          )}

          {/* Format badge on the cover */}
          <div
            className="absolute bottom-2.5 right-2.5 rounded-md border border-accent-cyan/35 bg-black/90 px-2 py-1 text-xxs font-bold tracking-wider text-accent-cyan"
          >
            {status.current_track?.duration_ms ? 'HI-RES AUDIO' : 'PIPEWIRE'}
          </div>
        </div>
      )}

      {/* Buttons or controls below the visual element, depending on the mode */}
      {nowPlayingVisualMode === 'cover' ? (
        <div className="mt-2.5 flex w-full max-w-60 gap-2">
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
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-accent-pink/35 bg-linear-135 from-accent-pink/20 to-accent-purple/20 p-2 text-xs font-bold text-fg transition-all duration-200"
          >
            <Sparkles size={12} className="text-accent-pink" /> {loc.covers.matchCover}
          </button>
          <button
            onClick={() => handleUploadCustomCoverDirect(currentAlbum)}
            title={loc.covers.uploadCustomCover}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-accent-cyan/35 bg-accent-cyan/15 p-2 text-xs font-bold text-fg transition-all duration-200"
          >
            <Upload size={12} className="text-accent-cyan" /> {loc.covers.uploadCustomCover}
          </button>
        </div>
      ) : nowPlayingVisualMode === 'turntable' ? (
        <div className="mt-2 flex w-full justify-center">
          <div
            title={dspBadgeTitle}
            className="flex flex-wrap items-center justify-center gap-1.5 rounded-md border border-line bg-black/40 px-2.5 py-1 text-center font-mono text-xxs text-fg-muted"
          >
            <Disc3 size={11} className="text-accent-pink" />
            {status.state === 'Playing'
              ? `${fmt(loc.player.vinylPlayingStatus, vinylRpm === 33 ? '33⅓' : '45')} (${dspBadgeText})`
              : fmt(loc.player.vinylPausedStatus, vinylRpm === 33 ? '33⅓' : '45')}
          </div>
        </div>
      ) : nowPlayingVisualMode === 'tape' ? (
        <div className="mt-2 flex w-full justify-center">
          <div
            title={dspBadgeTitle}
            className="flex flex-wrap items-center justify-center gap-1.5 rounded-md border border-line bg-black/40 px-2.5 py-1 text-center font-mono text-xxs text-fg-muted"
          >
            <CassetteTape size={11} className="text-accent-pink" />
            {status.state === 'Playing'
              ? `${fmt(loc.player.tapePlayingStatus, tapeSpeed === '7.5' ? '7½' : '3¾', tapeType === 'TYPE_I' ? 'FE-I' : tapeType === 'TYPE_II' ? 'CR-II' : 'METAL')} (${dspBadgeText})`
              : fmt(loc.player.tapePausedStatus, tapeSpeed === '7.5' ? '7½' : '3¾', tapeType === 'TYPE_I' ? 'FE-I' : tapeType === 'TYPE_II' ? 'CR-II' : 'METAL')}
          </div>
        </div>
      ) : (
        <div className="mt-2 flex w-full max-w-70 items-center justify-between px-1 py-0">
          <span className="font-mono text-xxs text-fg-muted">
            0 VU = +4 dBu (1.23V)
          </span>
          <span
            className={cn(
              'flex items-center gap-1 text-xxs font-semibold',
              status.state === 'Playing' ? 'text-accent-green' : 'text-fg-muted',
            )}
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                status.state === 'Playing' ? 'bg-accent-green shadow-halo-sm shadow-accent-green' : 'bg-fg-muted shadow-none',
              )}
            />
            {status.state === 'Playing' ? loc.player.meterActive : loc.player.meterStandby}
          </span>
        </div>
      )}
    </div>
  );
};

/** See `statusUnchanged` in `playerVisualColumnMemo.ts`: skips the ~10 Hz position and spectrum changes. */
export const PlayerVisualColumn = React.memo(PlayerVisualColumnBase, arePlayerVisualColumnPropsEqual);
