import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AppSettingsModal } from './AppSettingsModal';
import { getTranslations } from '../../i18n';

afterEach(cleanup);

describe('AppSettingsModal', () => {
  const loc = getTranslations('en');

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    activeTab: 'general' as const,
    onSelectTab: vi.fn(),
    loc,
    generalProps: {
      loc,
      language: 'en' as const,
      onLanguageChange: vi.fn(),
      restoreSessionOnStartup: true,
      onToggleRestoreSessionOnStartup: vi.fn(),
      closeToTray: false,
      onToggleCloseToTray: vi.fn(),
      desktopNotificationsEnabled: true,
      onToggleDesktopNotifications: vi.fn(),
      albumPlaybackMode: 'replace' as const,
      onSetAlbumPlaybackMode: vi.fn(),
      recapOptIn: false,
      onToggleRecapOptIn: vi.fn(),
      onOpenOnboarding: vi.fn(),
    },
    appearanceProps: {
      loc,
      buttonGlowEnabled: true,
      onToggleGlow: vi.fn(),
      uiScale: 1.0,
      onResetScale: vi.fn(),
      onSelectScale: vi.fn(),
      themes: [],
      currentTheme: { id: 'default', name: 'Default', tokens: {} } as any,
      onSelectTheme: vi.fn(),
      customBgPath: '',
      onCustomBgPathChange: vi.fn(),
      themeBgImage: '',
      onPickWallpaperFromDisk: vi.fn(),
      onWallpaperDrop: vi.fn(),
      onUploadBgImage: vi.fn(),
      onRemoveBgImage: vi.fn(),
      onSaveBackgroundSettings: vi.fn(),
      themeOverlay: 0.4,
      onThemeOverlayChange: vi.fn(),
      themeBlur: 10,
      onThemeBlurChange: vi.fn(),
      appIconStyle: 'classic' as const,
      onSelectIconStyle: vi.fn(),
    },
    playbackProps: {} as any,
    audioProps: {} as any,
    libraryProps: {
      loc,
      autoFetchCoversBg: true,
      onToggleAutoFetchCoversBg: vi.fn(),
      onTriggerBackgroundCoverFetch: vi.fn(),
    },
    integrationsProps: {} as any,
    transcodeProps: {} as any,
    dataProps: {
      loc,
      onExportBackup: vi.fn(),
      onImportBackup: vi.fn(),
      jsonExportContent: '',
      onExportTheme: vi.fn(),
      jsonImportContent: '',
      onJsonImportContentChange: vi.fn(),
      onImportTheme: vi.fn(),
    },
    updatesProps: {} as any,
    aboutProps: {
      appIconStyle: 'classic' as const,
      appVersion: '1.2.3',
      buildInfo: null,
      language: 'en' as const,
      loc,
      onOpenHealthCheck: vi.fn(),
      onOpenChangelog: vi.fn(),
    },
  };

  it.each([
    ['general', () => loc.settings.language],
    ['appearance', () => loc.settings.themes],
    ['library', () => loc.settings.autoFetchCoversTitle],
    ['data', () => loc.settings.backupTitle],
    ['about', () => loc.settings.disclaimerTitle],
  ] as const)('shows tab-specific skeleton then renders the %s tab content', async (tab, text) => {
    render(<AppSettingsModal {...defaultProps} activeTab={tab} />);
    const tabLabel = loc.settings.nav[tab];
    expect(screen.getByRole('status', { name: `Loading ${tabLabel}…` })).toBeTruthy();
    expect((await screen.findAllByText(text())).length).toBeGreaterThan(0);
  });

  it('lists every settings tab in the navigation and marks the active one', () => {
    render(<AppSettingsModal {...defaultProps} activeTab="library" />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(10);
    expect(screen.getByRole('tab', { name: loc.settings.nav.library }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe('settings-tab-library');
  });

  it('selects a tab from the navigation', () => {
    const onSelectTab = vi.fn();
    render(<AppSettingsModal {...defaultProps} onSelectTab={onSelectTab} />);
    fireEvent.click(screen.getByRole('tab', { name: loc.settings.nav.integrations }));
    expect(onSelectTab).toHaveBeenCalledWith('integrations');
  });

  it('shows a pill on the Updates tab only when an update is available', () => {
    const { rerender } = render(<AppSettingsModal {...defaultProps} />);
    expect(screen.queryByTestId('updates-tab-pill')).toBeNull();
    rerender(<AppSettingsModal {...defaultProps} updateAvailable />);
    expect(screen.getByTestId('updates-tab-pill')).toBeTruthy();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(<AppSettingsModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });
});
