import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToggleSwitch } from './ToggleSwitch';

describe('ToggleSwitch', () => {
  afterEach(cleanup);

  it('reports the new state when toggled', () => {
    const onChange = vi.fn();
    render(<ToggleSwitch label="Auto" checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Auto' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('exposes the checked and disabled state to assistive tech', () => {
    render(<ToggleSwitch label="Auto" checked disabled onChange={vi.fn()} />);
    const input = screen.getByRole('switch', { name: 'Auto' }) as HTMLInputElement;
    expect(input.checked).toBe(true);
    expect(input.disabled).toBe(true);
  });
});
