import { describe, it, expect, beforeEach } from 'vitest';
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
