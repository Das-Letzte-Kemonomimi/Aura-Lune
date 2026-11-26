import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { MenuItem, Popover } from './Popover';

function Harness({ onPick }: { onPick?: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('flat');
  return (
    <div>
      <span>outside</span>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        label="Presets"
        trigger={
          <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            Preset
          </button>
        }
      >
        {['flat', 'bass'].map((v) => (
          <MenuItem
            key={v}
            selected={v === value}
            onClick={() => {
              setValue(v);
              onPick?.(v);
              setOpen(false);
            }}
          >
            {v}
          </MenuItem>
        ))}
      </Popover>
    </div>
  );
}

afterEach(cleanup);

describe('Popover', () => {
  it('toggles from its trigger without the outside handler fighting it', () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Preset' });
    fireEvent.pointerDown(trigger);
    fireEvent.click(trigger);
    expect(screen.getByRole('menu', { name: 'Presets' })).toBeTruthy();
    fireEvent.pointerDown(trigger);
    fireEvent.click(trigger);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on an outside pointer down and on Escape', () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Preset' });
    fireEvent.click(trigger);
    fireEvent.pointerDown(screen.getByText('outside'));
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('renders radio menu items with aria-checked', () => {
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Preset' }));
    expect(screen.getByRole('menuitemradio', { name: 'flat' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('menuitemradio', { name: 'bass' }).getAttribute('aria-checked')).toBe('false');
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'bass' }));
    expect(onPick).toHaveBeenCalledWith('bass');
  });

  it('renders plain menu items without aria-checked', () => {
    render(<MenuItem>Rename</MenuItem>);
    expect(screen.getByRole('menuitem', { name: 'Rename' }).hasAttribute('aria-checked')).toBe(false);
  });
});
