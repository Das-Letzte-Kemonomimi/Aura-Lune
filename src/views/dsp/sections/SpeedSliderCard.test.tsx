import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SpeedSliderCard } from './SpeedSliderCard';
import { formatRatioStep } from './speedSliderModel';

afterEach(cleanup);

function renderCard(onChange = vi.fn(), value = 1) {
  render(
    <SpeedSliderCard
      label="Tempo"
      tone="cyan"
      value={value}
      onChange={onChange}
      sliderMin={0.5}
      sliderMax={2}
      min={0.1}
      max={3}
      formatStep={formatRatioStep}
      formatEntry={(v) => v.toFixed(2)}
      placeholder="1.00"
      entryTitle="Type a tempo"
      unit="x"
      info={null}
      presets={[
        { value: 1, label: '1.0x' },
        { value: 1.5, label: '1.5x' },
      ]}
    />,
  );
  return { onChange, field: screen.getByLabelText('Tempo', { selector: 'input[type="text"]' }) };
}

describe('SpeedSliderCard', () => {
  it('applies a typed value on Enter, clamped to the limits', () => {
    const { onChange, field } = renderCard();
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: '4,5x' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    fireEvent.blur(field);
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('discards the typed value on Escape', () => {
    const { onChange, field } = renderCard();
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: '1.4' } });
    fireEvent.keyDown(field, { key: 'Escape' });
    fireEvent.blur(field);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('steps with the arrow keys, finer with Shift', () => {
    const { onChange, field } = renderCard();
    fireEvent.focus(field);
    fireEvent.keyDown(field, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenLastCalledWith(1.1);
    fireEvent.keyDown(field, { key: 'ArrowDown', shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith(1.09);
  });

  it('orders the nudge buttons fine outside, coarse inside', () => {
    renderCard();
    const labels = screen
      .getAllByRole('button')
      .map((b) => b.textContent ?? '')
      .filter((t) => /^[−+]0\.\d+x$/.test(t));
    expect(labels).toEqual(['−0.01x', '−0.1x', '+0.1x', '+0.01x']);
  });

  it('marks the preset that matches the current value', () => {
    renderCard(vi.fn(), 1.5);
    expect(screen.getByRole('button', { name: '1.5x' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '1.0x' }).getAttribute('aria-pressed')).toBe('false');
  });
});
