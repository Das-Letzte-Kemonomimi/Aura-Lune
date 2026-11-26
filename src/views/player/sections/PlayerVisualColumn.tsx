import React, { useMemo } from 'react';
import { CassetteTape, Disc, Disc3, Sparkles, Upload } from '../../../components/ui/icons';
import { TapeDeckWidget } from '../../../components/player/TapeDeckWidget';
import { VinylTurntable } from '../../../components/player/VinylTurntable';
import { VuMeterWidget } from '../../../components/player/VuMeterWidget';
import type { PlaybackStatus } from '../../../types/player';
import type { PlayerViewProps } from '../PlayerView';
import { fmt } from '../../../utils/fmt';
import { arePlayerVisualColumnPropsEqual } from './playerVisualColumnMemo';
import { cn } from '../../../utils/cn';
import { Button, SegmentedControl, StatusDot } from '../../../components/ui';

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
    <div className="flex w-full min-w-0 flex-col items-center">
      {/* Visual mode selector: cover • hi-fi vinyl • tape • VU meter */}
      <SegmentedControl
        label={loc.player.displayModeLabel}
        size="sm"
        fullWidth
        value={nowPlayingVisualMode}
        onChange={handleSelectNowPlayingVisualMode}
        items={[
          { value: 'cover', label: loc.player.displayCover },
          { value: 'turntable', label: loc.player.displayVinyl },
          { value: 'tape', label: loc.player.displayTape },
          { value: 'vumeter', label: 'VU' },
        ]}
        className="mb-2.5 max-w-69"
      />

      <div
        key={nowPlayingVisualMode}
        className="flex w-full min-w-0 flex-col items-center motion-safe:animate-fade-in"
      >
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
          <div className="flex h-66 w-full items-center">
            <VuMeterWidget
              spectrum={status.spectrum}
              volume={status.volume}
              isPlaying={status.state === 'Playing'}
              className="h-48 w-full"
            />
          </div>
        ) : (
          <div
            className={cn(
              'relative flex size-66 transform-gpu items-center justify-center overflow-hidden rounded-3xl transition-shadow duration-300 will-change-transform',
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
                  'flex size-56 items-center justify-center rounded-full border-2 border-line',
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
          <div className="mt-2.5 grid w-full max-w-66 grid-cols-2 gap-2">
            <Button
              variant="tinted"
              tone="pink"
              size="sm"
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
              className="min-w-0 whitespace-normal px-2 py-1.5 text-center leading-tight"
            >
              <Sparkles size={12} className="shrink-0" />
              <span className="min-w-0">{loc.covers.matchCover}</span>
            </Button>
            <Button
              variant="tinted"
              tone="cyan"
              size="sm"
              onClick={() => handleUploadCustomCoverDirect(currentAlbum)}
              title={loc.covers.uploadCustomCover}
              className="min-w-0 whitespace-normal px-2 py-1.5 text-center leading-tight"
            >
              <Upload size={12} className="shrink-0" />
              <span className="min-w-0">{loc.covers.uploadCustomCover}</span>
            </Button>
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
          <div className="mt-2 flex w-full max-w-69 items-center justify-between px-1 py-0">
            <span className="font-mono text-xxs text-fg-muted">
              0 VU = +4 dBu (1.23V)
            </span>
            <span
              className={cn(
                'flex items-center gap-1 text-xxs font-semibold',
                status.state === 'Playing' ? 'text-accent-green' : 'text-fg-muted',
              )}
            >
              <StatusDot tone={status.state === 'Playing' ? 'green' : 'neutral'} className="size-1.5" />
              {status.state === 'Playing' ? loc.player.meterActive : loc.player.meterStandby}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

/** See `statusUnchanged` in `playerVisualColumnMemo.ts`: skips the ~10 Hz position and spectrum changes. */
export const PlayerVisualColumn = React.memo(PlayerVisualColumnBase, arePlayerVisualColumnPropsEqual);
