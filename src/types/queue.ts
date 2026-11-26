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

export function getQueueGridTemplate(cfg: QueueColumnConfig): string {
  const parts: string[] = [];
  if (cfg.showIndex) parts.push('28px');
  if (cfg.showCover) parts.push(cfg.compactMode ? '38px' : '56px');
  parts.push('minmax(180px, 2fr)');
  if (cfg.showAlbum) parts.push('minmax(120px, 1.2fr)');
  if (cfg.showFormatBadge) parts.push('110px');
  if (cfg.showPath) parts.push('minmax(120px, 1.5fr)');
  if (cfg.showDuration) parts.push('65px');
  parts.push('140px');
  return parts.join(' ');
}

