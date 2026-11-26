import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useModalManager } from './useModalManager';
import type { TrackRecord } from '../types/player';

describe('useModalManager', () => {
  const sampleTrack: TrackRecord = {
    id: 42,
    path: '/music/sample.flac',
    title: 'Sample Track',
    artist: 'Sample Artist',
    album_artist: 'Sample Artist',
    album_id: 1,
    disc_no: 1,
    track_no: 1,
    duration_ms: 210000,
    format: 'FLAC',
    sample_rate: 44100,
    channels: 2,
    bit_depth: 16,
    file_size: 25000000,
    modified_time: 1700000000,
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes default states correctly', () => {
    const { result } = renderHook(() => useModalManager());

    expect(result.current.isSettingsOpen).toBe(false);
    expect(result.current.settingsTab).toBe('themes');
    expect(result.current.isShortcutsModalOpen).toBe(false);
    expect(result.current.tagEditorTrack).toBeNull();
    expect(result.current.coverPickerState).toBeNull();
    expect(result.current.isCommandPaletteOpen).toBe(false);
  });

  it('opens and closes tag editor with track payload', () => {
    const { result } = renderHook(() => useModalManager());

    act(() => {
      result.current.openTagEditor(sampleTrack);
    });

    expect(result.current.tagEditorTrack).toEqual(sampleTrack);

    act(() => {
      result.current.closeTagEditor();
    });

    expect(result.current.tagEditorTrack).toBeNull();
  });

  it('opens and closes cover picker state', () => {
    const { result } = renderHook(() => useModalManager());

    act(() => {
      result.current.openCoverPicker(7, 'Album Title', 'Artist Name');
    });

    expect(result.current.coverPickerState).toEqual({
      isOpen: true,
      albumId: 7,
      title: 'Album Title',
      artist: 'Artist Name',
    });

    act(() => {
      result.current.closeCoverPicker();
    });

    expect(result.current.coverPickerState).toBeNull();
  });

  it('opens settings with specific tab', () => {
    const { result } = renderHook(() => useModalManager());

    act(() => {
      result.current.openSettings('transcode');
    });

    expect(result.current.isSettingsOpen).toBe(true);
    expect(result.current.settingsTab).toBe('transcode');
  });

  it('opens analysis with specified tab', () => {
    const { result } = renderHook(() => useModalManager());

    act(() => {
      result.current.openAnalysis('stems');
    });

    expect(result.current.isAnalysisModalOpen).toBe(true);
    expect(result.current.analysisInitialTab).toBe('stems');
  });

  it('closeAllModals resets all active modal states', () => {
    const { result } = renderHook(() => useModalManager());

    act(() => {
      result.current.setIsShortcutsModalOpen(true);
      result.current.setIsSoundscapeOpen(true);
      result.current.openTagEditor(sampleTrack);
      result.current.openSettings('devices');
    });

    expect(result.current.isShortcutsModalOpen).toBe(true);
    expect(result.current.isSoundscapeOpen).toBe(true);
    expect(result.current.tagEditorTrack).not.toBeNull();
    expect(result.current.isSettingsOpen).toBe(true);

    act(() => {
      result.current.closeAllModals();
    });

    expect(result.current.isShortcutsModalOpen).toBe(false);
    expect(result.current.isSoundscapeOpen).toBe(false);
    expect(result.current.tagEditorTrack).toBeNull();
    expect(result.current.isSettingsOpen).toBe(false);
  });
});
