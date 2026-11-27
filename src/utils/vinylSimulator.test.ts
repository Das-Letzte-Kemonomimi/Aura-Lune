import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vinylSimulator, DEFAULT_VINYL_SIM_CONFIG } from './vinylSimulator';

describe('vinylSimulator', () => {
  beforeEach(() => {
    localStorage.clear();
    vinylSimulator.setEnabled(false);
    vinylSimulator.setMode('vinyl');
    vinylSimulator.setIntensity(0.25);
    vinylSimulator.setAutoSync(true);
  });

  it('matches default configuration initial values', () => {
    expect(DEFAULT_VINYL_SIM_CONFIG.enabled).toBe(false);
    expect(DEFAULT_VINYL_SIM_CONFIG.mode).toBe('vinyl');
    expect(DEFAULT_VINYL_SIM_CONFIG.intensity).toBe(0.25);
    expect(DEFAULT_VINYL_SIM_CONFIG.autoSync).toBe(true);
  });

  it('updates configuration and clamps intensity between 0 and 1', () => {
    vinylSimulator.setIntensity(1.5);
    expect(vinylSimulator.getConfig().intensity).toBe(1.0);

    vinylSimulator.setIntensity(-0.3);
    expect(vinylSimulator.getConfig().intensity).toBe(0.0);

    vinylSimulator.setIntensity(0.65);
    expect(vinylSimulator.getConfig().intensity).toBe(0.65);
  });

  it('switches noise mode between vinyl and tape', () => {
    vinylSimulator.setMode('tape');
    expect(vinylSimulator.getConfig().mode).toBe('tape');

    vinylSimulator.setMode('vinyl');
    expect(vinylSimulator.getConfig().mode).toBe('vinyl');
  });

  it('notifies subscribers upon configuration changes and allows unsubscribe', () => {
    const receivedConfigs: boolean[] = [];
    const unsubscribe = vinylSimulator.subscribe((cfg) => {
      receivedConfigs.push(cfg.enabled);
    });

    // Initial subscriber call
    expect(receivedConfigs).toContain(false);

    vinylSimulator.setEnabled(true);
    expect(receivedConfigs[receivedConfigs.length - 1]).toBe(true);

    unsubscribe();
    const countBefore = receivedConfigs.length;
    vinylSimulator.setEnabled(false);
    expect(receivedConfigs.length).toBe(countBefore);
  });
});

describe('vinylSimulator audio graph', () => {
  /** Minimal AudioContext stand-in recording buffer/node allocations and suspend/resume. */
  class FakeAudioContext {
    static instances: FakeAudioContext[] = [];
    state: AudioContextState = 'running';
    sampleRate = 48_000;
    currentTime = 0;
    destination = {};
    buffers = 0;
    sources = 0;
    filters = 0;
    suspendCalls = 0;
    resumeCalls = 0;
    constructor() {
      FakeAudioContext.instances.push(this);
    }
    private param() {
      return { setValueAtTime: vi.fn(), setTargetAtTime: vi.fn() };
    }
    createGain() {
      return { gain: this.param(), connect: vi.fn() };
    }
    createBiquadFilter() {
      this.filters += 1;
      return { type: '', frequency: this.param(), Q: this.param(), connect: vi.fn() };
    }
    createOscillator() {
      return { frequency: this.param(), connect: vi.fn(), start: vi.fn() };
    }
    createBufferSource() {
      this.sources += 1;
      return { buffer: null, loop: false, connect: vi.fn(), start: vi.fn() };
    }
    createBuffer(_channels: number, length: number) {
      this.buffers += 1;
      const data = new Float32Array(length);
      return { getChannelData: () => data };
    }
    suspend() {
      this.suspendCalls += 1;
      this.state = 'suspended';
      return Promise.resolve();
    }
    resume() {
      this.resumeCalls += 1;
      this.state = 'running';
      return Promise.resolve();
    }
  }

  async function freshSimulator() {
    vi.resetModules();
    const mod = await import('./vinylSimulator');
    return mod.vinylSimulator;
  }

  beforeEach(() => {
    localStorage.clear();
    FakeAudioContext.instances = [];
    vi.useFakeTimers();
    vi.stubGlobal('AudioContext', FakeAudioContext);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reuses pre-generated crackle buffers instead of allocating a buffer and filter per crackle', async () => {
    const sim = await freshSimulator();
    sim.setIntensity(1);
    sim.setPlaybackState(true);
    sim.setEnabled(true);
    const ctx = FakeAudioContext.instances[0];
    const buffersAfterInit = ctx.buffers;
    const filtersAfterInit = ctx.filters;
    const sourcesAfterInit = ctx.sources;

    vi.advanceTimersByTime(5_000);

    expect(ctx.sources - sourcesAfterInit).toBeGreaterThan(10); // crackles kept playing
    expect(ctx.buffers).toBe(buffersAfterInit);
    expect(ctx.filters).toBe(filtersAfterInit);
    sim.setEnabled(false);
  });

  it('suspends the context once faded out and resumes it when audible again', async () => {
    const sim = await freshSimulator();
    sim.setPlaybackState(true);
    sim.setEnabled(true);
    const ctx = FakeAudioContext.instances[0];

    sim.setPlaybackState(false);
    expect(ctx.state).toBe('running'); // still fading out
    vi.advanceTimersByTime(600);
    expect(ctx.suspendCalls).toBe(1);
    expect(ctx.state).toBe('suspended');

    sim.setPlaybackState(true);
    expect(ctx.resumeCalls).toBe(1);
    expect(ctx.state).toBe('running');
    sim.setEnabled(false);
  });

  it('does not suspend when playback resumes during the fade-out', async () => {
    const sim = await freshSimulator();
    sim.setPlaybackState(true);
    sim.setEnabled(true);
    const ctx = FakeAudioContext.instances[0];

    sim.setPlaybackState(false);
    vi.advanceTimersByTime(200);
    sim.setPlaybackState(true);
    vi.advanceTimersByTime(1_000);

    expect(ctx.suspendCalls).toBe(0);
    sim.setEnabled(false);
  });
});
