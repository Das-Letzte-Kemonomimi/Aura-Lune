import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { MainContentRouter, type MainContentRouterProps } from './MainContentRouter';

// Mock child views
vi.mock('../../views/player/PlayerView', () => ({
  PlayerView: () => <div data-testid="player-view">Player View</div>,
}));
vi.mock('../../views/library/LibraryView', () => ({
  LibraryView: () => <div data-testid="library-view">Library View</div>,
}));
vi.mock('../../views/dsp/DspStudioView', () => ({
  DspStudioView: () => <div data-testid="dsp-view">DSP View</div>,
}));
vi.mock('../../views/playlists/PlaylistsView', () => ({
  PlaylistsView: () => <div data-testid="playlists-view">Playlists View</div>,
}));
vi.mock('../../views/stems/StemProjectsLibraryView', () => ({
  StemProjectsLibraryView: () => <div data-testid="stem-projects-view">Stem Projects View</div>,
}));
vi.mock('../../views/playlists/RadioView', () => ({
  RadioView: () => <div data-testid="radio-view">Radio View</div>,
}));
vi.mock('../../views/stats/StatsDashboardView', () => ({
  StatsDashboardView: () => <div data-testid="stats-view">Stats View</div>,
}));

describe('MainContentRouter component', () => {
  const dummyProps: MainContentRouterProps = {
    mainContentRef: React.createRef<HTMLElement>(),
    activeTab: 'player',
    isPlayerScrolledDown: false,
    layoutMaxWidth: '1200px',
    playerProps: {} as any,
    libraryProps: {} as any,
    dspProps: {} as any,
    playlistsProps: {} as any,
    stemProjectsProps: {
      currentLang: 'en',
      onOpenProject: vi.fn(),
      onOpenCreateProject: vi.fn(),
    },
    radioProps: {
      currentLang: 'en',
      currentStation: null,
      isPlaying: false,
      customStations: [],
      onPlayStation: vi.fn(),
      onStop: vi.fn(),
      onOpenAddModal: vi.fn(),
      onDeleteCustomStation: vi.fn(),
    },
    statsProps: {
      tracks: [],
      albums: [],
      currentLang: 'en',
      onPlayTrack: vi.fn(),
      onOpenStatsModal: vi.fn(),
    },
  };

  afterEach(() => {
    cleanup();
  });

  it('shows Now Playing loading skeleton before PlayerView resolves', async () => {
    render(<MainContentRouter {...dummyProps} activeTab="player" />);
    expect(screen.getByRole('status', { name: 'Loading Now Playing…' })).toBeTruthy();
    expect(await screen.findByTestId('player-view')).toBeTruthy();
    expect(screen.queryByTestId('library-view')).toBeNull();
  });

  it('shows Library loading skeleton before LibraryView resolves', async () => {
    render(<MainContentRouter {...dummyProps} activeTab="library" />);
    expect(screen.getByRole('status', { name: 'Loading Library…' })).toBeTruthy();
    expect(await screen.findByTestId('library-view')).toBeTruthy();
    expect(screen.queryByTestId('player-view')).toBeNull();
  });

  it('renders DspStudioView when activeTab is dsp', async () => {
    render(<MainContentRouter {...dummyProps} activeTab="dsp" />);
    expect(await screen.findByTestId('dsp-view')).toBeTruthy();
  });

  it('renders PlaylistsView when activeTab is playlists', async () => {
    render(<MainContentRouter {...dummyProps} activeTab="playlists" />);
    expect(await screen.findByTestId('playlists-view')).toBeTruthy();
  });

  it('renders StemProjectsLibraryView when activeTab is stem-projects', async () => {
    render(<MainContentRouter {...dummyProps} activeTab="stem-projects" />);
    expect(await screen.findByTestId('stem-projects-view')).toBeTruthy();
  });

  it('renders RadioView when activeTab is radio', async () => {
    render(<MainContentRouter {...dummyProps} activeTab="radio" />);
    expect(await screen.findByTestId('radio-view')).toBeTruthy();
  });

  it('renders StatsDashboardView when activeTab is stats', async () => {
    render(<MainContentRouter {...dummyProps} activeTab="stats" />);
    expect(await screen.findByTestId('stats-view')).toBeTruthy();
  });

  it('applies bottom dock clearance padding when dock is visible', () => {
    const { rerender } = render(<MainContentRouter {...dummyProps} activeTab="player" isPlayerScrolledDown={false} />);
    expect(screen.getByRole('main').className).not.toContain('pb-24.5');

    rerender(<MainContentRouter {...dummyProps} activeTab="player" isPlayerScrolledDown />);
    expect(screen.getByRole('main').className).toContain('pb-24.5');

    rerender(<MainContentRouter {...dummyProps} activeTab="library" isPlayerScrolledDown={false} />);
    expect(screen.getByRole('main').className).toContain('pb-24.5');
  });
});
