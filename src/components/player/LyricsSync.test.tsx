import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import { getTranslations } from '../../i18n';
import { invokeMock } from '../../test/ipcMock';
import { DesktopLyricsOverlay } from './DesktopLyricsOverlay';
import { LyricsView, type LyricsDto } from './LyricsView';
import { OVERLAY_POSITION_STORAGE_KEY, ROMAJI_MODE_STORAGE_KEY } from './lyricsModel';

const LYRICS: LyricsDto = {
  is_synced: true,
  lines: [{ time_ms: 0, text: 'こんにちは' }],
  plain_lyrics: null,
  source: 'local_lrc',
};

function renderPanel() {
  return render(
    <LyricsView trackTitle="Song" trackArtist="Artist" currentPositionMs={0} onSeek={vi.fn()} onClose={vi.fn()} />,
  );
}

function renderOverlay() {
  return render(
    <DesktopLyricsOverlay
      isOpen
      onClose={vi.fn()}
      trackTitle="Song"
      trackArtist="Artist"
      positionMs={0}
      isPlaying={false}
      onPlayPause={vi.fn()}
      onPrev={vi.fn()}
      onNext={vi.fn()}
      onSeek={vi.fn()}
    />,
  );
}

const romajiChip = (view: ReturnType<typeof render>) => within(view.container).getByTitle(/Lyrics Romanization/);

beforeEach(() => {
  // jsdom has no layout, so no scrollTo: the panels call it to follow the active line
  HTMLElement.prototype.scrollTo = vi.fn() as unknown as typeof HTMLElement.prototype.scrollTo;
  localStorage.clear();
  invokeMock.mockResolvedValue(LYRICS);
});

afterEach(() => cleanup());

describe('lyrics preferences shared between views', () => {
  it('cycling romaji in the player panel moves the desktop overlay along', () => {
    const panel = renderPanel();
    const overlay = renderOverlay();
    // Default is "dual" in both
    expect(within(overlay.container).getByText('Dual')).toBeTruthy();

    fireEvent.click(romajiChip(panel)); // dual → romaji
    expect(within(overlay.container).getByText('Romaji')).toBeTruthy();
    expect(localStorage.getItem(ROMAJI_MODE_STORAGE_KEY)).toBe('romaji');
  });

  it('cycling romaji in the desktop overlay moves the player panel along', () => {
    const panel = renderPanel();
    const overlay = renderOverlay();

    fireEvent.click(romajiChip(overlay)); // dual → romaji
    fireEvent.click(romajiChip(overlay)); // romaji → original
    expect(within(panel.container).getByText('あ Kana')).toBeTruthy();
  });

  it('restores a saved romaji mode in both views', () => {
    localStorage.setItem(ROMAJI_MODE_STORAGE_KEY, 'original');
    const panel = renderPanel();
    const overlay = renderOverlay();
    expect(within(panel.container).getByText('あ Kana')).toBeTruthy();
    expect(within(overlay.container).getByText('Kana')).toBeTruthy();
  });

  it('falls back to dual for an unknown saved romaji mode', () => {
    localStorage.setItem(ROMAJI_MODE_STORAGE_KEY, 'bogus');
    const overlay = renderOverlay();
    expect(within(overlay.container).getByText('Dual')).toBeTruthy();
  });

  it('keeps auto-scroll in sync between two lyrics panels (player and BigScreen)', async () => {
    const t = getTranslations('en').lyricsView;
    const first = renderPanel();
    const second = renderPanel();

    // Synced lyrics load asynchronously; both panels start with auto-scroll on
    fireEvent.click(await within(first.container).findByTitle(t.autoScrollOn));

    expect(localStorage.getItem('auralune_lyrics_autoscroll')).toBe('false');
    expect(await within(second.container).findByTitle(t.autoScrollOff)).toBeTruthy();
  });
});

describe('desktop lyrics overlay position', () => {
  it('saves where the widget was dropped, not where the drag started', () => {
    const overlay = renderOverlay();
    const widget = overlay.container.firstElementChild as HTMLElement;
    const start = { x: parseInt(widget.style.left, 10), y: parseInt(widget.style.top, 10) };

    fireEvent.mouseDown(widget, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(window, { clientX: 150, clientY: 80 });
    expect(widget.style.left).toBe(`${start.x + 50}px`);
    // Nothing is written while the pointer is still moving
    expect(localStorage.getItem(OVERLAY_POSITION_STORAGE_KEY)).toBeNull();

    fireEvent.mouseUp(window);
    expect(JSON.parse(localStorage.getItem(OVERLAY_POSITION_STORAGE_KEY) ?? 'null')).toEqual({
      x: start.x + 50,
      y: start.y - 20,
    });
    expect(widget.style.left).toBe(`${start.x + 50}px`);
  });

  it('restores the saved position on the next mount', () => {
    localStorage.setItem(OVERLAY_POSITION_STORAGE_KEY, JSON.stringify({ x: 40, y: 90 }));
    const overlay = renderOverlay();
    const widget = overlay.container.firstElementChild as HTMLElement;
    expect(widget.style.left).toBe('40px');
    expect(widget.style.top).toBe('90px');
  });

  it('does not save anything for a click without movement', () => {
    const overlay = renderOverlay();
    const widget = overlay.container.firstElementChild as HTMLElement;
    fireEvent.mouseDown(widget, { clientX: 100, clientY: 100 });
    fireEvent.mouseUp(window);
    expect(localStorage.getItem(OVERLAY_POSITION_STORAGE_KEY)).toBeNull();
  });
});
