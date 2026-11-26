import { describe, expect, it } from 'vitest';
import { getTranslations, supportedLanguages } from '../i18n';
import { CUSTOM_EQ_PRESET_ID, presetDescription, presetLabel } from './dspPresetLabels';

const en = getTranslations('en');
const pl = getTranslations('pl');

describe('presetLabel', () => {
  it('returns the localised name for a known id', () => {
    expect(presetLabel(en, 'eq', 'bass-boost', 'ignored')).toBe(en.dsp.eqPreset['bass-boost']);
    expect(presetLabel(pl, 'eq', 'flat', 'Flat')).toBe(pl.dsp.eqPreset.flat);
    expect(presetLabel(pl, 'peq', 'harman', 'Harman Target')).toBe(pl.dsp.peqPreset.harman.name);
    expect(presetLabel(pl, 'dynamics', 'bypass', 'Direct Bypass')).toBe(pl.dsp.dynamicsPreset.bypass.name);
  });

  it('localises the custom sentinel', () => {
    expect(presetLabel(pl, 'eq', CUSTOM_EQ_PRESET_ID, 'Custom')).toBe(pl.dsp.eqPreset.custom);
  });

  it('falls back to the backend text for an unknown id', () => {
    expect(presetLabel(en, 'eq', 'autoeq:HD 650', '🎧 HD 650 (AutoEQ)')).toBe('🎧 HD 650 (AutoEQ)');
    expect(presetLabel(en, 'peq', 'new-preset', 'New Preset')).toBe('New Preset');
  });

  it('does not resolve inherited object keys as presets', () => {
    expect(presetLabel(en, 'eq', 'constructor', 'Fallback')).toBe('Fallback');
    expect(presetLabel(en, 'dynamics', 'toString', 'Fallback')).toBe('Fallback');
  });

  it('does not use the PEQ and dynamics tables for the graphic EQ list', () => {
    expect(presetLabel(en, 'eq', 'harman', 'Harman Target')).toBe('Harman Target');
  });
});

describe('presetDescription', () => {
  it('returns the localised description for a known id', () => {
    expect(presetDescription(pl, 'peq', 'de-esser', 'English')).toBe(pl.dsp.peqPreset['de-esser'].description);
    expect(presetDescription(pl, 'dynamics', 'ear-safe', 'English')).toBe(pl.dsp.dynamicsPreset['ear-safe'].description);
  });

  it('falls back to the backend text for an unknown id, and to empty without one', () => {
    expect(presetDescription(en, 'peq', 'unknown', 'From Rust')).toBe('From Rust');
    expect(presetDescription(en, 'dynamics', 'unknown')).toBe('');
  });

  it('has no description for the graphic EQ list', () => {
    expect(presetDescription(en, 'eq', 'flat', 'From Rust')).toBe('From Rust');
  });
});

describe('locale coverage of the built-in preset ids', () => {
  const eqIds = ['flat', 'anime-ost', 'bass-boost', 'electronic', 'rock', 'pop', 'acoustic', CUSTOM_EQ_PRESET_ID];
  const peqIds = ['flat', 'harman', 'vocal-clarity', 'sub-bass-punch', 'de-esser'];
  const dynamicsIds = ['vintage-tube', 'analog-tape', 'vocal-broadcast', 'lofi-crunch', 'ear-safe', 'bypass'];

  it.each(supportedLanguages.map((l) => l.code))('%s localises every built-in preset id', (code) => {
    const loc = getTranslations(code);
    const missing = [
      ...eqIds.filter((id) => !presetLabel(loc, 'eq', id, '')),
      ...peqIds.filter((id) => !presetLabel(loc, 'peq', id, '') || !presetDescription(loc, 'peq', id)),
      ...dynamicsIds.filter((id) => !presetLabel(loc, 'dynamics', id, '') || !presetDescription(loc, 'dynamics', id)),
    ];
    expect(missing).toEqual([]);
  });
});
