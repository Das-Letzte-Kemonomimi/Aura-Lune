export interface QueueItem {
  id: string;
  track_id: number | null;
  uri: string;
  title: string;
  artist: string;
  album: string | null;
  duration_ms: number;
}

export interface PlaybackQueue {
  items: QueueItem[];
  current_index: number | null;
  loop_mode: 'None' | 'Track' | 'Queue';
  shuffle: boolean;
  shuffle_order: number[];
  shuffle_cursor: number;
}

export interface QueueColumnConfig {
  showIndex: boolean;
  showCover: boolean;
  showArtist: boolean;
  showAlbum: boolean;
  showFormatBadge: boolean;
  showDuration: boolean;
  showPath: boolean;
  compactMode: boolean;
}

export const DEFAULT_QUEUE_COLUMNS: QueueColumnConfig = {
  showIndex: true,
  showCover: true,
  showArtist: true,
  showAlbum: true,
  showFormatBadge: true,
  showDuration: true,
  showPath: false,
  compactMode: false,
};
