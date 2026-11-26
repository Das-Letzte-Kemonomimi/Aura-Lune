import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { UpdatesSettingsView, type UpdatesSettingsViewProps } from './UpdatesSettingsView';
import { getTranslations } from '../../i18n';
import type { BuildInfo, UpdateInfo } from '../../types/updates';

const loc = getTranslations('en');

const build: BuildInfo = {
  version: '1.1.6',
  commit: 'a'.repeat(40),
  commit_short: 'aaaaaaa',
  channel: 'stable',
  install_kind: 'app_image_managed',
};

const info: UpdateInfo = {
  available: true,
  channel: 'stable',
  current_version: '1.1.6',
  current_commit: build.commit,
  latest_version: '1.2.0',
  latest_commit: null,
  release_url: 'https://github.com/x/y/releases/tag/v1.2.0',
  release_notes: null,
  asset: null,
  install_kind: 'app_image_managed',
  can_install: true,
  checked_at: 1700000000,
};

function props(overrides: Partial<UpdatesSettingsViewProps> = {}): UpdatesSettingsViewProps {
  return {
    language: 'en',
    loc,
    buildInfo: build,
    info,
    checking: false,
    installing: false,
    installed: false,
    progress: null,
    error: null,
    isSkipped: false,
    autoCheckEnabled: true,
    onCheckNow: vi.fn(),
    onInstall: vi.fn(),
    onRestart: vi.fn(),
    onSkip: vi.fn(),
    onToggleAutoCheck: vi.fn(),
    ...overrides,
  };
}

describe('UpdatesSettingsView', () => {
  afterEach(cleanup);

  it('offers install for a managed AppImage', () => {
    const p = props();
    render(<UpdatesSettingsView {...p} />);
    fireEvent.click(screen.getByText(loc.updates.install));
    expect(p.onInstall).toHaveBeenCalled();
    expect(screen.queryByText(loc.updates.noticeSystem)).toBeNull();
  });

  it('shows a notice instead of the install button for system installs', () => {
    render(
      <UpdatesSettingsView
        {...props({
          buildInfo: { ...build, install_kind: 'system' },
          info: { ...info, install_kind: 'system', can_install: false },
        })}
      />,
    );
    expect(screen.getByText(loc.updates.noticeSystem)).toBeTruthy();
    expect(screen.queryByText(loc.updates.install)).toBeNull();
  });

  it('shows restart after installation and the up-to-date message otherwise', () => {
    const p = props({ installed: true });
    const { rerender } = render(<UpdatesSettingsView {...p} />);
    fireEvent.click(screen.getByText(loc.updates.restartNow));
    expect(p.onRestart).toHaveBeenCalled();

    rerender(<UpdatesSettingsView {...props({ info: { ...info, available: false } })} />);
    expect(screen.getByText(loc.updates.upToDate)).toBeTruthy();
  });

  it('reports download progress and errors', () => {
    render(
      <UpdatesSettingsView
        {...props({ installing: true, progress: { downloaded: 50, total: 200 }, error: 'boom' })}
      />,
    );
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('25');
    expect(screen.getByRole('alert').textContent).toContain('boom');
  });
});

describe('UpdatesSettingsView release notes', () => {
  afterEach(cleanup);

  it('renders markdown release notes instead of raw syntax and shows the update pill', () => {
    render(
      <UpdatesSettingsView
        {...props({ info: { ...info, release_notes: '## Highlights\n- **Faster** startup\n- `code` bit' } })}
      />,
    );
    // The card is collapsed by default: the notes appear once it is expanded.
    expect(screen.queryByText('Faster')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: loc.updates.releaseNotes }));
    expect(screen.getByRole('heading', { name: 'Highlights' })).toBeTruthy();
    expect(screen.getByText('Faster').tagName).toBe('STRONG');
    expect(screen.getByText('code').tagName).toBe('CODE');
    expect(screen.queryByText(/## Highlights/)).toBeNull();
    expect(screen.getByText(loc.updates.available)).toBeTruthy();
  });
});

describe('UpdatesSettingsView layout', () => {
  afterEach(cleanup);

  it('keeps the automatic check switch next to "Check now" and lists the changelog below', () => {
    const p = props();
    render(<UpdatesSettingsView {...p} />);
    fireEvent.click(screen.getByRole('switch', { name: loc.updates.autoCheck }));
    expect(p.onToggleAutoCheck).toHaveBeenCalledWith(false);
    expect(screen.getByText(loc.settings.changelog)).toBeTruthy();
  });
});
