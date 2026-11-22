import { describe, it, expect } from 'vitest';
import { invokeMock } from '../test/ipcMock';
import { getSetting, setSetting, SETTING_KEYS } from './settings';

describe('api/settings', () => {
  it('reads a setting through get_app_setting', async () => {
    invokeMock.mockResolvedValueOnce('true');
    await expect(getSetting('limiter_enabled')).resolves.toBe('true');
    expect(invokeMock).toHaveBeenCalledWith('get_app_setting', { key: 'limiter_enabled' });
  });

  it('writes a setting through set_app_setting', async () => {
    await setSetting('crossfade_duration', '3000');
    expect(invokeMock).toHaveBeenCalledWith('set_app_setting', {
      key: 'crossfade_duration',
      value: '3000',
    });
  });

  it('has unique keys', () => {
    expect(new Set(SETTING_KEYS).size).toBe(SETTING_KEYS.length);
  });
});
