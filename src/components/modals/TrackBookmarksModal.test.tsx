import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TrackBookmarksModal } from './TrackBookmarksModal';
import { invokeMock } from '../../test/ipcMock';
import { getTranslations } from '../../i18n';

afterEach(cleanup);

const loc = getTranslations('en');
const bookmarks = [
  { id: 1, track_id: 7, name: 'Intro', position_ms: 1000, created_at: 0 },
  { id: 2, track_id: 7, name: 'Drop', position_ms: 9000, created_at: 0 },
];

function renderModal(onBookmarksUpdated = vi.fn()) {
  render(
    <TrackBookmarksModal
      trackId={7}
      trackTitle="Song"
      currentPositionMs={0}
      durationMs={60000}
      onSeek={vi.fn()}
      onClose={vi.fn()}
      onBookmarksUpdated={onBookmarksUpdated}
      currentLang="en"
    />,
  );
  return onBookmarksUpdated;
}

describe('TrackBookmarksModal delete all', () => {
  it('asks for confirmation before deleting every point of the track', async () => {
    let current = [...bookmarks];
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_track_bookmarks') return current;
      if (cmd === 'delete_all_track_bookmarks') {
        current = [];
        return 2;
      }
      return undefined;
    });
    const onUpdated = renderModal();

    fireEvent.click(await screen.findByRole('button', { name: loc.trackBookmarks.deleteAll }));
    expect(invokeMock).not.toHaveBeenCalledWith('delete_all_track_bookmarks', expect.anything());

    fireEvent.click(screen.getByRole('button', { name: loc.trackBookmarks.deleteAllConfirmYes }));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith('delete_all_track_bookmarks', { trackId: 7 }));
    await waitFor(() => expect(onUpdated).toHaveBeenCalled());
    expect(await screen.findByText(loc.trackBookmarks.noBookmarksFound)).toBeTruthy();
  });

  it('keeps the points when the confirmation is cancelled', async () => {
    invokeMock.mockImplementation(async (cmd: string) => (cmd === 'get_track_bookmarks' ? bookmarks : undefined));
    renderModal();

    fireEvent.click(await screen.findByRole('button', { name: loc.trackBookmarks.deleteAll }));
    fireEvent.click(screen.getByRole('button', { name: loc.common.cancel }));

    expect(invokeMock).not.toHaveBeenCalledWith('delete_all_track_bookmarks', expect.anything());
    expect(screen.getByRole('button', { name: loc.trackBookmarks.deleteAll })).toBeTruthy();
  });
});
