import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PreampControl, type PreampControlProps } from './PreampControl';
import { getTranslations } from '../../../i18n';

const loc = getTranslations('en');

afterEach(cleanup);

function renderControl(overrides: Partial<PreampControlProps> = {}) {
  const props: PreampControlProps = {
    loc,
    preampDb: 0,
    preampAuto: false,
    autoPreampValue: 0,
    equalizerEnabled: true,
    onPreampChange: vi.fn(),
    onToggleAuto: vi.fn(),
    clipDetected: false,
    onResetClip: vi.fn(),
    ...overrides,
  };
  render(<PreampControl {...props} />);
  return props;
}

describe('PreampControl', () => {
  it('shows the value in the dB field', () => {
    renderControl({ preampDb: 3.5 });
    expect((screen.getByTestId('preamp-input') as HTMLInputElement).value).toBe('3.5');
  });

  it('steps 0.1 dB with arrows and 1 dB with Shift', () => {
    const props = renderControl({ preampDb: 1 });
    const slider = screen.getByRole('slider', { name: loc.dsp.preamp });
    fireEvent.keyDown(slider, { key: 'ArrowUp' });
    expect(props.onPreampChange).toHaveBeenLastCalledWith(1.1);
    fireEvent.keyDown(slider, { key: 'ArrowDown', shiftKey: true });
    expect(props.onPreampChange).toHaveBeenLastCalledWith(0);
  });

  it('applies a typed value on Enter', () => {
    const props = renderControl({ preampDb: 0 });
    const input = screen.getByTestId('preamp-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '-3,7' } });
    expect(props.onPreampChange).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onPreampChange).toHaveBeenLastCalledWith(-3.7);
  });

  it('applies a typed value on blur, clamped to the range', () => {
    const props = renderControl({ preampDb: 0 });
    const input = screen.getByTestId('preamp-input');
    fireEvent.change(input, { target: { value: '40' } });
    fireEvent.blur(input);
    expect(props.onPreampChange).toHaveBeenLastCalledWith(15);
  });

  it('reverts invalid or escaped input without changing the preamp', () => {
    const props = renderControl({ preampDb: 2 });
    const input = screen.getByTestId('preamp-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input.value).toBe('2.0');
    fireEvent.change(input, { target: { value: '9' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.value).toBe('2.0');
    expect(props.onPreampChange).not.toHaveBeenCalled();
  });

  it('steps with the mouse wheel', () => {
    const props = renderControl({ preampDb: 0 });
    const slider = screen.getByRole('slider', { name: loc.dsp.preamp });
    fireEvent.wheel(slider, { deltaY: -100 });
    expect(props.onPreampChange).toHaveBeenLastCalledWith(0.1);
    fireEvent.wheel(slider, { deltaY: 100, shiftKey: true });
    expect(props.onPreampChange).toHaveBeenLastCalledWith(-1);
  });

  it('resets to 0 dB on double-click and with the 0 dB button', () => {
    const props = renderControl({ preampDb: -4 });
    fireEvent.doubleClick(screen.getByRole('slider', { name: loc.dsp.preamp }));
    expect(props.onPreampChange).toHaveBeenLastCalledWith(0);
    (props.onPreampChange as ReturnType<typeof vi.fn>).mockClear();
    fireEvent.click(screen.getByRole('button', { name: '0 dB' }));
    expect(props.onPreampChange).toHaveBeenCalledWith(0);
  });

  it('shows the Auto readout only while Auto is on and the EQ is enabled', () => {
    renderControl({ preampAuto: true, autoPreampValue: -6 });
    expect(screen.getByTestId('preamp-auto-readout').textContent).toBe('Auto: -6.0 dB');
  });

  it('hides the Auto readout with the EQ off', () => {
    renderControl({ preampAuto: true, autoPreampValue: -6, equalizerEnabled: false });
    expect(screen.queryByTestId('preamp-auto-readout')).toBeNull();
  });

  it('toggles Auto', () => {
    const props = renderControl();
    const chip = screen.getByRole('button', { name: new RegExp(loc.dsp.preampAuto) });
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(chip);
    expect(props.onToggleAuto).toHaveBeenCalled();
  });

  it('shows a clear clip LED until the engine latches a clip', () => {
    renderControl();
    expect(screen.getByRole('button', { name: loc.dsp.clipIndicatorClear })).toBeTruthy();
    cleanup();
    renderControl({ clipDetected: true });
    expect(screen.getByRole('button', { name: loc.dsp.clipIndicatorClipped })).toBeTruthy();
  });

  it('resets the clip latch when the LED is clicked', () => {
    const props = renderControl({ clipDetected: true });
    fireEvent.click(screen.getByRole('button', { name: loc.dsp.clipIndicatorClipped }));
    expect(props.onResetClip).toHaveBeenCalledTimes(1);
  });

  it('exposes a vertical orientation and updates dB on vertical pointer interaction', () => {
    const props = renderControl({ preampDb: 0 });
    const slider = screen.getByRole('slider', { name: loc.dsp.preamp });
    expect(slider.getAttribute('aria-orientation')).toBe('vertical');

    const track = slider.firstElementChild as HTMLElement;
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      height: 200,
      left: 0,
      right: 64,
      bottom: 300,
      width: 64,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(slider, { button: 0, clientY: 100, pointerId: 1 });
    expect(props.onPreampChange).toHaveBeenLastCalledWith(15);

    fireEvent.pointerMove(slider, { clientY: 250, pointerId: 1 });
    expect(props.onPreampChange).toHaveBeenLastCalledWith(-7.5);

    fireEvent.pointerUp(slider, { pointerId: 1 });
  });
});
