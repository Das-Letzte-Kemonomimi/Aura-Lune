import React from 'react';
import { isMainTab, type AppTab, type MainTabType, type NowPlayingVisualMode } from '../../types/navigation';
import { getTranslations, type Translations } from '../../i18n';
import { fmt } from '../../utils/fmt';
import { cn } from '../../utils/cn';
import { Card, Skeleton, SkeletonLoadingPill } from '../ui';

const SPECTRUM_HEIGHTS = [
  'h-5', 'h-8', 'h-12', 'h-9', 'h-14', 'h-10', 'h-7', 'h-11',
  'h-13', 'h-8', 'h-6', 'h-10', 'h-12', 'h-7', 'h-9', 'h-5',
] as const;

const EQ_BAR_HEIGHTS = [
  'h-20', 'h-14', 'h-24', 'h-16', 'h-12', 'h-18', 'h-22', 'h-15', 'h-20', 'h-14',
] as const;

const TRACK_ROW_WIDTHS = [
  { title: 'w-44', artist: 'w-28', album: 'w-36' },
  { title: 'w-56', artist: 'w-32', album: 'w-40' },
  { title: 'w-40', artist: 'w-24', album: 'w-32' },
  { title: 'w-52', artist: 'w-36', album: 'w-28' },
  { title: 'w-48', artist: 'w-28', album: 'w-44' },
  { title: 'w-60', artist: 'w-32', album: 'w-36' },
  { title: 'w-44', artist: 'w-24', album: 'w-32' },
] as const;

const CARD_TITLE_WIDTHS = ['w-28', 'w-36', 'w-24', 'w-32', 'w-28', 'w-36'] as const;

const ALBUM_GRID_LAYOUT = {
  compact: 'grid-cols-[repeat(auto-fill,minmax(--spacing(38),1fr))] gap-3',
  medium: 'grid-cols-[repeat(auto-fill,minmax(--spacing(46),1fr))] gap-4',
  large: 'grid-cols-[repeat(auto-fill,minmax(--spacing(56),1fr))] gap-4.5',
} as const;

function resolveTabLabel(tab: MainTabType, loc: Translations): string {
  switch (tab) {
    case 'player':
      return loc.nav.nowPlaying;
    case 'library':
      return loc.nav.library;
    case 'playlists':
      return loc.nav.playlists;
    case 'stem-projects':
      return loc.nav.stemProjects;
    case 'radio':
      return loc.nav.radio;
    case 'dsp':
      return loc.nav.dsp;
    case 'stats':
      return loc.nav.stats;
  }
}

function resolveLoadingLabel(tab: MainTabType, loc?: Translations): string {
  const safeLoc = loc?.nav && loc?.common ? loc : getTranslations('en');
  const viewName = resolveTabLabel(tab, safeLoc);
  return fmt(safeLoc.common.loadingView, viewName);
}

/** Shared ambient radial tint placed quietly behind top-level skeleton panels. */
function AmbientGlow() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={{
        background:
          'radial-gradient(ellipse 68% 52% at 18% 15%, color-mix(in srgb, var(--accent-pink) 10%, transparent), transparent),' +
          ' radial-gradient(ellipse 60% 48% at 85% 20%, color-mix(in srgb, var(--accent-purple) 12%, transparent), transparent)',
      }}
    />
  );
}

/** Shared view header bar skeleton with icon tile, title/subtitle placeholders, and animated pill. */
function ViewHeaderSkeleton({
  loadingLabel,
  tone = 'purple',
  actions,
}: {
  loadingLabel: string;
  tone?: 'pink' | 'purple' | 'cyan' | 'amber';
  actions?: React.ReactNode;
}) {
  return (
    <Card variant="panel" padding="md" className="relative overflow-hidden">
      <AmbientGlow />
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Skeleton tone={tone} className="size-10 shrink-0 rounded-xl" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-5 w-44 rounded-lg" />
            <Skeleton className="h-3.5 w-64 max-w-[60vw] rounded-md" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          <SkeletonLoadingPill label={loadingLabel} />
        </div>
      </div>
    </Card>
  );
}

