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
    coverSyncProgress: { running: false, processed: 0, total: 0 },
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

    fireEvent.click(screen.getByRole('button', { name: /More actions/i }));
    const item = screen.getByRole('menuitem', { name: /Sync Missing Covers/i });
    expect(item).toBeTruthy();
    expect(item.textContent).toContain('7');

    fireEvent.click(item);
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

    const trigger = screen.getByRole('button', { name: 'More actions' });
    expect(trigger.textContent?.trim()).toBe('More actions');
    fireEvent.click(trigger);
    const item = screen.getByRole('menuitem', { name: 'Sync Missing Covers' });
    expect(item.textContent?.trim()).toBe('Sync Missing Covers');

    fireEvent.click(item);
    expect(handleTriggerBackgroundCoverFetch).toHaveBeenCalledTimes(1);
  });

  it('shows processed/total progress and disables the item while sync is running', () => {
    const handleTriggerBackgroundCoverFetch = vi.fn(async () => {});
    render(
      <LibraryHeader
        {...buildProps({
          albumsWithoutCoverCount: 12,
          coverSyncProgress: { running: true, processed: 4, total: 12 },
          handleTriggerBackgroundCoverFetch,
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /More actions/i }));
    const item = screen.getByRole('menuitem', { name: /Syncing Covers/i }) as HTMLButtonElement;
    expect(item.disabled).toBe(true);
    expect(item.textContent).toContain('4/12');

    fireEvent.click(item);
    expect(handleTriggerBackgroundCoverFetch).not.toHaveBeenCalled();
  });
});
