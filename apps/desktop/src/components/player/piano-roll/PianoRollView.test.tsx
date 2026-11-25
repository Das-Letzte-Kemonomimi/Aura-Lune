import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { PianoRollView } from './PianoRollView';
import { invokeMock } from '../../../test/ipcMock';
import { installCanvasMock, installFakeRaf, type CanvasMock, type FakeRaf } from '../../../test/canvasMock';
import { getTranslations } from '../../../i18n';

const t = getTranslations('en');
let raf: FakeRaf;
let canvas: CanvasMock;

beforeEach(() => {
  localStorage.clear();
  raf = installFakeRaf();
  canvas = installCanvasMock({ width: 800, height: 420 });
  invokeMock.mockResolvedValue({
    track_id: 1,
    file_hash: 'x',
    bpm: 120,
    analyzer_version: 'test',
    notes: [{ onset_ms: 0, duration_ms: 500, midi_pitch: 60, pitch_name: 'C4', cents_offset: 0, velocity: 90 }],
  });
});

afterEach(() => {
  cleanup();
  canvas.restore();
  raf.restore();
});

const mountView = () => render(<PianoRollView currentLang="en" trackId={1} isPlaying={false} currentTimeMs={0} onSeek={() => {}} />);

describe('PianoRollView remembers the view size', () => {
  it('starts with automatic row height and the default width', () => {
    mountView();
    expect(screen.getByTitle(t.analysis.rowHeightReset).textContent).toBe(t.analysis.rowHeightAuto);
    expect(screen.getByText('80px/s')).toBeTruthy();
  });

  it('keeps the chosen row height and time zoom after the view is reopened', () => {
    const first = mountView();
    fireEvent.click(screen.getByTitle(t.analysis.rowHeightMore));
    fireEvent.click(screen.getByTitle(t.analysis.zoomIn));
    expect(screen.getByTitle(t.analysis.rowHeightReset).textContent).toBe('16px');
    first.unmount();

    mountView();
    expect(screen.getByTitle(t.analysis.rowHeightReset).textContent).toBe('16px');
    expect(screen.getByText('100px/s')).toBeTruthy();
  });

  it('resets the row height to automatic on click and remembers that too', () => {
    const first = mountView();
    fireEvent.click(screen.getByTitle(t.analysis.rowHeightLess));
    fireEvent.click(screen.getByTitle(t.analysis.rowHeightReset));
    first.unmount();
    mountView();
    expect(screen.getByTitle(t.analysis.rowHeightReset).textContent).toBe(t.analysis.rowHeightAuto);
  });

  it('ignores a corrupted stored value', () => {
    localStorage.setItem('auralune_piano_roll_px_per_sec', 'wide');
    localStorage.setItem('auralune_piano_roll_row_height', 'tall');
    mountView();
    expect(screen.getByText('80px/s')).toBeTruthy();
    expect(screen.getByTitle(t.analysis.rowHeightReset).textContent).toBe(t.analysis.rowHeightAuto);
  });
});
