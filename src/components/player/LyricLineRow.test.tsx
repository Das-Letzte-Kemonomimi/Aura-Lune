import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LyricLineRow, type LyricLineRowProps } from './LyricLineRow';

afterEach(cleanup);

const baseProps = (overrides: Partial<LyricLineRowProps> = {}): LyricLineRowProps => ({
  index: 3,
  text: '夜空',
  romaji: 'yozora',
  romajiMode: 'dual',
  isActive: false,
  isPast: false,
  isTarget: false,
  isSyncMode: false,
  timeLabel: '',
  syncActionLabel: 'Sync',
  syncTooltip: 'Set time',
  onLineClick: vi.fn(),
  onSetLineTime: vi.fn(),
  ...overrides,
});

describe('LyricLineRow', () => {
  it('shows the original and the pre-computed romaji in dual mode', () => {
    render(<LyricLineRow {...baseProps()} />);
    expect(screen.getByText('夜空')).toBeTruthy();
    expect(screen.getByText('yozora')).toBeTruthy();
  });

  it('shows only the romaji in romaji mode and only the text in original mode', () => {
    const { rerender } = render(<LyricLineRow {...baseProps({ romajiMode: 'romaji' })} />);
    expect(screen.queryByText('夜空')).toBeNull();
    expect(screen.getByText('yozora')).toBeTruthy();

    rerender(<LyricLineRow {...baseProps({ romajiMode: 'original', romaji: null })} />);
    expect(screen.getByText('夜空')).toBeTruthy();
    expect(screen.queryByText('yozora')).toBeNull();
  });

  it('reports its index on click and on the sync action without triggering the line click', () => {
    const props = baseProps({ isSyncMode: true, timeLabel: '[00:12.34]' });
    render(<LyricLineRow {...props} />);
    fireEvent.click(screen.getByText('Sync'));
    expect(props.onSetLineTime).toHaveBeenCalledWith(3);
    expect(props.onLineClick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('[00:12.34]'));
    expect(props.onLineClick).toHaveBeenCalledWith(3);
  });
});
