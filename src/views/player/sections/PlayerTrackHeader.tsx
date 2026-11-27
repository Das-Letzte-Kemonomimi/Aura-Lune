import React from 'react';
import { BarChart3, Disc, FolderOpen, Heart } from '../../../components/ui/icons';
import type { PlaybackStatus, TrackRecord } from '../../../types/player';
import type { PlayerViewProps } from '../PlayerView';
import { cn } from '../../../utils/cn';
import { Badge, Chip, IconButton, StatusDot } from '../../../components/ui';

export type PlayerTrackHeaderProps = Pick<
  PlayerViewProps,
  'loc' | 'currentAlbum' | 'currentPlayingTrack' | 'cleanLiveTitle' | 'effectiveDisplayTitle' | 'effectiveDisplayArtist' | 'filePath' | 'setStatsModalTrack' | 'handleToggleFavorite' | 'handleOpenContainingFolder'
> & {
  status: PlaybackStatus;
};

/** Stand-in record for the stats modal when the playing track is not in the library. */
function trackForStats(status: PlaybackStatus, filePath: string | null, unknownArtist: string): TrackRecord {
  const current = status.current_track;
  const fallbackTitle = filePath ? filePath.split('/').pop() || 'Auralune Audio Player' : 'Auralune Audio Player';
  return {
    id: current?.track_id || 0,
    title: current?.title || fallbackTitle,
    artist: current?.artist || unknownArtist,
    album_artist: current?.artist || null,
    album_id: null,
    disc_no: null,
    track_no: null,
    bit_depth: null,
    file_size: 0,
    modified_time: 0,
    path: current?.uri || filePath || '',
    duration_ms: status.duration_ms || 0,
    format: 'AUDIO',
    sample_rate: 44100,
    channels: 2,
    play_count: 0,
    last_played_at: null,
  };
}

// Memo: only the state, not the playback position, matters here.
export const PlayerTrackHeader: React.FC<PlayerTrackHeaderProps> = React.memo(({
  cleanLiveTitle,
  currentAlbum,
  currentPlayingTrack,
  effectiveDisplayArtist,
  effectiveDisplayTitle,
  filePath,
  handleOpenContainingFolder,
  handleToggleFavorite,
  loc,
  setStatsModalTrack,
  status,
}) => {
  const albumTitle = currentAlbum?.title || status.current_track?.album || '';
  const location = currentPlayingTrack?.path || status.current_track?.uri || filePath || '';
  const stateTone = status.state === 'Playing' ? 'green' : status.state === 'Paused' ? 'amber' : 'neutral';
  const stateLabel = status.state === 'Playing' ? loc.player.statePlaying : status.state === 'Paused' ? loc.player.statePaused : loc.player.stateStopped;
  const favorite = Boolean(currentPlayingTrack?.is_favorite);

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2">
          <StatusDot tone={stateTone} pulse={status.state === 'Playing'} />
          <span className="label-caps text-fg-muted">{stateLabel}</span>
        </div>
        <h3 className="truncate text-3xl leading-tight font-extrabold tracking-tight text-fg" title={effectiveDisplayTitle}>
          {effectiveDisplayTitle}
        </h3>
        <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5">
          <span className="truncate text-md font-bold text-accent-pink" title={effectiveDisplayArtist}>
            {effectiveDisplayArtist}
          </span>
          {albumTitle && (
            <span className="flex min-w-0 items-center gap-1.5 text-ui font-medium text-fg-secondary" title={albumTitle}>
              <Disc size={13} className="shrink-0 text-fg-muted" />
              <span className="truncate">{albumTitle}</span>
            </span>
          )}
        </div>
        {cleanLiveTitle && (
          <Badge tone="pink" size="sm" className="mt-2 gap-1.5">
            <StatusDot tone="red" pulse className="size-1.5" />
            LIVE: {cleanLiveTitle}
          </Badge>
        )}
      </div>

      {/* Track actions: favorite, stats and the containing folder */}
      <div className="flex shrink-0 items-center gap-1 rounded-2xl border border-line bg-black/25 p-1">
        {currentPlayingTrack && (
          <Chip
            pressed={favorite}
            onClick={(e) => handleToggleFavorite(currentPlayingTrack.id, e)}
            aria-label={favorite ? loc.player.favoriteRemove : loc.player.favoriteAdd}
            title={favorite ? loc.player.favoriteRemove : loc.player.favoriteAdd}
            className="size-8 rounded-xl p-0"
          >
            <Heart fill={favorite ? 'currentColor' : 'none'} size={15} />
          </Chip>
        )}
        <Chip
          tone="amber"
          pressed={false}
          onClick={() => setStatsModalTrack(currentPlayingTrack ?? trackForStats(status, filePath, loc.player.unknownArtist))}
          title={loc.player.trackStats}
          className={cn('h-8 rounded-xl border-transparent bg-transparent px-2.5 text-accent-amber')}
        >
          <BarChart3 size={15} />
          <span className="font-mono tabular-nums">{currentPlayingTrack?.play_count || 0}</span>
          <span className="text-fg-muted">{loc.player.plays}</span>
        </Chip>
        {location && (
          <IconButton
            variant="secondary"
            label={loc.queue.openContainingFolder}
            onClick={(e) => handleOpenContainingFolder(location, e)}
            className="size-8 rounded-xl text-accent-cyan"
          >
            <FolderOpen size={15} />
          </IconButton>
        )}
      </div>
    </div>
  );
});
