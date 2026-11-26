import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToggleCard } from './ToggleCard';

afterEach(cleanup);

describe('ToggleCard', () => {
  it('names the switch after the title and reports the new state', () => {
    const onChange = vi.fn();
    render(<ToggleCard title="Smooth Seek Fade" icon={null} tone="pink" checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Smooth Seek Fade' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('tints the card only while the feature is on', () => {
    const { rerender, container } = render(
      <ToggleCard title="Crossfeed" icon={null} tone="cyan" checked onChange={vi.fn()} />,
    );
    const card = () => container.firstElementChild as HTMLElement;
    expect(card().className).toContain('border-accent-cyan/45');
    rerender(<ToggleCard title="Crossfeed" icon={null} tone="cyan" checked={false} onChange={vi.fn()} />);
    expect(card().className).not.toContain('accent-cyan');
  });

  it('shows the dependent controls only when they render something', () => {
    const { container, rerender } = render(
      <ToggleCard title="Range" icon={null} tone="cyan" checked={false} onChange={vi.fn()}>
        {false}
        {null}
      </ToggleCard>,
    );
    expect(container.firstElementChild?.children).toHaveLength(1);
    rerender(
      <ToggleCard title="Range" icon={null} tone="cyan" checked onChange={vi.fn()}>
        <p>Point A</p>
      </ToggleCard>,
    );
    expect(screen.getByText('Point A')).toBeTruthy();
  });
});
