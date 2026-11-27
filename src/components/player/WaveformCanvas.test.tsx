import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { WaveformCanvas } from './WaveformCanvas';
import { installCanvasMock, installFakeRaf } from '../../test/canvasMock';

describe('WaveformCanvas Component', () => {
  // A style picked in one test is saved, so every test starts from empty storage.
  beforeEach(() => localStorage.clear());
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
  describe('scrolling DJ wave', () => {
    // 160 peaks * 6.5 px = 1040 px for the whole wave => 1 px of dragging = 1/1040 of the track
    const manyPeaks = Array.from({ length: 160 }, (_, i) => 20 + (i % 60));

    function setup(overrides: Partial<React.ComponentProps<typeof WaveformCanvas>> = {}) {
      const onSeekPreview = vi.fn();
      const onSeekCommit = vi.fn();
      const view = render(
        <WaveformCanvas
          peaks={manyPeaks}
          progress={50}
          durationMs={200000}
          positionMs={100000}
          currentLang="en"
          initialStyle="scrolling"
          onSeekPreview={onSeekPreview}
          onSeekCommit={onSeekCommit}
          {...overrides}
        />
      );
      const el = view.container.querySelector('.waveform-container') as HTMLDivElement;
      vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
        left: 100, top: 0, width: 400, height: 64, right: 500, bottom: 64, x: 100, y: 0, toJSON: () => {},
      });
      return { el, onSeekPreview, onSeekCommit };
    }

    it('drags the track under a fixed playhead instead of jumping to the pointer position', () => {
      const { el, onSeekPreview, onSeekCommit } = setup();

      // Pressing does not seek (the old version jumped to 25%)
      fireEvent.pointerDown(el, { clientX: 400, button: 0, pointerId: 1 });
      expect(onSeekPreview).not.toHaveBeenCalled();

      // Dragging left by 52 px moves the track forward by 52/1040 = 5%
      fireEvent.pointerMove(el, { clientX: 348, pointerId: 1 });
      expect(onSeekPreview).toHaveBeenLastCalledWith(expect.closeTo(0.55, 6));
      expect(onSeekCommit).not.toHaveBeenCalled();

      fireEvent.pointerUp(el, { clientX: 348, pointerId: 1 });
      expect(onSeekCommit).toHaveBeenCalledTimes(1);
      expect(onSeekCommit).toHaveBeenCalledWith(expect.closeTo(0.55, 6));
    });

    it('dragging right rewinds the track', () => {
      const { el, onSeekCommit } = setup();
      fireEvent.pointerDown(el, { clientX: 300, button: 0, pointerId: 1 });
      fireEvent.pointerMove(el, { clientX: 352, pointerId: 1 });
      fireEvent.pointerUp(el, { clientX: 352, pointerId: 1 });
      expect(onSeekCommit).toHaveBeenCalledWith(expect.closeTo(0.45, 6));
    });

    it('a plain click (no drag) does not seek', () => {
      const { el, onSeekPreview, onSeekCommit } = setup();
      fireEvent.pointerDown(el, { clientX: 250, button: 0, pointerId: 1 });
      fireEvent.pointerMove(el, { clientX: 251, pointerId: 1 }); // below the threshold
      fireEvent.pointerUp(el, { clientX: 251, pointerId: 1 });
      expect(onSeekPreview).not.toHaveBeenCalled();
      expect(onSeekCommit).not.toHaveBeenCalled();
    });

    it('clamps to the start and end of the track', () => {
      const { el, onSeekCommit } = setup();
      fireEvent.pointerDown(el, { clientX: 500, button: 0, pointerId: 1 });
      fireEvent.pointerMove(el, { clientX: 100, pointerId: 1 }); // -400 px => +38% => 88%
      fireEvent.pointerMove(el, { clientX: -2000, pointerId: 1 }); // far to the left => 100%
      fireEvent.pointerUp(el, { clientX: -2000, pointerId: 1 });
      expect(onSeekCommit).toHaveBeenLastCalledWith(1);
    });

    it('hover shows the time under the cursor relative to the centred playhead', () => {
      const { el } = setup();
      // The container centre (x = 200) is the current position: 50% of 200 s = 1:40
      fireEvent.pointerMove(el, { clientX: 300, pointerId: 1 });
      expect(screen.getByText('1:40')).toBeTruthy();
    });

    it('hides the hover tooltip while dragging the scrolling wave', () => {
      const { el } = setup();
      fireEvent.pointerMove(el, { clientX: 300, pointerId: 1 });
      expect(screen.getByText('1:40')).toBeTruthy();

      fireEvent.pointerDown(el, { clientX: 300, button: 0, pointerId: 1 });
      expect(screen.queryByText('1:40')).toBeNull();
    });
  });

  describe('hover tooltip & canvas rendering', () => {
    it('renders the hover tooltip outside .waveform-container, clamps near edges, and hides on leave/cancel', () => {
      const { container } = render(
        <WaveformCanvas
          peaks={dummyPeaks}
          progress={25}
          durationMs={100000}
          positionMs={25000}
          currentLang="en"
          initialStyle="mirror"
          onSeek={vi.fn()}
        />
      );

      const waveformContainer = container.querySelector('.waveform-container') as HTMLDivElement;
      vi.spyOn(waveformContainer, 'getBoundingClientRect').mockReturnValue({
        left: 100, top: 0, width: 400, height: 66, right: 500, bottom: 66, x: 100, y: 0, toJSON: () => {},
      });

      // Near left edge (x = 5 px) -> clamped to >= 30 px and placed outside .waveform-container
      fireEvent.pointerMove(waveformContainer, { clientX: 105, pointerId: 1 });
      const tip = screen.getByText('0:01');
      expect(waveformContainer.contains(tip)).toBe(false);
      expect(tip.style.display).toBe('block');
      expect(tip.style.left).toBe('30px');

      // Near right edge (x = 395 px) -> clamped to <= 370 px
      fireEvent.pointerMove(waveformContainer, { clientX: 495, pointerId: 1 });
      expect(tip.textContent).toBe('1:38');
      expect(tip.style.left).toBe('370px');

      // Pointer leave clears and hides the tooltip
      fireEvent.pointerLeave(waveformContainer);
      expect(tip.style.display).toBe('none');
      expect(screen.queryByText('1:38')).toBeNull();

      // Pointer cancel also clears and hides the tooltip
      fireEvent.pointerMove(waveformContainer, { clientX: 300, pointerId: 1 });
      expect(screen.getByText('0:50')).toBeTruthy();
      fireEvent.pointerCancel(waveformContainer, { pointerId: 1 });
      expect(tip.style.display).toBe('none');
    });

    it('redraws mirror waveform and hover line on fractional DPR without reallocating the canvas buffer', () => {
      const canvasMock = installCanvasMock({ width: 400, height: 66 });
      const raf = installFakeRaf();
      canvasMock.setDpr(1.5);

      try {
        const { container } = render(
          <WaveformCanvas
            peaks={dummyPeaks}
            progress={50}
            durationMs={120000}
            positionMs={60000}
            currentLang="en"
            initialStyle="mirror"
            onSeek={vi.fn()}
          />
        );

        const waveformContainer = container.querySelector('.waveform-container') as HTMLDivElement;
        const canvas = container.querySelector('canvas') as HTMLCanvasElement;
        vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
          left: 0, top: 0, width: 400, height: 66, right: 400, bottom: 66, x: 0, y: 0, toJSON: () => {},
        });

        raf.step();
        const initialWidthSets = canvasMock.widthAssignments();
        const initialHeightSets = canvasMock.heightAssignments();
        // Rounded backing size (400×66 at 1.5×), not a per-frame truncated reallocation.
        expect(canvas.width).toBe(600);
        expect(canvas.height).toBe(99);

        canvasMock.calls.length = 0;
        fireEvent.pointerMove(waveformContainer, { clientX: 200, pointerId: 1 });
        expect(screen.getByText('1:00')).toBeTruthy();
        raf.step();

        expect(canvasMock.calls).toContain('setLineDash');
        expect(canvasMock.widthAssignments()).toBe(initialWidthSets);
        expect(canvasMock.heightAssignments()).toBe(initialHeightSets);
      } finally {
        raf.restore();
        canvasMock.restore();
      }
    });

    it('renders the wave body once and only blits the cached layers on progress ticks', () => {
      const canvasMock = installCanvasMock({ width: 400, height: 66 });
      const raf = installFakeRaf();
      try {
        const base = { peaks: dummyPeaks, durationMs: 120000, currentLang: 'en' as const, initialStyle: 'smooth' as const };
        const { rerender } = render(<WaveformCanvas {...base} progress={10} positionMs={12000} />);
        raf.step();
        expect(canvasMock.calls).toContain('bezierCurveTo');
        const layerAllocations = canvasMock.widthAssignments();

        canvasMock.calls.length = 0;
        rerender(<WaveformCanvas {...base} progress={11} positionMs={13200} />);
        raf.step();

        expect(canvasMock.calls).toContain('drawImage');
        expect(canvasMock.calls).not.toContain('bezierCurveTo');
        expect(canvasMock.widthAssignments()).toBe(layerAllocations);
      } finally {
        raf.restore();
        canvasMock.restore();
      }
    });

    it('re-renders the cached layers when the theme rewrites the root colour variables', async () => {
      const canvasMock = installCanvasMock({ width: 400, height: 66 });
      const raf = installFakeRaf();
      try {
        render(
          <WaveformCanvas
            peaks={dummyPeaks}
            progress={10}
            durationMs={120000}
            currentLang="en"
            initialStyle="smooth"
            colorPlayedStart="var(--accent-pink)"
          />,
        );
        raf.step();
        canvasMock.calls.length = 0;

        document.documentElement.style.setProperty('--accent-pink', '#00ff00');
        await Promise.resolve();
        raf.step();

        expect(canvasMock.calls).toContain('bezierCurveTo');
      } finally {
        document.documentElement.style.removeProperty('--accent-pink');
        raf.restore();
        canvasMock.restore();
      }
    });

    it('renders mirror and bars styles with spectralBands and a neutral baseline while loading', () => {
      const canvasMock = installCanvasMock({ width: 400, height: 66 });
      const raf = installFakeRaf();
      try {
        const spectralBands: [number, number, number][] = [
          [0.9, 0.2, 0.1],
          [0.2, 0.8, 0.3],
          [0.1, 0.3, 0.95],
          [0.6, 0.6, 0.2],
          [0.8, 0.1, 0.1],
          [0.1, 0.9, 0.2],
          [0.2, 0.2, 0.9],
          [0.5, 0.5, 0.5],
        ];
        const { rerender } = render(
          <WaveformCanvas
            peaks={[]}
            isLoading={true}
            progress={30}
            durationMs={120000}
            positionMs={36000}
            currentLang="en"
            initialStyle="mirror"
          />
        );
        raf.step();
        expect(canvasMock.calls).toContain('fill');

        canvasMock.calls.length = 0;
        rerender(
          <WaveformCanvas
            peaks={dummyPeaks}
            spectralBands={spectralBands}
            isLoading={false}
            progress={50}
            durationMs={120000}
            positionMs={60000}
            currentLang="en"
            initialStyle="mirror"
          />
        );
        raf.step();
        expect(canvasMock.calls).toContain('fill');
      } finally {
        raf.restore();
        canvasMock.restore();
      }
    });
  });
});

