import { describe, it, expect, beforeEach } from 'vitest';
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
});
