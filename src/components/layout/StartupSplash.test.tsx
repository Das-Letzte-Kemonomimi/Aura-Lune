import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { StartupSplash } from './StartupSplash';
import { getTranslations } from '../../i18n';

const loc = getTranslations('en');

describe('StartupSplash', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders current stage label, progress percentage, and formatted version', () => {
    render(
      <StartupSplash
        bootState={{
          isReady: false,
          isExiting: false,
          progress: 60,
          stage: 'library',
        }}
        appVersion="1.1.6-dev"
        loc={loc}
      />,
    );

    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByText('Auralune')).toBeTruthy();
    expect(screen.getByText('v1.1.6-dev')).toBeTruthy();
    expect(screen.getByText(loc.startup.loadingLibrary)).toBeTruthy();
    expect(screen.getByText('60%')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('60');
  });

  it('applies exit fade state and clears aria-busy when exiting', () => {
    render(
      <StartupSplash
        bootState={{
          isReady: false,
          isExiting: true,
          progress: 100,
          stage: 'ready',
        }}
        appVersion="v2.0.0"
        loc={loc}
      />,
    );

    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-busy')).toBe('false');
    expect(status.className).toContain('opacity-0');
    expect(screen.getByText('v2.0.0')).toBeTruthy();
    expect(screen.getByText(loc.startup.ready)).toBeTruthy();
  });

  it('omits the version badge when appVersion is empty', () => {
    render(
      <StartupSplash
        bootState={{
          isReady: false,
          isExiting: false,
          progress: 20,
          stage: 'themes',
        }}
        appVersion=""
        loc={loc}
      />,
    );

    expect(screen.queryByText(/^v/)).toBeNull();
    expect(screen.getByText(loc.startup.loadingThemes)).toBeTruthy();
  });
});