describe('WaveformCanvas shared style', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => cleanup());

  const props = { peaks: [10, 30, 60, 90], progress: 25, durationMs: 180000, positionMs: 45000, currentLang: 'en' as const };

  it('keeps the player and BigScreen waveforms on the same style', () => {
    const player = render(<WaveformCanvas {...props} />);
    const bigScreen = render(<WaveformCanvas {...props} />);
    const pressed = (view: ReturnType<typeof render>, title: string) =>
      within(view.container).getByTitle(title).getAttribute('aria-pressed');
    expect(pressed(bigScreen, 'Smooth Wave')).toBe('true');

    fireEvent.click(within(player.container).getByTitle('Cyber Bars'));

    expect(pressed(bigScreen, 'Cyber Bars')).toBe('true');
    expect(pressed(bigScreen, 'Smooth Wave')).toBe('false');
    expect(localStorage.getItem('auralune_waveform_style')).toBe('bars');
  });

  it('uses initialStyle only as the default when nothing is saved', () => {
    const empty = render(<WaveformCanvas {...props} initialStyle="mirror" />);
    expect(within(empty.container).getByTitle('Mirror Spectrum').getAttribute('aria-pressed')).toBe('true');
    cleanup();

    localStorage.setItem('auralune_waveform_style', 'bars');
    const saved = render(<WaveformCanvas {...props} initialStyle="mirror" />);
    expect(within(saved.container).getByTitle('Cyber Bars').getAttribute('aria-pressed')).toBe('true');
  });

  it('aligns seek and hover coordinates under 110% CSS zoom', () => {
    document.documentElement.style.zoom = '1.1';
    try {
      const onSeekCommit = vi.fn();
      const { container } = render(
        <WaveformCanvas
          {...props}
          onSeekCommit={onSeekCommit}
        />,
      );
      const canvas = container.querySelector('canvas')!;
      Object.defineProperty(canvas, 'clientWidth', { value: 800, configurable: true });
      Object.defineProperty(canvas, 'clientHeight', { value: 64, configurable: true });
      vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
        left: 220,
        top: 100,
        right: 1100,
        bottom: 170.4,
        width: 880,
        height: 70.4,
        x: 220,
        y: 100,
        toJSON: () => {},
      });

      const waveformContainer = container.querySelector('.waveform-container') as HTMLElement;
      // Midpoint in viewport coordinates: 220 + 880 * 0.5 = 660
      fireEvent.pointerMove(waveformContainer, { clientX: 660, button: 0, pointerId: 1 });
      const tooltip = container.querySelector('[aria-hidden="true"]') as HTMLElement;
      expect(tooltip.style.left).toBe('400px');

      fireEvent.pointerDown(waveformContainer, { clientX: 660, button: 0, pointerId: 1 });
      fireEvent.pointerUp(waveformContainer, { clientX: 660, button: 0, pointerId: 1 });
      expect(onSeekCommit).toHaveBeenCalledTimes(1);
      expect(onSeekCommit.mock.calls[0][0]).toBeCloseTo(0.5, 5);
    } finally {
      document.documentElement.style.zoom = '';
    }
  });
});
