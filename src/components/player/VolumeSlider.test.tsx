import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { VolumeIcon, VolumeSlider } from './VolumeSlider';
import { gainToPosition, positionToGain } from '../../utils/volumeCurve';
import { VOLUME_CURVE_STORAGE_KEY } from '../../hooks/useVolumeCurve';

function renderSlider(gain: number) {
  const onGainChange = vi.fn();
  render(<VolumeSlider ariaLabel="Volume" gain={gain} onGainChange={onGainChange} />);
  return { onGainChange, slider: screen.getByRole('slider', { name: 'Volume' }) as HTMLInputElement };
}

function wheel(el: HTMLElement, deltaY: number, mods: { shiftKey?: boolean; ctrlKey?: boolean } = {}) {
  const event = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true, ...mods });
  act(() => {
    el.dispatchEvent(event);
  });
  return event;
}

afterEach(cleanup);

describe('VolumeSlider', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows the slider position on the cubic curve and sends gain', () => {
    const { slider, onGainChange } = renderSlider(0.125);
    expect(Number(slider.value)).toBeCloseTo(0.5, 3);

    fireEvent.change(slider, { target: { value: '0.8' } });
    expect(onGainChange).toHaveBeenCalledWith(positionToGain(0.8, 'cubic'));
  });

  it('follows the dB-linear curve when it is selected', () => {
    localStorage.setItem(VOLUME_CURVE_STORAGE_KEY, 'db-linear');
    const { slider } = renderSlider(10 ** (-30 / 20));
    expect(Number(slider.value)).toBeCloseTo(0.5, 3);
  });

  it('steps by 2% of position on the wheel, 0.5% with Shift and 5% with Ctrl', () => {
    const { slider, onGainChange } = renderSlider(0.125);
    const event = wheel(slider, -100);
    expect(event.defaultPrevented).toBe(true);
    expect(gainToPosition(onGainChange.mock.lastCall![0], 'cubic')).toBeCloseTo(0.52, 9);

    wheel(slider, 100, { shiftKey: true });
    expect(gainToPosition(onGainChange.mock.lastCall![0], 'cubic')).toBeCloseTo(0.495, 9);

    wheel(slider, -100, { ctrlKey: true });
    expect(gainToPosition(onGainChange.mock.lastCall![0], 'cubic')).toBeCloseTo(0.55, 9);
  });

  it('resets to 70% on double-click and commits on pointer release', () => {
    const { slider, onGainChange } = renderSlider(1);
    fireEvent.doubleClick(slider);
    expect(onGainChange).toHaveBeenCalledWith(positionToGain(0.7, 'cubic'), true);

    fireEvent.pointerUp(slider);
    expect(onGainChange).toHaveBeenCalledWith(1, true);
  });
});

describe('VolumeIcon', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it.each([
    [0, 'mute'],
    [positionToGain(0.2, 'cubic'), 'low'],
    [positionToGain(0.5, 'cubic'), 'mid'],
    [positionToGain(0.9, 'cubic'), 'high'],
  ])('gain %f shows the %s speaker', (gain, level) => {
    const { container } = render(<VolumeIcon gain={gain} />);
    expect(container.querySelector('svg')?.getAttribute('data-volume-level')).toBe(level);
  });
});
