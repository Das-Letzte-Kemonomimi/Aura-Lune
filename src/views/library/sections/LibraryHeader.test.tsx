import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { getTranslations } from '../../../i18n';
import { LibraryHeader, type LibraryHeaderProps } from './LibraryHeader';

function buildProps(overrides: Partial<LibraryHeaderProps> = {}): LibraryHeaderProps {
  return {
    loc: getTranslations('en'),
    filteredTracks: [],
    tracks: [],
    albumsWithoutCoverCount: 0,
    handleShuffleAll: vi.fn(),
    setShowDownloadHub: vi.fn(),
    setIsUrlImportModalOpen: vi.fn(),
    handlePickFolder: vi.fn(async () => {}),
    handlePickFiles: vi.fn(async () => {}),
    setIsScanFolderOpen: vi.fn(),
    isScanFolderOpen: false,
    loadLibrary: vi.fn(async () => {}),
    handleTriggerBackgroundCoverFetch: vi.fn(async () => {}),
    setIsFacetsFilterEnabled: vi.fn(),
    isFacetsFilterEnabled: false,
    setIsDuplicateFinderOpen: vi.fn(),
    setIsFileRenamerOpen: vi.fn(),
    ...overrides,
  };
}

describe('LibraryHeader', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders Sync Missing Covers button with count badge when covers are missing', () => {
    const handleTriggerBackgroundCoverFetch = vi.fn(async () => {});
    render(
      <LibraryHeader
        {...buildProps({
          albumsWithoutCoverCount: 7,
          handleTriggerBackgroundCoverFetch,
        })}
      />,
    );

    const btn = screen.getByRole('button', { name: /Sync Missing Covers/i });
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('7');

    fireEvent.click(btn);
    expect(handleTriggerBackgroundCoverFetch).toHaveBeenCalledTimes(1);
  });

  it('omits the count badge when all albums have covers and still dispatches on click', () => {
    const handleTriggerBackgroundCoverFetch = vi.fn(async () => {});
    render(
      <LibraryHeader
        {...buildProps({
          albumsWithoutCoverCount: 0,
          handleTriggerBackgroundCoverFetch,
        })}
      />,
    );

    const btn = screen.getByRole('button', { name: 'Sync Missing Covers' });
    expect(btn.textContent?.trim()).toBe('Sync Missing Covers');

    fireEvent.click(btn);
    expect(handleTriggerBackgroundCoverFetch).toHaveBeenCalledTimes(1);
  });
});
