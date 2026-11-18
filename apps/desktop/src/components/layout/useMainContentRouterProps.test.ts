import { describe, it, expect } from 'vitest';
import { useMainContentRouterProps } from './useMainContentRouterProps';

describe('useMainContentRouterProps', () => {
  it('bundles router view props correctly', () => {
    const mockPlayer = {} as any;
    const mockLibrary = {} as any;
    const mockDsp = {} as any;
    const mockPlaylists = {} as any;
    const mockStemProjects = {} as any;
    const mockRadio = {} as any;

    const result = useMainContentRouterProps({
      playerProps: mockPlayer,
      libraryProps: mockLibrary,
      dspProps: mockDsp,
      playlistsProps: mockPlaylists,
      stemProjectsProps: mockStemProjects,
      radioProps: mockRadio,
    });

    expect(result.playerProps).toBe(mockPlayer);
    expect(result.libraryProps).toBe(mockLibrary);
    expect(result.dspProps).toBe(mockDsp);
    expect(result.playlistsProps).toBe(mockPlaylists);
    expect(result.stemProjectsProps).toBe(mockStemProjects);
    expect(result.radioProps).toBe(mockRadio);
  });
});
