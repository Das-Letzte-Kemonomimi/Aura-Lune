import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { SegmentedControl, type SegmentedItem } from './SegmentedControl';

type Mode = 'grid' | 'list' | 'table';

const items: SegmentedItem<Mode>[] = [
  { value: 'grid', label: 'Grid' },
  { value: 'list', label: 'List', disabled: true },
  { value: 'table', label: 'Table' },
];

function Harness({ onChange }: { onChange?: (v: Mode) => void }) {
  const [value, setValue] = useState<Mode>('grid');
  return (
    <SegmentedControl
      label="View"
      items={items}
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
    />
  );
}

afterEach(cleanup);

describe('SegmentedControl', () => {
  it('renders a labelled tablist with only the selected tab in the Tab order', () => {
    render(<Harness />);
    expect(screen.getByRole('tablist', { name: 'View' })).toBeTruthy();
    const grid = screen.getByRole('tab', { name: 'Grid' });
    const table = screen.getByRole('tab', { name: 'Table' });
    expect(grid.getAttribute('aria-selected')).toBe('true');
    expect(grid.tabIndex).toBe(0);
    expect(table.getAttribute('aria-selected')).toBe('false');
    expect(table.tabIndex).toBe(-1);
  });

  it('selects on click', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
    expect(onChange).toHaveBeenCalledWith('table');
    expect(screen.getByRole('tab', { name: 'Table' }).getAttribute('aria-selected')).toBe('true');
  });

  it('moves the selection and focus with the arrow keys, skipping disabled tabs and wrapping', () => {
    render(<Harness />);
    const grid = screen.getByRole('tab', { name: 'Grid' });
    const table = screen.getByRole('tab', { name: 'Table' });
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    expect(table.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(table);
    fireEvent.keyDown(table, { key: 'ArrowRight' });
    expect(grid.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(grid, { key: 'ArrowLeft' });
    expect(table.getAttribute('aria-selected')).toBe('true');
  });

  it('jumps to the ends with Home and End', () => {
    render(<Harness />);
    const grid = screen.getByRole('tab', { name: 'Grid' });
    fireEvent.keyDown(grid, { key: 'End' });
    const table = screen.getByRole('tab', { name: 'Table' });
    expect(table.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(table, { key: 'Home' });
    expect(grid.getAttribute('aria-selected')).toBe('true');
  });

  it("styles the selected tab per tone and lets the caller's className win", () => {
    render(
      <SegmentedControl label="Mode" items={items} value="grid" onChange={() => {}} tone="cyan" className="p-2" />,
    );
    expect(screen.getByRole('tab', { name: 'Grid' }).className).toContain('aria-selected:text-accent-cyan');
    const list = screen.getByRole('tablist').className.split(' ');
    expect(list).toContain('p-2');
    expect(list).not.toContain('p-1');
  });
});
