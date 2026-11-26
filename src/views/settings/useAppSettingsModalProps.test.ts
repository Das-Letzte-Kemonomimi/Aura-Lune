import { describe, it, expect, vi } from 'vitest';
import { useAppSettingsModalProps, type UseAppSettingsModalPropsParams } from './useAppSettingsModalProps';
import { getTranslations } from '../../i18n';

describe('useAppSettingsModalProps', () => {
  it('bundles devicesProps, transcodeProps, themesProps, aboutProps, backupProps correctly', () => {
    const loc = getTranslations('en');
    const mockAudioDevices: any = {
      setIsHealthCheckModalOpen: vi.fn(),
      refreshDevices: vi.fn(),
      seekFadeEnabled: false,
      handleToggleSeekFade: vi.fn(),
      instantVolume: false,
      setInstantVolume: vi.fn(),
      volumeUnit: 'percent',
      handleSetVolumeUnit: vi.fn(),
      volumeOsdPosition: 'bottom-center',
      setVolumeOsdPosition: vi.fn(),
      recapOptIn: false,
      setRecapOptIn: vi.fn(),
      restoreSessionOnStartup: false,
      handleToggleRestoreSessionOnStartup: vi.fn(),
      dspAutoStartup: false,
      handleToggleDspAutoStartup: vi.fn(),
      dspDefaultEngine: 'NativeGstreamer',
      handleSetDefaultDspEngine: vi.fn(),
      audioBufferMs: 200,
      handleSetAudioBuffer: vi.fn(),
      dspBlockSize: 512,
      handleSetDspBlockSize: vi.fn(),
      desktopNotificationsEnabled: false,
      setDesktopNotificationsEnabled: vi.fn(),
      albumPlaybackMode: 'Sequential',
      setAlbumPlaybackMode: vi.fn(),
      replaygainMode: 'Off',
      replaygainPreAmp: 0,
      replaygainFallbackGain: 0,
      replaygainPreventClipping: true,
      handleSetReplayGain: vi.fn(),
      replaygainStatus: null,
      replaygainScanWriteTags: false,
      setReplaygainScanWriteTags: vi.fn(),
      handleScanLibraryReplayGain: vi.fn(),
      isReplaygainScanning: false,
      crossfeedEnabled: false,
      crossfeedPreset: 'standard',
      crossfeedFcut: 700,
      crossfeedFeed: 4.5,
      handleSetCrossfeed: vi.fn(),
      silenceTrimmingEnabled: false,
      silenceTrimmingThreshold: -60,
      handleSetSilenceTrimming: vi.fn(),
      cards: [],
      handleDisableProAudio: vi.fn(),
      handleEnableProAudio: vi.fn(),
      handleSetCardProfile: vi.fn(),
      handleSetBluetoothCodec: vi.fn(),
    };

    const mockTranscode: any = {
      currentPlayingTrack: null,
      status: {},
      filePath: '/path',
      setFilePath: vi.fn(),
      isPickingSource: false,
      handlePickTranscodeSource: vi.fn(),
      transcodeOutput: '/out',
      setTranscodeOutput: vi.fn(),
      isPickingDestination: false,
      handlePickTranscodeDestination: vi.fn(),
      transcodeFormat: 'Opus',
      setTranscodeFormat: vi.fn(),
      transcodeBitrate: 192,
      setTranscodeBitrate: vi.fn(),
      transcodeApplyDsp: false,
      setTranscodeApplyDsp: vi.fn(),
      reverbEnabled: false,
      reverbLevel: 0,
      transcodeApplyRange: false,
      setTranscodeApplyRange: vi.fn(),
      transcodeRangeA: '',
      setTranscodeRangeA: vi.fn(),
      transcodeRangeB: '',
      setTranscodeRangeB: vi.fn(),
      loopPointA: null,
      loopPointB: null,
      currentTrackBookmarks: [],
      transcodeAutoEnqueue: true,
      setTranscodeAutoEnqueue: vi.fn(),
      isTranscoding: false,
      transcodeProgress: null,
      transcodeElapsedSeconds: 0,
      setIsSettingsOpen: vi.fn(),
      handleTranscode: vi.fn(),
      lastExportedTrack: null,
      setLastExportedTrack: vi.fn(),
      handlePlayLibraryTrack: vi.fn(),
      handleAddTrackToQueue: vi.fn(),
      setTrackToAddToPlaylist: vi.fn(),
      setShowPlaylistModal: vi.fn(),
      handleOpenContainingFolder: vi.fn(),
      showMessage: vi.fn(),
      handleUseCurrentTrackAsSource: vi.fn(),
    };

    const mockThemes: any = {
      setLanguage: vi.fn(),
      buttonGlowEnabled: true,
      setButtonGlowEnabled: vi.fn(),
      uiScale: 1,
      handleResetScale: vi.fn(),
      handleSelectScale: vi.fn(),
      themes: [],
      currentTheme: 'dark',
      handleSelectTheme: vi.fn(),
      customBgPath: '',
      setCustomBgPath: vi.fn(),
      themeBgImage: '',
      handlePickWallpaperFromDisk: vi.fn(),
      handleWallpaperDrop: vi.fn(),
      handleUploadBgImage: vi.fn(),
      handleRemoveBgImage: vi.fn(),
      handleSaveBackgroundSettings: vi.fn(),
      themeOverlay: 0.5,
      setThemeOverlay: vi.fn(),
      themeBlur: 0,
      setThemeBlur: vi.fn(),
      appIconStyle: 'default',
      handleSelectIconStyle: vi.fn(),
      jsonExportContent: '',
      handleExportTheme: vi.fn(),
      jsonImportContent: '',
      setJsonImportContent: vi.fn(),
      handleImportTheme: vi.fn(),
    };

    const mockAbout: any = {
      appIconStyle: 'default',
      setIsHealthCheckModalOpen: vi.fn(),
      setSettingsTab: vi.fn(),
      setIsOnboardingOpen: vi.fn(),
    };

    const mockBackup: any = {
      handleExportProfileBackup: vi.fn(),
      handleImportProfileBackup: vi.fn(),
      closeToTray: false,
      handleToggleCloseToTray: vi.fn(),
      autoFetchCoversBg: true,
      handleToggleAutoFetchCoversBg: vi.fn(),
      handleTriggerBackgroundCoverFetch: vi.fn(),
      coverSyncProgress: { running: false, processed: 0, total: 0 },
      discordRpcEnabled: false,
      discordRpcConnected: false,
      discordClientId: '',
      handleToggleDiscordRpc: vi.fn(),
      handleSaveDiscordClientId: vi.fn(),
      crossfadeDuration: 0,
      handleCrossfadeDurationChange: vi.fn(),
      listenbrainzEnabled: false,
      listenbrainzToken: '',
      listenbrainzUser: '',
      listenbrainzStatusMsg: '',
      listenbrainzTesting: false,
      handleToggleListenbrainz: vi.fn(),
      handleListenbrainzTokenChange: vi.fn(),
      handleTestListenbrainz: vi.fn(),
      lastfmEnabled: false,
      lastfmUsername: '',
      lastfmSessionKey: '',
      lastfmPendingToken: '',
      lastfmTesting: false,
      lastfmStatusMsg: '',
      lastfmCustomKey: '',
      lastfmCustomSecret: '',
      handleToggleLastfm: vi.fn(),
      handleConnectLastfm: vi.fn(),
      handleConfirmLastfmAuth: vi.fn(),
      handleDisconnectLastfm: vi.fn(),
      handleManualLastfmSessionKeyChange: vi.fn(),
      handleValidateLastfmSession: vi.fn(),
      handleSaveLastfmCustomKeys: vi.fn(),
    };

    const result = useAppSettingsModalProps({
      language: 'en',
      loc,
      appVersion: '1.2.3',
      updateManager: {} as any,
      audioDevices: mockAudioDevices,
      transcode: mockTranscode,
      themes: mockThemes,
      about: mockAbout,
      backup: mockBackup,
    });

    expect(result.devicesProps.language).toBe('en');
    expect(result.transcodeProps.filePath).toBe('/path');
    expect(result.themesProps.uiScale).toBe(1);
    expect(result.aboutProps.appIconStyle).toBe('default');
    expect(result.backupProps.closeToTray).toBe(false);
  });

  it('unpacks manager bundles automatically into respective settings tabs', () => {
    const loc = getTranslations('en');
    const mockThemeManager = {
      uiScale: 1.25,
      currentTheme: 'dark',
      appIconStyle: 'sakura',
      handleSelectScale: vi.fn(),
    };
    const mockModalManager = {
      setIsHealthCheckModalOpen: vi.fn(),
      setSettingsTab: vi.fn(),
    };
    const mockSessionManager = {
      closeToTray: true,
      handleToggleCloseToTray: vi.fn(),
    };

    const result = useAppSettingsModalProps({
      language: 'en',
      loc,
      appVersion: '1.2.3',
      updateManager: {} as any,
      // Partial manager mocks: the test checks only the About tab fields.
      themeManager: mockThemeManager as unknown as UseAppSettingsModalPropsParams['themeManager'],
      modalManager: mockModalManager as unknown as UseAppSettingsModalPropsParams['modalManager'],
      sessionManager: mockSessionManager as unknown as UseAppSettingsModalPropsParams['sessionManager'],
      audioDevices: {} as any,
      transcode: {} as any,
      themes: {} as any,
      about: {} as any,
      backup: {} as any,
    });

    expect(result.themesProps.uiScale).toBe(1.25);
    expect(result.aboutProps.appIconStyle).toBe('sakura');
    expect(result.backupProps.closeToTray).toBe(true);
  });
});

