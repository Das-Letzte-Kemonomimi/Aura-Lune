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
  it('shows the value as signed dB', () => {
    renderControl({ preampDb: 3.5 });
    expect(screen.getByText('+3.5 dB')).toBeTruthy();
  });

  it('steps 0.5 dB with arrows and 0.1 dB with Shift', () => {
    const props = renderControl({ preampDb: 1 });
    const slider = screen.getByRole('slider', { name: loc.dsp.preamp });
    fireEvent.keyDown(slider, { key: 'ArrowUp' });
    expect(props.onPreampChange).toHaveBeenLastCalledWith(1.5);
    fireEvent.keyDown(slider, { key: 'ArrowDown', shiftKey: true });
    expect(props.onPreampChange).toHaveBeenLastCalledWith(0.9);
  });

  it('steps with the mouse wheel', () => {
    const props = renderControl({ preampDb: 0 });
    const slider = screen.getByRole('slider', { name: loc.dsp.preamp });
    fireEvent.wheel(slider, { deltaY: -100 });
    expect(props.onPreampChange).toHaveBeenLastCalledWith(0.5);
    fireEvent.wheel(slider, { deltaY: 100, shiftKey: true });
    expect(props.onPreampChange).toHaveBeenLastCalledWith(-0.1);
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
});
