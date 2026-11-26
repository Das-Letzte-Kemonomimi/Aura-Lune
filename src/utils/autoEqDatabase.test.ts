import { describe, it, expect } from 'vitest';
import { AUTO_EQ_PROFILES, AUTO_EQ_BRANDS } from './autoEqDatabase';

describe('autoEqDatabase - Headphone EQ profiles integrity', () => {
  it('contains valid and unique profile IDs', () => {
    expect(AUTO_EQ_PROFILES.length).toBeGreaterThan(20);
    const idSet = new Set<string>();

    for (const profile of AUTO_EQ_PROFILES) {
      expect(profile.id).toBeTruthy();
      expect(idSet.has(profile.id), `Duplicate AutoEq profile ID: ${profile.id}`).toBe(false);
      idSet.add(profile.id);
    }
  });

  it('guarantees each profile has exactly 10 EQ bands with safe gain ranges', () => {
    for (const profile of AUTO_EQ_PROFILES) {
      expect(profile.bands.length).toBe(10);
      for (let i = 0; i < 10; i++) {
        const gain = profile.bands[i];
        expect(Number.isFinite(gain), `Non-finite gain in ${profile.name} at band ${i}`).toBe(true);
        // Gains shouldn't exceed extreme ranges (-24 dB to +18 dB)
        expect(gain).toBeGreaterThanOrEqual(-24);
        expect(gain).toBeLessThanOrEqual(18);
      }
    }
  });

  it('ensures safe preamp values to prevent digital clipping', () => {
    for (const profile of AUTO_EQ_PROFILES) {
      // Preamp should be <= 0 dB to avoid digital overs, or at most a minor headroom offset
      expect(profile.preampDb).toBeLessThanOrEqual(0);
      expect(Number.isFinite(profile.preampDb)).toBe(true);
    }
  });

  it('includes declared headphone brands in profile list', () => {
    const declaredBrands = new Set(AUTO_EQ_BRANDS.filter((b) => b !== 'All'));
    const foundBrands = new Set(AUTO_EQ_PROFILES.map((p) => p.brand));

    // Ensure all declared filter brands are present in the profiles
    for (const brand of declaredBrands) {
      expect(foundBrands.has(brand)).toBe(true);
    }

    // Ensure prominent audiophile brands are covered
    expect(foundBrands.has('Moondrop')).toBe(true);
    expect(foundBrands.has('Sennheiser')).toBe(true);
    expect(foundBrands.has('Sony')).toBe(true);
  });
});
