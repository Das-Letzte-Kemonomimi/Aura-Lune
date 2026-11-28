import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueueDrawer, type QueueDrawerProps } from './QueueDrawer';
import { getTranslations } from '../../i18n';
import type { PlaybackStatus } from '../../types/player';
import type { QueueItem } from '../../types/queue';

const loc = getTranslations('en');

afterEach(cleanup);

const items = (n: number): QueueItem[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `q-${i}`,
    track_id: null,
    uri: `file:///music/${i}.flac`,
    title: `Track ${i}`,
    artist: 'Artist',
    album: null,
    duration_ms: 180_000,
  }));

const props = (n: number, overrides: Partial<QueueDrawerProps> = {}): QueueDrawerProps => ({
  isOpen: true,
  onClose: vi.fn(),
  queue: { items: items(n), current_index: 0, loop_mode: 'None', shuffle: false, shuffle_order: [], shuffle_cursor: 0 },
  status: { state: 'Playing' } as PlaybackStatus,
  tracks: [],
  albums: [],
  infinityQueue: false,
  onToggleInfinityQueue: vi.fn(),
  onClearQueue: vi.fn(),
  onPlayQueueIndex: vi.fn(),
  onMoveQueueItem: vi.fn(),
  onRemoveFromQueue: vi.fn(),
  formatTime: (ms) => `${Math.round(ms / 1000)}s`,
  loc,
  ...overrides,
});

describe('QueueDrawer', () => {
  it('mounts only the visible rows of a long queue and keeps the full scroll height', () => {
    const { container } = render(<QueueDrawer {...props(2000)} />);
    const rows = container.querySelectorAll('[aria-current], .group');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(100);
    // The bottom spacer stands in for the unmounted rows (92 px stride per row).
    const spacers = [...container.querySelectorAll<HTMLElement>('div[aria-hidden="true"]')];
    const spacerHeight = spacers.reduce((sum, el) => sum + parseFloat(el.style.height || '0'), 0);
    expect(spacerHeight + rows.length * 92).toBe(2000 * 92);
  });

  it('plays the clicked row with its absolute queue index', () => {
    const p = props(5);
    render(<QueueDrawer {...p} />);
    fireEvent.click(screen.getByText('Track 3'));
    expect(p.onPlayQueueIndex).toHaveBeenCalledWith(3, p.queue.items[3]);
  });

  it('shows the empty state for an empty queue', () => {
    render(<QueueDrawer {...props(0)} />);
    expect(screen.getByText(loc.queue.empty)).toBeTruthy();
  });

  it('renders nothing while closed', () => {
    const { container } = render(<QueueDrawer {...props(5, { isOpen: false })} />);
    expect(container.firstChild).toBeNull();
  });

  describe('outside click', () => {
    const press = (target: Element, type: 'pointerdown' | 'pointerup') => fireEvent(target, new MouseEvent(type, { bubbles: true }));

    it('closes when the press and release both land outside the panel', () => {
      const p = props(3);
      render(<QueueDrawer {...p} />);
      press(document.body, 'pointerdown');
      press(document.body, 'pointerup');
      expect(p.onClose).toHaveBeenCalledTimes(1);
    });

    it('stays open when a drag starts inside and is released outside', () => {
      const p = props(3);
      render(<QueueDrawer {...p} />);
      press(screen.getByText('Track 1'), 'pointerdown');
      press(document.body, 'pointerup');
      expect(p.onClose).not.toHaveBeenCalled();
    });

    it('stays open for clicks inside the panel', () => {
      const p = props(3);
      render(<QueueDrawer {...p} />);
      press(screen.getByText('Track 1'), 'pointerdown');
      press(screen.getByText('Track 1'), 'pointerup');
      expect(p.onClose).not.toHaveBeenCalled();
    });

    it('ignores presses on the toggle control so its own click does not reopen the drawer', () => {
      const p = props(3);
      render(
        <>
          <button data-queue-toggle>toggle</button>
          <QueueDrawer {...p} />
        </>,
      );
      press(screen.getByText('toggle'), 'pointerdown');
      press(screen.getByText('toggle'), 'pointerup');
      expect(p.onClose).not.toHaveBeenCalled();
    });

    it('does not listen while closed', () => {
      const p = props(3, { isOpen: false });
      render(<QueueDrawer {...p} />);
      press(document.body, 'pointerdown');
      press(document.body, 'pointerup');
      expect(p.onClose).not.toHaveBeenCalled();
    });
  });
});
