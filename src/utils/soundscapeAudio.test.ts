import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { soundscapeEngine, SOUNDSCAPE_PRESETS, type SoundscapeVolumes } from './soundscapeAudio';

describe('soundscapeAudio', () => {
  beforeEach(() => {
    localStorage.clear();
    soundscapeEngine.setMasterVolume(0.5);
    soundscapeEngine.setChannelVolume('rain', 0);
    soundscapeEngine.setChannelVolume('vinyl', 0);
    soundscapeEngine.setChannelVolume('campfire', 0);
    soundscapeEngine.setChannelVolume('wind_chimes', 0);
    soundscapeEngine.setChannelVolume('cafe_brown', 0);
  });

  it('declares presets with unique IDs and non-empty localized names', () => {
    const ids = new Set<string>();
    for (const preset of SOUNDSCAPE_PRESETS) {
      expect(ids.has(preset.id)).toBe(false);
      ids.add(preset.id);

      expect(preset.name.pl.trim().length).toBeGreaterThan(0);
      expect(preset.name.en.trim().length).toBeGreaterThan(0);
      expect(preset.icon.trim().length).toBeGreaterThan(0);
    }
  });

  it('declares preset volumes strictly clamped within [0.0, 1.0]', () => {
    const volumeKeys: (keyof SoundscapeVolumes)[] = [
      'master',
      'rain',
      'vinyl',
      'campfire',
      'wind_chimes',
      'cafe_brown',
    ];

    for (const preset of SOUNDSCAPE_PRESETS) {
      for (const key of volumeKeys) {
        const val = preset.volumes[key];
        if (val !== undefined) {
          expect(val).toBeGreaterThanOrEqual(0.0);
          expect(val).toBeLessThanOrEqual(1.0);
        }
      }
    }
  });

  it('updates channel volumes and clamps out-of-bounds inputs', () => {
    soundscapeEngine.setChannelVolume('rain', 0.8);
    expect(soundscapeEngine.getVolumes().rain).toBe(0.8);

    soundscapeEngine.setChannelVolume('rain', 1.5);
    expect(soundscapeEngine.getVolumes().rain).toBe(1.0);

    soundscapeEngine.setChannelVolume('rain', -0.2);
    expect(soundscapeEngine.getVolumes().rain).toBe(0.0);
  });

  it('manages auto-sync preference flag via localStorage', () => {
    soundscapeEngine.setAutoSyncEnabled(true);
    expect(soundscapeEngine.isAutoSyncEnabled()).toBe(true);

    soundscapeEngine.setAutoSyncEnabled(false);
    expect(soundscapeEngine.isAutoSyncEnabled()).toBe(false);
  });

  describe('master on/off switch', () => {
    const suspend = vi.fn();
    const resume = vi.fn();

    // Minimal Web Audio stand-in: every node factory returns a chainable no-op node.
    class FakeAudioContext {
      state: AudioContextState = 'running';
      currentTime = 0;
      sampleRate = 44100;
      destination = {};
      constructor() {
        return new Proxy(this, {
          get: (target, prop: string) => {
            if (prop in target) return (target as unknown as Record<string, unknown>)[prop];
            if (prop === 'createBuffer') {
              return (_ch: number, len: number) => ({ getChannelData: () => new Float32Array(len) });
            }
            if (prop.startsWith('create')) {
              const node: Record<string, unknown> = new Proxy(
                { connect: () => node, start: vi.fn(), stop: vi.fn() },
                { get: (t, p: string) => (p in t ? (t as Record<string, unknown>)[p] : new Proxy({ value: 0, setValueAtTime: vi.fn(), setTargetAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, {})) },
              );
              return () => node;
            }
            return undefined;
          },
        });
      }
      suspend() {
        this.state = 'suspended';
        suspend();
        return Promise.resolve();
      }
      resume() {
        this.state = 'running';
        resume();
        return Promise.resolve();
      }
    }

    beforeEach(() => {
      vi.useFakeTimers();
      suspend.mockClear();
      resume.mockClear();
      vi.stubGlobal('AudioContext', FakeAudioContext);
      window.AudioContext = FakeAudioContext as unknown as typeof AudioContext;
      soundscapeEngine.setEnabled(true);
    });

    afterEach(() => {
      soundscapeEngine.stop();
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    it('pauses all layers when switched off and restores the exact mix when switched on', () => {
      soundscapeEngine.setChannelVolume('rain', 0.7);
      soundscapeEngine.setChannelVolume('vinyl', 0.4);
      soundscapeEngine.setMasterVolume(0.6);
      expect(soundscapeEngine.isSoundscapeActive()).toBe(true);
      const mix = soundscapeEngine.getVolumes();

      soundscapeEngine.setEnabled(false);
      expect(soundscapeEngine.isEnabled()).toBe(false);
      expect(soundscapeEngine.isSoundscapeActive()).toBe(false);
      expect(suspend).toHaveBeenCalled();
      expect(soundscapeEngine.getVolumes()).toEqual(mix);

      soundscapeEngine.setEnabled(true);
      expect(soundscapeEngine.isEnabled()).toBe(true);
      expect(soundscapeEngine.isSoundscapeActive()).toBe(true);
      expect(resume).toHaveBeenCalled();
      expect(soundscapeEngine.getVolumes()).toEqual(mix);
    });

    it('stops random one-shot events while off and reschedules them when back on', () => {
      soundscapeEngine.setChannelVolume('rain', 0.7);
      expect(vi.getTimerCount()).toBeGreaterThan(0);

      soundscapeEngine.setEnabled(false);
      expect(vi.getTimerCount()).toBe(0);

      soundscapeEngine.setEnabled(true);
      expect(vi.getTimerCount()).toBeGreaterThan(0);
    });

    it('persists the switch state with the other soundscape settings', () => {
      soundscapeEngine.setChannelVolume('rain', 0.5);
      soundscapeEngine.setEnabled(false);
      const saved = JSON.parse(localStorage.getItem('auralune_soundscape_settings') ?? '{}');
      expect(saved.isMuted).toBe(true);
      expect(saved.volumes.rain).toBe(0.5);
    });
  });
});
