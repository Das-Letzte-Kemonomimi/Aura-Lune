import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { invokeMock } from '../../test/ipcMock';
import { CoverArtPickerModal } from './CoverArtPickerModal';

describe('CoverArtPickerModal', () => {
  afterEach(() => {
    cleanup();
  });

  it('orders candidates by match_score, marks the top confident hit as best match, and dims weak ones', async () => {
    invokeMock.mockResolvedValueOnce([
      {
        source: 'Deezer (1000px)',
        title: 'Unrelated Compilation',
        artist: 'Someone Else',
        thumbnail_url: 'https://cdn.example/weak-thumb.jpg',
        full_url: 'https://cdn.example/weak.jpg',
        width: 1000,
        height: 1000,
        match_score: 25,
      },
      {
        source: 'Cover Art Archive',
        title: 'ef - a tale of memories. Original Soundtrack',
        artist: 'TENMON',
        thumbnail_url: 'https://cdn.example/best-thumb.jpg',
        full_url: 'https://cdn.example/best.jpg',
        match_score: 95,
      },
    ]);

    render(
      <CoverArtPickerModal
        isOpen
        onClose={vi.fn()}
        albumId={1}
        initialAlbum="ef - a tale of memories. ORIGINAL SOUNDTRACK"
        initialArtist="TENMON & Eiichiro Yanagi"
        onCoverApplied={vi.fn()}
        currentLang="en"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Best match')).toBeTruthy();
    });

    const titles = screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent);
    expect(titles).toEqual([
      'ef - a tale of memories. Original Soundtrack',
      'Unrelated Compilation',
    ]);

    const weakCard = screen.getByText('Unrelated Compilation').closest('div[class*="opacity-65"]');
    expect(weakCard).toBeTruthy();
  });

  it('shows the relaxed-search hint when no candidates are returned', async () => {
    invokeMock.mockResolvedValueOnce([]);

    render(
      <CoverArtPickerModal
        isOpen
        onClose={vi.fn()}
        albumId={2}
        initialAlbum="Unknown Release XYZ"
        initialArtist="Unknown"
        onCoverApplied={vi.fn()}
        currentLang="en"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/relaxes the artist and title/i)).toBeTruthy();
    });
  });
});
