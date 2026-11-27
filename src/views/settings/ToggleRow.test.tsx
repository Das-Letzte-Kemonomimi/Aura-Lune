import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToggleRow } from './ToggleRow';

afterEach(cleanup);

describe('ToggleRow', () => {
  it('toggles the switch when the title is clicked', () => {
    const onChange = vi.fn();
    render(<ToggleRow title="Close to tray" checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByText('Close to tray'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('exposes the switch under the row title and renders badges and children', () => {
    render(
      <ToggleRow title="Discord" checked badges={<span>Connected</span>} onChange={vi.fn()}>
        <span>advanced</span>
      </ToggleRow>,
    );
    expect((screen.getByRole('switch', { name: 'Discord' }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText('Connected')).toBeTruthy();
    expect(screen.getByText('advanced')).toBeTruthy();
  });
});
