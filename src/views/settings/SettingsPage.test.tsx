import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SettingsPage } from './SettingsPage';

afterEach(cleanup);

describe('SettingsPage', () => {
  it('renders the page heading and its actions', () => {
    render(
      <SettingsPage title="Audio & Devices" actions={<button type="button">Refresh</button>}>
        <p>body</p>
      </SettingsPage>,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Audio & Devices' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeTruthy();
    expect(screen.getByText('body')).toBeTruthy();
  });
});
