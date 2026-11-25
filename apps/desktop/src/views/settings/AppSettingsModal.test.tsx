import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppSettingsModal } from './AppSettingsModal';
import { getTranslations } from '../../i18n';

describe('AppSettingsModal', () => {
  const loc = getTranslations('en');

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    activeTab: 'themes' as const,
    onSelectTab: vi.fn(),
    loc,
    language: 'en' as const,
    devicesProps: {} as any,
    transcodeProps: {} as any,
    themesProps: {
      language: 'en' as const,
      loc,
      onLanguageChange: vi.fn(),
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
      onOpenOnboarding: vi.fn(),
    },
    backupProps: {} as any,
  };

  it('renders themes tab content when activeTab is themes', () => {
    render(<AppSettingsModal {...defaultProps} />);
    expect(screen.getAllByText(loc.settings.themes).length).toBeGreaterThan(0);
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
