import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  LibraryContentSkeleton,
  PlaylistTracksSkeleton,
  SettingsModalSkeleton,
  StemProjectsCardSkeleton,
  ViewLoadingSkeleton,
} from './ViewLoadingSkeleton';
import { getTranslations } from '../../i18n';
import type { MainTabType, NowPlayingVisualMode } from '../../types/navigation';

const loc = getTranslations('en');

afterEach(cleanup);

describe('ViewLoadingSkeleton', () => {
  const cases: Array<{ tab: MainTabType; navLabel: string }> = [
    { tab: 'player', navLabel: loc.nav.nowPlaying },
    { tab: 'library', navLabel: loc.nav.library },
    { tab: 'playlists', navLabel: loc.nav.playlists },
    { tab: 'stem-projects', navLabel: loc.nav.stemProjects },
    { tab: 'radio', navLabel: loc.nav.radio },
    { tab: 'dsp', navLabel: loc.nav.dsp },
    { tab: 'stats', navLabel: loc.nav.stats },
  ];

  it.each(cases)('renders accessible loading skeleton for $tab tab', ({ tab, navLabel }) => {
    render(<ViewLoadingSkeleton tab={tab} layoutMaxWidth="1200px" loc={loc} />);

    const expectedLabel = `Loading ${navLabel}…`;
    const status = screen.getByRole('status', { name: expectedLabel });
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByText(expectedLabel)).toBeTruthy();
  });

  it.each(['cover', 'turntable', 'tape', 'vumeter'] as NowPlayingVisualMode[])(
    'renders player skeleton tailored to %s visual mode',
    (visualMode) => {
      const { container } = render(
        <ViewLoadingSkeleton tab="player" layoutMaxWidth="1200px" loc={loc} visualMode={visualMode} showLyrics />,
      );
      expect(screen.getByRole('status', { name: `Loading ${loc.nav.nowPlaying}…` })).toBeTruthy();
      expect(container.querySelectorAll('.skeleton-shimmer').length).toBeGreaterThan(10);
    },
  );

  it('renders distinct library sub-view skeletons for tracks, albums grid/list, album detail, and artists', () => {
    const { container, rerender } = render(
      <LibraryContentSkeleton subView="tracks" label="Loading tracks" />,
    );
    expect(screen.getByRole('status', { name: 'Loading tracks' })).toBeTruthy();

    rerender(<LibraryContentSkeleton subView="albums" albumViewMode="grid" albumGridSize="compact" label="Loading albums" />);
    expect(container.querySelectorAll('.aspect-square').length).toBeGreaterThan(0);

    rerender(<LibraryContentSkeleton subView="albums" albumViewMode="list" label="Loading album list" />);
    expect(container.querySelectorAll('.aspect-square').length).toBe(0);

    rerender(<LibraryContentSkeleton subView="albums" hasSelectedAlbumDetail label="Loading album detail" />);
    expect(screen.getByRole('status', { name: 'Loading album detail' })).toBeTruthy();

    rerender(<LibraryContentSkeleton subView="artists" label="Loading artists" />);
    expect(screen.getByRole('status', { name: 'Loading artists' })).toBeTruthy();
  });

  it('renders playlist detail skeleton when a playlist is selected', () => {
    const { container } = render(
      <ViewLoadingSkeleton tab="playlists" layoutMaxWidth="1200px" loc={loc} hasSelectedPlaylist />,
    );
    expect(screen.getByRole('status', { name: `Loading ${loc.nav.playlists}…` })).toBeTruthy();
    expect(container.querySelectorAll('.skeleton-shimmer').length).toBeGreaterThan(8);
  });

  it('renders distinct single-wide-card layouts for playlists and stem-projects tabs', () => {
    const { container: playlistsContainer, unmount } = render(
      <ViewLoadingSkeleton tab="playlists" layoutMaxWidth="1200px" loc={loc} />,
    );
    const playlistHeaderPillGroup = playlistsContainer.querySelectorAll('.rounded-2xl.border-line.bg-black\\/20').length;
    unmount();

    const { container: stemsContainer } = render(
      <ViewLoadingSkeleton tab="stem-projects" layoutMaxWidth="1200px" loc={loc} />,
    );
    const stemChannels = stemsContainer.querySelectorAll('.grid-cols-4').length;

    expect(playlistHeaderPillGroup).toBe(1);
    expect(playlistsContainer.querySelectorAll('.grid-cols-4').length).toBe(0);
    expect(playlistsContainer.querySelectorAll('[class*="grid-cols-[repeat"]').length).toBe(0);
    expect(stemChannels).toBe(1);
    expect(stemsContainer.querySelectorAll('[class*="grid-cols-[repeat"]').length).toBe(0);
  });

  it('falls back to English Now Playing label for redirect tabs or missing loc', () => {
    render(<ViewLoadingSkeleton tab="themes" layoutMaxWidth="1200px" />);

    const status = screen.getByRole('status', { name: `Loading ${loc.nav.nowPlaying}…` });
    expect(status.getAttribute('aria-busy')).toBe('true');
  });

  it('renders PlaylistTracksSkeleton and StemProjectsCardSkeleton with accessible status', () => {
    render(
      <>
        <PlaylistTracksSkeleton label="Loading tracks" />
        <StemProjectsCardSkeleton label="Loading projects" />
      </>,
    );

    expect(screen.getByRole('status', { name: 'Loading tracks' }).getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('status', { name: 'Loading projects' }).getAttribute('aria-busy')).toBe('true');
  });

  it('renders SettingsModalSkeleton for activeTab and allows closing while loading', () => {
    const onClose = vi.fn();
    render(<SettingsModalSkeleton loc={loc} activeTab="updates" onClose={onClose} />);

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getAllByText(`Loading ${loc.updates.title}…`).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: loc.settings.close }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
