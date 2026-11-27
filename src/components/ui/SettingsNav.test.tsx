import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SettingsNav, type SettingsNavGroup } from './SettingsNav';

afterEach(cleanup);

type Id = 'general' | 'appearance' | 'playback' | 'updates';

const groups: SettingsNavGroup<Id>[] = [
  {
    id: 'personal',
    label: 'Personal',
    items: [
      { id: 'general', label: 'General' },
      { id: 'appearance', label: 'Appearance' },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      { id: 'playback', label: 'Playback' },
      { id: 'updates', label: 'Updates', badge: <span data-testid="pill">new</span> },
    ],
  },
];

const setup = (value: Id = 'general', onChange = vi.fn(), orientation?: 'vertical' | 'horizontal') => {
  render(<SettingsNav groups={groups} value={value} onChange={onChange} label="Settings" orientation={orientation} />);
  return onChange;
};

describe('SettingsNav', () => {
  it('renders every item as a tab and the group eyebrows', () => {
    setup();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.getByText('Personal')).toBeTruthy();
    expect(screen.getByText('System')).toBeTruthy();
    expect(screen.getByRole('tablist', { name: 'Settings' }).getAttribute('aria-orientation')).toBe('vertical');
  });

  it('marks only the active item as selected and tabbable', () => {
    setup('playback');
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'false', 'true', 'false']);
    expect(tabs.map((t) => t.tabIndex)).toEqual([-1, -1, 0, -1]);
  });

  it('selects on click', () => {
    const onChange = setup();
    fireEvent.click(screen.getByRole('tab', { name: 'Appearance' }));
    expect(onChange).toHaveBeenCalledWith('appearance');
  });

  it('moves the selection with the arrow keys across groups, wrapping at the ends', () => {
    const onChange = setup('appearance');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Appearance' }), { key: 'ArrowDown' });
    expect(onChange).toHaveBeenLastCalledWith('playback');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Appearance' }), { key: 'ArrowUp' });
    expect(onChange).toHaveBeenLastCalledWith('general');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Appearance' }), { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith('updates');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Appearance' }), { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith('general');
  });

  it('wraps from the last item to the first', () => {
    const onChange = setup('updates');
    fireEvent.keyDown(screen.getByRole('tab', { name: /Updates/ }), { key: 'ArrowDown' });
    expect(onChange).toHaveBeenLastCalledWith('general');
  });

  it('renders the badge only on the item that sets one', () => {
    setup();
    expect(screen.getAllByTestId('pill')).toHaveLength(1);
    expect(screen.getByRole('tab', { name: /Updates/ }).contains(screen.getByTestId('pill'))).toBe(true);
  });

  it('drops the eyebrows and uses left/right keys when horizontal', () => {
    const onChange = setup('general', vi.fn(), 'horizontal');
    expect(screen.queryByText('Personal')).toBeNull();
    expect(screen.getByRole('tablist').getAttribute('aria-orientation')).toBe('horizontal');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'General' }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('appearance');
  });

  it('accepts all four arrow keys when responsive and leaves the orientation to the layout', () => {
    const onChange = setup('general', vi.fn(), 'responsive');
    expect(screen.getByRole('tablist').getAttribute('aria-orientation')).toBeNull();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'General' }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('appearance');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'General' }), { key: 'ArrowDown' });
    expect(onChange).toHaveBeenLastCalledWith('appearance');
  });
});