function PlayerVisualSkeleton({ visualMode }: { visualMode: NowPlayingVisualMode }) {
  if (visualMode === 'turntable') {
    return (
      <div className="relative flex size-60 items-center justify-center rounded-2xl border border-line-accent/35 bg-black/30 p-3 shadow-halo-lg shadow-accent-purple/15 @5xl:size-64">
        <Skeleton tone="purple" shape="circle" className="size-full border-2 border-accent-purple/30" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute size-18 rounded-full border border-accent-pink/35 bg-deep/80"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-4 right-5 h-24 w-2 origin-top rotate-18 rounded-full bg-white/15"
        />
      </div>
    );
  }

  if (visualMode === 'tape') {
    return (
      <div className="flex h-48 w-full max-w-68 flex-col justify-between rounded-2xl border border-line-accent/35 bg-black/35 p-4 shadow-halo-lg shadow-accent-cyan/15">
        <div className="flex items-center justify-between">
          <Skeleton tone="cyan" shape="pill" className="h-4 w-16" />
          <Skeleton shape="pill" className="h-4 w-12" />
        </div>
        <div className="flex items-center justify-around gap-3">
          <Skeleton tone="purple" shape="circle" className="size-18 border border-accent-purple/35" />
          <Skeleton className="h-7 w-14 rounded-md" />
          <Skeleton tone="pink" shape="circle" className="size-18 border border-accent-pink/35" />
        </div>
        <Skeleton className="h-6 w-full rounded-lg" />
      </div>
    );
  }

  if (visualMode === 'vumeter') {
    return (
      <div className="grid h-48 w-full max-w-68 grid-cols-2 gap-3 rounded-2xl border border-line-accent/35 bg-black/35 p-3.5 shadow-halo-lg shadow-accent-amber/15">
        {(['amber', 'pink'] as const).map((tone) => (
          <div key={tone} className="flex flex-col items-center justify-between rounded-xl border border-line bg-black/30 p-2.5">
            <Skeleton tone={tone} className="h-24 w-full rounded-t-full rounded-b-md" />
            <Skeleton className="h-3.5 w-10 rounded-sm" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="relative flex size-60 items-center justify-center rounded-2xl border border-line-accent/35 bg-black/25 p-2 shadow-halo-lg shadow-accent-purple/15 @5xl:size-64">
      <Skeleton tone="purple" className="size-full rounded-xl" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute size-16 rounded-full border border-white/10 bg-deep/65"
      />
    </div>
  );
}

function PlayerViewSkeleton({
  loadingLabel,
  layoutMaxWidth,
  visualMode = 'cover',
  showLyrics = false,
}: {
  loadingLabel: string;
  layoutMaxWidth: string;
  visualMode?: NowPlayingVisualMode;
  showLyrics?: boolean;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={loadingLabel}
      className="mx-auto my-0 flex flex-col gap-5 pb-6 motion-safe:animate-fade-in"
      style={{ maxWidth: layoutMaxWidth }}
    >
      <Card variant="panel" padding="lg" className="@container relative flex flex-col gap-5 overflow-hidden">
        <AmbientGlow />

        {/* Top toolbar */}
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Skeleton tone="purple" shape="pill" className="h-8 w-36" />
            <Skeleton shape="pill" className="h-8 w-24" />
          </div>
          <SkeletonLoadingPill label={loadingLabel} />
        </div>

        {/* 2-column player deck */}
        <div className="relative grid grid-cols-1 items-center gap-5 @3xl:grid-cols-[--spacing(64)_minmax(0,1fr)] @5xl:grid-cols-[--spacing(69)_minmax(0,1fr)] @5xl:gap-6.5">
          {/* Visual column (cover / turntable / tape / VU meter) */}
          <div className="flex w-full min-w-0 flex-col items-center gap-3">
            <Skeleton shape="pill" className="h-8 w-full max-w-69" />
            <PlayerVisualSkeleton visualMode={visualMode} />
            <div className="flex items-center gap-2">
              <Skeleton shape="pill" className="h-7 w-24" />
              <Skeleton shape="pill" className="h-7 w-24" />
            </div>
          </div>

          {/* Right column: track header, spectrum, vibes, waveform, transport */}
          <div className="flex min-w-0 flex-col gap-3.5">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton tone="pink" shape="pill" className="h-5 w-20" />
                <Skeleton tone="cyan" shape="pill" className="h-5 w-16" />
                <Skeleton shape="pill" className="h-5 w-14" />
              </div>
              <Skeleton className="h-7 w-3/4 max-w-md rounded-lg" />
              <Skeleton className="h-4 w-1/2 max-w-xs rounded-md" />
            </div>

            {/* Spectrum visualizer */}
            <div className="flex h-18 w-full items-end gap-1.5 rounded-xl border border-line bg-black/30 px-3 py-2.5">
              {SPECTRUM_HEIGHTS.map((height, idx) => (
                <Skeleton
                  key={idx}
                  tone={idx % 3 === 0 ? 'pink' : idx % 3 === 1 ? 'purple' : 'cyan'}
                  className={cn('flex-1 rounded-t-sm', height)}
                />
              ))}
            </div>

            {/* Quick DSP vibe chips */}
            <div className="flex flex-wrap gap-2">
              <Skeleton shape="pill" className="h-7 w-22" />
              <Skeleton shape="pill" className="h-7 w-24" />
              <Skeleton shape="pill" className="h-7 w-20" />
              <Skeleton shape="pill" className="h-7 w-22" />
              <Skeleton shape="pill" className="h-7 w-16" />
            </div>

            {/* Waveform & time bar */}
            <div className="flex flex-col gap-2">
              <Skeleton tone="cyan" className="h-12 w-full rounded-xl" />
              <div className="flex justify-between">
                <Skeleton className="h-3.5 w-12 rounded-md" />
                <Skeleton className="h-3.5 w-12 rounded-md" />
              </div>
            </div>

            {/* Transport controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <Skeleton shape="circle" className="size-9" />
                <Skeleton shape="circle" className="size-9" />
                <Skeleton tone="pink" shape="circle" className="size-12" />
                <Skeleton shape="circle" className="size-9" />
                <Skeleton shape="circle" className="size-9" />
              </div>
              <Skeleton shape="pill" className="h-8 w-36" />
            </div>
          </div>
        </div>

        {/* DSP mini bar */}
        <Skeleton className="relative h-11 w-full rounded-xl" />
      </Card>

      {/* Optional synced lyrics card skeleton */}
      {showLyrics && (
        <Card variant="panel" padding="md" className="flex h-72 flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <Skeleton tone="cyan" className="h-5 w-32 rounded-lg" />
            <div className="flex gap-2">
              <Skeleton shape="pill" className="h-7 w-20" />
              <Skeleton shape="circle" className="size-7" />
            </div>
          </div>
          <div className="flex flex-col items-center gap-3 py-4">
            <Skeleton className="h-4 w-64 rounded-md" />
            <Skeleton tone="purple" className="h-6 w-80 max-w-full rounded-lg" />
            <Skeleton className="h-4 w-56 rounded-md" />
            <Skeleton className="h-4 w-72 rounded-md" />
          </div>
          <div />
        </Card>
      )}

      {/* Queue panel skeleton */}
      <Card variant="panel" padding="md" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Skeleton tone="pink" className="size-11 rounded-2xl" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-5 w-36 rounded-lg" />
              <Skeleton className="h-3 w-52 rounded-md" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton tone="cyan" className="h-8 w-28 rounded-xl" />
            <Skeleton className="h-8 w-24 rounded-xl" />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {TRACK_ROW_WIDTHS.slice(0, 4).map((row, idx) => (
            <div key={idx} className="flex items-center gap-3 rounded-xl border border-line bg-card/50 px-3 py-2.5">
              <Skeleton className="h-4 w-6 rounded-md" />
              <Skeleton className="size-9 shrink-0 rounded-lg" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className={cn('h-3.5 rounded-md', row.title)} />
                <Skeleton className={cn('h-3 rounded-md', row.artist)} />
              </div>
              <Skeleton className="h-5 w-12 rounded-md" />
              <Skeleton className="h-4 w-10 rounded-md" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export interface LibraryContentSkeletonProps {
  subView?: 'tracks' | 'albums' | 'artists';
  albumViewMode?: 'grid' | 'list';
  albumGridSize?: 'compact' | 'medium' | 'large';
  hasSelectedAlbumDetail?: boolean;
  label?: string;
}

/**
 * Sub-view-specific skeleton for `LibraryView` (`tracks`, `albums` grid/list,
 * `albumDetail`, and `artists`), reused for both `MainContentRouter` and lazy sub-views.
 */
export const LibraryContentSkeleton: React.FC<LibraryContentSkeletonProps> = ({
  subView = 'tracks',
  albumViewMode = 'grid',
  albumGridSize = 'medium',
  hasSelectedAlbumDetail = false,
  label,
}) => {
  const statusProps = label
    ? { role: 'status' as const, 'aria-busy': true, 'aria-live': 'polite' as const, 'aria-label': label }
    : {};

  if (subView === 'albums' && hasSelectedAlbumDetail) {
    return (
      <div {...statusProps} className="flex flex-col gap-4 motion-safe:animate-fade-in">
        <Card variant="panel" padding="md" className="flex flex-col gap-4 rounded-3xl">
          <div className="flex items-center justify-between">
            <Skeleton tone="cyan" className="h-8 w-28 rounded-lg" />
            {label && <SkeletonLoadingPill label={label} />}
          </div>
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <Skeleton tone="purple" className="size-36 shrink-0 rounded-2xl" />
            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              <Skeleton className="h-7 w-64 max-w-full rounded-lg" />
              <Skeleton className="h-4 w-44 rounded-md" />
              <div className="flex flex-wrap gap-2">
                <Skeleton tone="purple" shape="pill" className="h-5 w-20" />
                <Skeleton tone="cyan" shape="pill" className="h-5 w-16" />
              </div>
              <div className="mt-1 flex flex-wrap gap-2">
                <Skeleton tone="pink" className="h-9 w-28 rounded-lg" />
                <Skeleton tone="cyan" className="h-9 w-28 rounded-lg" />
                <Skeleton className="h-9 w-24 rounded-lg" />
              </div>
            </div>
          </div>
        </Card>
        <Card variant="panel" padding="md" className="flex flex-col gap-2">
          {TRACK_ROW_WIDTHS.slice(0, 6).map((row, idx) => (
            <div key={idx} className="flex items-center gap-3 rounded-xl border border-line bg-card/50 px-3 py-2.5">
              <Skeleton className="h-4 w-6 rounded-md" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className={cn('h-3.5 rounded-md', row.title)} />
                <Skeleton className={cn('h-3 rounded-md', row.artist)} />
              </div>
              <Skeleton tone="cyan" className="hidden h-5 w-12 rounded-md sm:block" />
              <Skeleton className="h-4 w-11 rounded-md" />
            </div>
          ))}
        </Card>
      </div>
    );
  }

  if (subView === 'albums') {
    return (
      <Card {...statusProps} variant="panel" padding="md" className="flex flex-col gap-3 motion-safe:animate-fade-in">
        {label && (
          <div className="flex justify-end">
            <SkeletonLoadingPill label={label} />
          </div>
        )}
        {albumViewMode === 'list' ? (
          <div className="flex flex-col gap-2">
            {TRACK_ROW_WIDTHS.slice(0, 6).map((row, idx) => (
              <div key={idx} className="flex items-center gap-3.5 rounded-xl border border-line bg-card/50 px-3.5 py-2.5">
                <Skeleton tone="purple" className="size-13 shrink-0 rounded-xl" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className={cn('h-4 rounded-md', row.title)} />
                  <Skeleton className={cn('h-3 rounded-md', row.artist)} />
                </div>
                <Skeleton tone="purple" shape="pill" className="hidden h-5 w-16 sm:block" />
                <Skeleton className="h-4 w-14 rounded-md" />
              </div>
            ))}
          </div>
        ) : (
          <div className={cn('grid', ALBUM_GRID_LAYOUT[albumGridSize])}>
            {Array.from({ length: 8 }).map((_, idx) => (
              <Card key={idx} padding="none" className="flex flex-col overflow-hidden rounded-2xl">
                <Skeleton tone={idx % 2 === 0 ? 'purple' : 'pink'} className="aspect-square w-full rounded-none" />
                <div className="flex flex-col gap-1.5 p-3">
                  <Skeleton className={cn('h-4 rounded-md', CARD_TITLE_WIDTHS[idx % CARD_TITLE_WIDTHS.length])} />
                  <Skeleton className="h-3 w-24 rounded-md" />
                  <div className="mt-1 flex items-center justify-between">
                    <Skeleton tone="cyan" shape="pill" className="h-4.5 w-14" />
                    <Skeleton className="h-3 w-12 rounded-md" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>
    );
  }

  if (subView === 'artists') {
    return (
      <Card {...statusProps} variant="panel" padding="md" className="flex flex-col gap-3 motion-safe:animate-fade-in">
        {label && (
          <div className="flex justify-end">
            <SkeletonLoadingPill label={label} />
          </div>
        )}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(--spacing(64),1fr))] gap-4">
          {CARD_TITLE_WIDTHS.map((width, idx) => (
            <Card key={idx} padding="sm" className="flex flex-col gap-3 rounded-2xl">
              <div className="flex items-center gap-3.5">
                <Skeleton tone="pink" className="size-16 shrink-0 rounded-2xl" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Skeleton className={cn('h-4.5 rounded-md', width)} />
                  <div className="flex gap-1.5">
                    <Skeleton shape="pill" className="h-5 w-16" />
                    <Skeleton tone="purple" shape="pill" className="h-5 w-18" />
                  </div>
                </div>
              </div>
              <div className="mt-auto flex gap-2">
                <Skeleton tone="pink" className="h-8 flex-1 rounded-lg" />
                <Skeleton className="h-8 w-20 rounded-lg" />
              </div>
            </Card>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card {...statusProps} variant="panel" padding="md" className="flex flex-col gap-3 motion-safe:animate-fade-in">
      {label && (
        <div className="flex justify-end">
          <SkeletonLoadingPill label={label} />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, idx) => (
          <Skeleton key={idx} shape="pill" className="h-7 w-22" />
        ))}
      </div>
      <div className="flex flex-col gap-2 pt-1">
        {TRACK_ROW_WIDTHS.map((row, idx) => (
          <div key={idx} className="flex items-center gap-3 rounded-xl border border-line bg-card/50 px-3 py-2.5">
            <Skeleton className="h-4 w-6 rounded-md" />
            <Skeleton className="size-10 shrink-0 rounded-lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className={cn('h-3.5 rounded-md', row.title)} />
              <Skeleton className={cn('h-3 rounded-md', row.artist)} />
            </div>
            <Skeleton className={cn('hidden h-3.5 rounded-md md:block', row.album)} />
            <Skeleton tone="cyan" className="hidden h-5 w-12 rounded-md sm:block" />
            <Skeleton className="h-4 w-11 rounded-md" />
          </div>
        ))}
      </div>
    </Card>
  );
};

function LibraryViewSkeleton({
  loadingLabel,
  librarySubView = 'tracks',
  albumViewMode = 'grid',
  albumGridSize = 'medium',
  hasSelectedAlbumDetail = false,
}: {
  loadingLabel: string;
  librarySubView?: 'tracks' | 'albums' | 'artists';
  albumViewMode?: 'grid' | 'list';
  albumGridSize?: 'compact' | 'medium' | 'large';
  hasSelectedAlbumDetail?: boolean;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={loadingLabel}
      className="flex flex-col gap-4 motion-safe:animate-fade-in"
    >
      {/* Header panel + 3 stat tiles */}
      <Card variant="panel" padding="md" className="relative flex flex-col gap-4 overflow-hidden">
        <AmbientGlow />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Skeleton tone="pink" className="size-10 rounded-xl" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-5 w-40 rounded-lg" />
              <Skeleton className="h-3.5 w-60 max-w-[55vw] rounded-md" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton tone="pink" className="h-8 w-28 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
            <SkeletonLoadingPill label={loadingLabel} />
          </div>
        </div>

        <div className="relative grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {(['pink', 'purple', 'cyan'] as const).map((tone) => (
            <Card key={tone} padding="none" className="flex items-center gap-3 px-4 py-3">
              <Skeleton tone={tone} shape="circle" className="size-9" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3 w-16 rounded-md" />
                <Skeleton className="h-4.5 w-14 rounded-md" />
              </div>
            </Card>
          ))}
        </div>
      </Card>

      {/* Toolbar */}
      <Card variant="panel" padding="sm" className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton tone={librarySubView === 'tracks' ? 'purple' : 'neutral'} className="h-8 w-24 rounded-lg" />
          <Skeleton tone={librarySubView === 'albums' ? 'purple' : 'neutral'} className="h-8 w-24 rounded-lg" />
          <Skeleton tone={librarySubView === 'artists' ? 'purple' : 'neutral'} className="h-8 w-24 rounded-lg" />
        </div>
        <div className="flex flex-1 items-center justify-end gap-2">
          <Skeleton className="h-8 w-56 max-w-full rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      </Card>

      <LibraryContentSkeleton
        subView={librarySubView}
        albumViewMode={albumViewMode}
        albumGridSize={albumGridSize}
        hasSelectedAlbumDetail={hasSelectedAlbumDetail}
      />
    </div>
  );
}

/** Track table skeleton displayed inside `PlaylistsView` while a playlist's tracks load. */
export function PlaylistTracksSkeleton({ label }: { label?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={label}
      className="flex flex-col gap-2.5 motion-safe:animate-fade-in"
    >
      {label && (
        <div className="flex justify-end">
          <SkeletonLoadingPill label={label} />
        </div>
      )}
      {TRACK_ROW_WIDTHS.slice(0, 6).map((row, idx) => (
        <div key={idx} className="flex items-center gap-3 rounded-xl border border-line bg-card/50 px-3 py-2.5">
          <Skeleton className="h-4 w-6 rounded-md" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className={cn('h-3.5 rounded-md', row.title)} />
            <Skeleton className={cn('h-3 rounded-md', row.artist)} />
          </div>
          <Skeleton tone="purple" className="hidden h-5 w-12 rounded-md sm:block" />
          <Skeleton className="h-4 w-11 rounded-md" />
        </div>
      ))}
    </div>
  );
}

function PlaylistsViewSkeleton({
  loadingLabel,
  hasSelectedPlaylist = false,
}: {
  loadingLabel: string;
  hasSelectedPlaylist?: boolean;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={loadingLabel}
      className="flex flex-col gap-4 motion-safe:animate-fade-in"
    >
      <ViewHeaderSkeleton
        tone="pink"
        loadingLabel={loadingLabel}
        actions={
          <>
            <div className="flex items-center gap-1.5 rounded-2xl border border-line bg-black/20 p-1.5">
              <Skeleton className="h-7 w-40 rounded-lg" />
              <Skeleton tone="pink" className="h-7 w-20 rounded-lg" />
            </div>
            <Skeleton tone="cyan" className="h-9 w-28 rounded-lg" />
          </>
        }
      />

      {hasSelectedPlaylist ? (
        <div className="flex flex-col gap-4">
          <Card variant="panel" padding="md" className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <Skeleton tone="cyan" className="h-8 w-28 rounded-lg" />
              <Skeleton className="h-3.5 w-20 rounded-md" />
            </div>
            <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
              <Skeleton tone="pink" className="size-28 shrink-0 rounded-2xl" />
              <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                <Skeleton className="h-7 w-56 max-w-full rounded-lg" />
                <div className="flex gap-2">
                  <Skeleton tone="purple" shape="pill" className="h-5 w-20" />
                  <Skeleton className="h-5 w-14 rounded-md" />
                </div>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Skeleton tone="pink" className="h-9 w-24 rounded-lg" />
                  <Skeleton tone="cyan" className="h-9 w-28 rounded-lg" />
                  <Skeleton className="h-9 w-24 rounded-lg" />
                </div>
              </div>
            </div>
          </Card>
          <Card variant="panel" padding="md">
            <PlaylistTracksSkeleton />
          </Card>
        </div>
      ) : (
        <Card variant="panel" padding="md" className="flex flex-col items-center gap-3 px-6 py-10">
          <Skeleton tone="pink" shape="circle" className="size-12" />
          <Skeleton className="h-4.5 w-48 max-w-full rounded-md" />
          <Skeleton className="h-3 w-72 max-w-full rounded-md" />
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <Skeleton tone="pink" shape="pill" className="h-6 w-24" />
            <Skeleton tone="purple" shape="pill" className="h-6 w-20" />
            <Skeleton tone="cyan" shape="pill" className="h-6 w-24" />
          </div>
        </Card>
      )}
    </div>
  );
}

/** Wide single-card skeleton reused for `StemProjectsLibraryView` Suspense and IPC fetch. */
export function StemProjectsCardSkeleton({ label }: { label?: string }) {
  return (
    <Card
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={label}
      variant="panel"
      padding="md"
      className="flex flex-col gap-4 px-6 py-8 motion-safe:animate-fade-in"
    >
      {label && (
        <div className="flex justify-end">
          <SkeletonLoadingPill label={label} />
        </div>
      )}
      <div className="flex flex-col items-center gap-3 text-center">
        <Skeleton tone="cyan" className="size-12 rounded-2xl" />
        <Skeleton className="h-4.5 w-52 max-w-full rounded-md" />
        <Skeleton className="h-3 w-80 max-w-full rounded-md" />
        <div className="mt-1 grid w-full max-w-md grid-cols-4 gap-2 rounded-xl border border-line bg-black/25 p-2.5">
          <Skeleton tone="pink" shape="pill" className="h-2.5 w-full" />
          <Skeleton tone="cyan" shape="pill" className="h-2.5 w-full" />
          <Skeleton tone="purple" shape="pill" className="h-2.5 w-full" />
          <Skeleton tone="amber" shape="pill" className="h-2.5 w-full" />
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
          <Skeleton className="h-3 w-20 rounded-md" />
          <Skeleton className="h-3 w-16 rounded-md" />
          <Skeleton tone="purple" className="h-8.5 w-36 rounded-lg" />
        </div>
      </div>
    </Card>
  );
}

function StemProjectsViewSkeleton({ loadingLabel }: { loadingLabel: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={loadingLabel}
      className="flex w-full flex-col gap-4 motion-safe:animate-fade-in"
    >
      <ViewHeaderSkeleton
        tone="cyan"
        loadingLabel={loadingLabel}
        actions={<Skeleton tone="purple" className="h-9 w-40 rounded-lg" />}
      />
      <StemProjectsCardSkeleton />
    </div>
  );
}

function RadioViewSkeleton({ loadingLabel }: { loadingLabel: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={loadingLabel}
      className="flex flex-col gap-5 pb-6 motion-safe:animate-fade-in"
    >
      <ViewHeaderSkeleton
        tone="pink"
        loadingLabel={loadingLabel}
        actions={<Skeleton tone="pink" className="h-9 w-36 rounded-lg" />}
      />
      <div className="flex flex-col gap-3.5">
        <div className="flex items-center gap-2.5">
          <Skeleton tone="purple" className="size-9 rounded-lg" />
          <Skeleton className="h-4.5 w-48 rounded-md" />
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(--spacing(64),1fr))] gap-4">
          {CARD_TITLE_WIDTHS.map((width, idx) => (
            <Card key={idx} padding="md" className="flex flex-col gap-3 rounded-2xl">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className={cn('h-4.5 rounded-md', width)} />
                <Skeleton tone="pink" shape="pill" className="h-5 w-20 shrink-0" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-full rounded-md" />
                <Skeleton className="h-3.5 w-4/5 rounded-md" />
              </div>
              <div className="mt-1 flex items-center justify-between border-t border-line pt-3">
                <Skeleton className="h-3.5 w-20 rounded-md" />
                <Skeleton tone="pink" className="h-8 w-20 rounded-lg" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function DspViewSkeleton({ loadingLabel }: { loadingLabel: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={loadingLabel}
      className="flex flex-col gap-4 motion-safe:animate-fade-in"
    >
      <ViewHeaderSkeleton
        tone="purple"
        loadingLabel={loadingLabel}
        actions={
          <>
            <Skeleton shape="pill" className="h-7 w-24" />
            <Skeleton tone="amber" className="h-7 w-28 rounded-lg" />
          </>
        }
      />

      {/* Engine selector */}
      <Card variant="panel" padding="md" className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {(['cyan', 'pink', 'purple'] as const).map((tone) => (
          <Card key={tone} padding="sm" className="flex flex-col gap-2">
            <Skeleton tone={tone} className="h-4.5 w-32 rounded-md" />
            <Skeleton className="h-3 w-full rounded-md" />
            <Skeleton className="h-3 w-3/4 rounded-md" />
          </Card>
        ))}
      </Card>

      {/* 2x2 DSP parameter racks */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {(['pink', 'purple', 'cyan', 'amber'] as const).map((tone) => (
          <Card key={tone} variant="panel" padding="md" className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Skeleton tone={tone} className="size-9 rounded-lg" />
                <Skeleton className="h-4.5 w-36 rounded-md" />
              </div>
              <Skeleton tone={tone} shape="pill" className="h-6 w-16" />
            </div>
            <Skeleton className="h-3 w-full rounded-full" />
            <div className="flex gap-2">
              <Skeleton className="h-7 w-14 rounded-lg" />
              <Skeleton className="h-7 w-14 rounded-lg" />
              <Skeleton className="h-7 w-14 rounded-lg" />
            </div>
          </Card>
        ))}
      </div>

      {/* 10-band graphic EQ */}
      <Card variant="panel" padding="md" className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-44 rounded-lg" />
          <div className="flex gap-2">
            <Skeleton className="h-7 w-24 rounded-lg" />
            <Skeleton className="h-7 w-20 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-10 items-end gap-2 rounded-xl border border-line bg-black/25 p-4">
          {EQ_BAR_HEIGHTS.map((height, idx) => (
            <div key={idx} className="flex flex-col items-center gap-2">
              <Skeleton tone={idx % 2 === 0 ? 'purple' : 'cyan'} className={cn('w-3 rounded-full', height)} />
              <Skeleton className="h-3 w-8 rounded-sm" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function StatsViewSkeleton({ loadingLabel }: { loadingLabel: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={loadingLabel}
      className="flex flex-col gap-5 motion-safe:animate-fade-in"
    >
      <ViewHeaderSkeleton
        tone="purple"
        loadingLabel={loadingLabel}
        actions={<Skeleton tone="pink" className="h-8 w-24 rounded-lg" />}
      />

      {/* 4 KPI cards */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(--spacing(55),1fr))] gap-3.5">
        {(['purple', 'amber', 'cyan', 'pink'] as const).map((tone) => (
          <Card key={tone} padding="none" className="flex items-center gap-3.5 rounded-2xl px-5 py-4.5">
            <Skeleton tone={tone} className="size-11.5 shrink-0 rounded-xl" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3 w-24 rounded-md" />
              <Skeleton className="h-6 w-20 rounded-lg" />
            </div>
          </Card>
        ))}
      </div>

      {/* Middle 2 panels */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(--spacing(76),1fr))] gap-4.5">
        {(['amber', 'purple'] as const).map((tone) => (
          <Card key={tone} variant="panel" padding="none" className="px-5.5 py-5">
            <div className="mb-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Skeleton tone={tone} className="size-9 rounded-lg" />
                <Skeleton className="h-4.5 w-32 rounded-md" />
              </div>
              <Skeleton shape="pill" className="h-5 w-14" />
            </div>
            <div className="flex flex-col gap-2">
              {TRACK_ROW_WIDTHS.slice(0, 5).map((row, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2.5 rounded-xl bg-black/30 px-3.5 py-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Skeleton shape="circle" className="size-7 shrink-0" />
                    <div className="flex flex-col gap-1">
                      <Skeleton className={cn('h-3.5 rounded-md', row.title)} />
                      <Skeleton className={cn('h-3 rounded-md', row.artist)} />
                    </div>
                  </div>
                  <Skeleton tone={tone} shape="pill" className="h-6 w-14 shrink-0" />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export interface ViewLoadingSkeletonProps {
  tab: AppTab;
  layoutMaxWidth: string;
  loc?: Translations;
  visualMode?: NowPlayingVisualMode;
  showLyrics?: boolean;
  librarySubView?: 'tracks' | 'albums' | 'artists';
  albumViewMode?: 'grid' | 'list';
  albumGridSize?: 'compact' | 'medium' | 'large';
  hasSelectedAlbumDetail?: boolean;
  hasSelectedPlaylist?: boolean;
}

/**
 * Tailored shimmer skeleton rendered while a lazy-loaded view chunk mounts and
 * renders in the background. Adapts to both the active tab and its active sub-view.
 */
export const ViewLoadingSkeleton: React.FC<ViewLoadingSkeletonProps> = ({
  tab,
  layoutMaxWidth,
  loc,
  visualMode,
  showLyrics,
  librarySubView,
  albumViewMode,
  albumGridSize,
  hasSelectedAlbumDetail,
  hasSelectedPlaylist,
}) => {
  const mainTab: MainTabType = isMainTab(tab) ? tab : 'player';
  const loadingLabel = resolveLoadingLabel(mainTab, loc);

  switch (mainTab) {
    case 'player':
      return (
        <PlayerViewSkeleton
          loadingLabel={loadingLabel}
          layoutMaxWidth={layoutMaxWidth}
          visualMode={visualMode}
          showLyrics={showLyrics}
        />
      );
    case 'library':
      return (
        <LibraryViewSkeleton
          loadingLabel={loadingLabel}
          librarySubView={librarySubView}
          albumViewMode={albumViewMode}
          albumGridSize={albumGridSize}
          hasSelectedAlbumDetail={hasSelectedAlbumDetail}
        />
      );
    case 'playlists':
      return (
        <PlaylistsViewSkeleton
          loadingLabel={loadingLabel}
          hasSelectedPlaylist={hasSelectedPlaylist}
        />
      );
    case 'stem-projects':
      return <StemProjectsViewSkeleton loadingLabel={loadingLabel} />;
    case 'radio':
      return <RadioViewSkeleton loadingLabel={loadingLabel} />;
    case 'dsp':
      return <DspViewSkeleton loadingLabel={loadingLabel} />;
    case 'stats':
      return <StatsViewSkeleton loadingLabel={loadingLabel} />;
  }
};
