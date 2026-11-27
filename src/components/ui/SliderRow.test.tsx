import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NudgeButtons, SliderRow } from './SliderRow';

afterEach(cleanup);

describe('SliderRow', () => {
  it('labels the range, shows the formatted value and sets the fill', () => {
    render(<SliderRow label="Gain" value={5} min={0} max={10} onChange={() => {}} format={(v) => `${v} dB`} />);
    const slider = screen.getByRole('slider', { name: 'Gain' });
    expect(screen.getByText('5 dB')).toBeTruthy();
    expect(slider.style.getPropertyValue('--fill')).toBe('50%');
  });

  it('reports numeric changes', () => {
    const onChange = vi.fn();
    render(<SliderRow label="Gain" value={5} min={0} max={10} onChange={onChange} />);
    fireEvent.change(screen.getByRole('slider', { name: 'Gain' }), { target: { value: '7' } });
    expect(onChange).toHaveBeenCalledWith(7);
  });

  it('renders nudge buttons when given steps', () => {
    const onChange = vi.fn();
    render(<SliderRow label="Pitch" value={0} min={-12} max={12} nudges={[-1, 1]} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '+1' }));
    expect(onChange).toHaveBeenCalledWith(1);
  });
});

describe('NudgeButtons', () => {
  it('adds the step without float noise', () => {
    const onChange = vi.fn();
    render(<NudgeButtons value={0.2} steps={[0.1]} min={0} max={2} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '+0.1' }));
    expect(onChange).toHaveBeenCalledWith(0.3);
  });

  it('keeps the precision of the current value', () => {
    const onChange = vi.fn();
    render(<NudgeButtons value={1.05} steps={[0.1]} min={0} max={3} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '+0.1' }));
    expect(onChange).toHaveBeenCalledWith(1.15);
  });

  it('clamps to the range and disables a step that cannot move the value', () => {
    const onChange = vi.fn();
    render(<NudgeButtons value={11.5} steps={[-1, 1]} min={-12} max={12} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '+1' }));
    expect(onChange).toHaveBeenCalledWith(12);
    cleanup();
    render(<NudgeButtons value={12} steps={[-1, 1]} min={-12} max={12} onChange={onChange} />);
    expect((screen.getByRole('button', { name: '+1' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '−1' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
