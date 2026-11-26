import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { MainContentRouter, type MainContentRouterProps } from './MainContentRouter';

// Mock child views
vi.mock('../../views', () => ({
  PlayerView: () => <div data-testid="player-view">Player View</div>,
  LibraryView: () => <div data-testid="library-view">Library View</div>,
  DspStudioView: () => <div data-testid="dsp-view">DSP View</div>,
  PlaylistsView: () => <div data-testid="playlists-view">Playlists View</div>,
  StemProjectsLibraryView: () => <div data-testid="stem-projects-view">Stem Projects View</div>,
  RadioView: () => <div data-testid="radio-view">Radio View</div>,
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

  it('renders PlayerView when activeTab is player', () => {
    render(<MainContentRouter {...dummyProps} activeTab="player" />);
    expect(screen.getByTestId('player-view')).toBeTruthy();
    expect(screen.queryByTestId('library-view')).toBeNull();
  });

  it('renders LibraryView when activeTab is library', () => {
    render(<MainContentRouter {...dummyProps} activeTab="library" />);
    expect(screen.getByTestId('library-view')).toBeTruthy();
    expect(screen.queryByTestId('player-view')).toBeNull();
  });

  it('renders DspStudioView when activeTab is dsp', () => {
    render(<MainContentRouter {...dummyProps} activeTab="dsp" />);
    expect(screen.getByTestId('dsp-view')).toBeTruthy();
  });

  it('renders PlaylistsView when activeTab is playlists', () => {
    render(<MainContentRouter {...dummyProps} activeTab="playlists" />);
    expect(screen.getByTestId('playlists-view')).toBeTruthy();
  });

  it('renders StemProjectsLibraryView when activeTab is stem-projects', () => {
    render(<MainContentRouter {...dummyProps} activeTab="stem-projects" />);
    expect(screen.getByTestId('stem-projects-view')).toBeTruthy();
  });

  it('renders RadioView when activeTab is radio', () => {
    render(<MainContentRouter {...dummyProps} activeTab="radio" />);
    expect(screen.getByTestId('radio-view')).toBeTruthy();
  });

  it('renders StatsDashboardView when activeTab is stats', () => {
    render(<MainContentRouter {...dummyProps} activeTab="stats" />);
    expect(screen.getByTestId('stats-view')).toBeTruthy();
  });

  it('applies bottom dock clearance padding when dock is visible', () => {
    const { rerender } = render(<MainContentRouter {...dummyProps} activeTab="player" isPlayerScrolledDown={false} />);
    expect(screen.getByRole('main').className).not.toContain('pb-26');

    rerender(<MainContentRouter {...dummyProps} activeTab="player" isPlayerScrolledDown />);
    expect(screen.getByRole('main').className).toContain('pb-26');

    rerender(<MainContentRouter {...dummyProps} activeTab="library" isPlayerScrolledDown={false} />);
    expect(screen.getByRole('main').className).toContain('pb-26');
  });
});
