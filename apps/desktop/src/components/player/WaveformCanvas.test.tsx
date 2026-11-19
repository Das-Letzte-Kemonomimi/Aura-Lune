import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { WaveformCanvas } from './WaveformCanvas';

describe('WaveformCanvas Component', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const dummyPeaks = [10, 30, 60, 90, 40, 20, 80, 50];

  it('renders waveform container and styles selector', () => {
    render(
      <WaveformCanvas
        peaks={dummyPeaks}
        progress={25}
        durationMs={180000}
        positionMs={45000}
        currentLang="en"
      />
    );

    // Verify style buttons are rendered
    expect(screen.getByTitle('Smooth Wave')).toBeTruthy();
    expect(screen.getByTitle('Cyber Bars')).toBeTruthy();
    expect(screen.getByTitle('Scrolling DJ Wave')).toBeTruthy();
    expect(screen.getByTitle('Mirror Spectrum')).toBeTruthy();
  });

  it('allows switching waveform visual styles', () => {
    const handleStyleChange = vi.fn();
    render(
      <WaveformCanvas
        peaks={dummyPeaks}
        progress={25}
        durationMs={180000}
        positionMs={45000}
        currentLang="en"
        onStyleChange={handleStyleChange}
      />
    );

    const barsButton = screen.getByTitle('Cyber Bars');
    fireEvent.click(barsButton);
    expect(handleStyleChange).toHaveBeenCalledWith('bars');
  });

  it('handles drag-to-seek with onSeekPreview and onSeekCommit', () => {
    const handleSeek = vi.fn();
    const handleSeekPreview = vi.fn();
    const handleSeekCommit = vi.fn();

    const { container } = render(
      <WaveformCanvas
        peaks={dummyPeaks}
        progress={10}
        durationMs={100000}
        positionMs={10000}
        currentLang="en"
        onSeek={handleSeek}
        onSeekPreview={handleSeekPreview}
        onSeekCommit={handleSeekCommit}
      />
    );

    const waveformContainer = container.querySelector('.waveform-container') as HTMLDivElement;
    expect(waveformContainer).toBeTruthy();

    // Mock getBoundingClientRect
    vi.spyOn(waveformContainer, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 50,
      width: 400,
      height: 64,
      right: 500,
      bottom: 114,
      x: 100,
      y: 50,
      toJSON: () => {},
    });

    // 1. Pointer Down at 200px (which is x=100 relative, 100/400 = 25%)
    fireEvent.pointerDown(waveformContainer, { clientX: 200, button: 0, pointerId: 1 });
    expect(handleSeekPreview).toHaveBeenCalledWith(0.25);
    expect(handleSeekCommit).not.toHaveBeenCalled();

    // 2. Dragging Pointer Move to 300px (x=200 relative, 200/400 = 50%)
    fireEvent.pointerMove(waveformContainer, { clientX: 300, pointerId: 1 });
    expect(handleSeekPreview).toHaveBeenCalledWith(0.5);
    expect(handleSeekCommit).not.toHaveBeenCalled();

    // 3. Pointer Up (Release mouse button) at 340px (x=240 relative, 240/400 = 60%)
    fireEvent.pointerUp(waveformContainer, { clientX: 340, pointerId: 1 });
    expect(handleSeekCommit).toHaveBeenCalledWith(0.6);
  });

  it('calls onSeek on mouse release when onSeekCommit is not provided', () => {
    const handleSeek = vi.fn();

    const { container } = render(
      <WaveformCanvas
        peaks={dummyPeaks}
        progress={10}
        durationMs={100000}
        positionMs={10000}
        currentLang="en"
        onSeek={handleSeek}
      />
    );

    const waveformContainer = container.querySelector('.waveform-container') as HTMLDivElement;
    expect(waveformContainer).toBeTruthy();

    vi.spyOn(waveformContainer, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 200,
      height: 64,
      right: 200,
      bottom: 64,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    // Pointer down at 50px (25%)
    fireEvent.pointerDown(waveformContainer, { clientX: 50, button: 0, pointerId: 1 });
    // Drag to 150px (75%)
    fireEvent.pointerMove(waveformContainer, { clientX: 150, pointerId: 1 });
    expect(handleSeek).not.toHaveBeenCalled();

    // Release mouse at 150px
    fireEvent.pointerUp(waveformContainer, { clientX: 150, pointerId: 1 });
    expect(handleSeek).toHaveBeenCalledWith(0.75);
  });
});
