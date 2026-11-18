import React from 'react';
import type { Language, Translations } from '../../i18n';
import type { AudioDevicesSettingsViewProps } from './AudioDevicesSettingsView';
import type { TranscodeSettingsViewProps } from './TranscodeSettingsView';
import type { ThemesSettingsViewProps } from './ThemesSettingsView';
import type { AboutSettingsViewProps } from './AboutSettingsView';
import type { BackupSettingsViewProps } from './BackupSettingsView';

export interface UseAppSettingsModalPropsParams {
  audioSettings?: any;
  transcodeManager?: any;
  themeManager?: any;
  modalManager?: any;
  sessionManager?: any;
  scrobblerManager?: any;
  dspManager?: any;
  playbackController?: any;
  masteringEffects?: any;
  [key: string]: any;
  language: Language;
  loc: Translations;
  audioDevices?: Partial<{
    cards: any[];
    refreshDevices: () => void;
    seekFadeEnabled: boolean;
    handleToggleSeekFade: () => void;
    instantVolume: boolean;
    setInstantVolume: (v: boolean) => void;
    volumeUnit: 'percent' | 'db';
    handleSetVolumeUnit: (u: 'percent' | 'db') => void;
    volumeOsdPosition: any;
    setVolumeOsdPosition: (pos: any) => void;
    recapOptIn: boolean;
    setRecapOptIn: (v: boolean) => void;
    restoreSessionOnStartup: boolean;
    handleToggleRestoreSessionOnStartup: () => void;
    dspAutoStartup: boolean;
    handleToggleDspAutoStartup: () => void;
    dspDefaultEngine: any;
    handleSetDefaultDspEngine: (e: any) => void;
    audioBufferMs: number;
    handleSetAudioBuffer: (ms: number) => void;
    dspBlockSize: number;
    handleSetDspBlockSize: (b: number) => void;
    desktopNotificationsEnabled: boolean;
    setDesktopNotificationsEnabled: (v: boolean) => void;
    albumPlaybackMode: any;
    setAlbumPlaybackMode: (m: any) => void;
    replaygainMode: any;
    replaygainPreAmp: number;
    replaygainFallbackGain: number;
    replaygainPreventClipping: boolean;
    handleSetReplayGain: any;
    replaygainStatus: any;
    replaygainScanWriteTags: boolean;
    setReplaygainScanWriteTags: React.Dispatch<React.SetStateAction<boolean>>;
    handleScanLibraryReplayGain: any;
    isReplaygainScanning: boolean;
    crossfeedEnabled: boolean;
    crossfeedPreset: any;
    crossfeedFcut: number;
    crossfeedFeed: number;
    handleSetCrossfeed: any;
    silenceTrimmingEnabled: boolean;
    silenceTrimmingThreshold: number;
    handleSetSilenceTrimming: any;
    handleDisableProAudio: any;
    handleEnableProAudio: any;
    handleSetCardProfile: any;
    handleSetBluetoothCodec: any;
    setIsHealthCheckModalOpen: (v: boolean) => void;
  }>;
  transcode?: Partial<{
    currentPlayingTrack: any;
    status: any;
    filePath: string;
    setFilePath: (p: string) => void;
    isPickingSource: boolean;
    handlePickTranscodeSource: () => void;
    transcodeOutput: string;
    setTranscodeOutput: (o: string) => void;
    isPickingDestination: boolean;
    handlePickTranscodeDestination: () => void;
    transcodeFormat: any;
    setTranscodeFormat: (f: any) => void;
    transcodeBitrate: number;
    setTranscodeBitrate: (b: number) => void;
    transcodeApplyDsp: boolean;
    setTranscodeApplyDsp: (a: boolean) => void;
    reverbEnabled: boolean;
    reverbLevel: number;
    transcodeApplyRange: boolean;
    setTranscodeApplyRange: (r: boolean) => void;
    transcodeRangeA: string;
    setTranscodeRangeA: (r: string) => void;
    transcodeRangeB: string;
    setTranscodeRangeB: (r: string) => void;
    loopPointA: number | null;
    loopPointB: number | null;
    currentTrackBookmarks: any[];
    transcodeAutoEnqueue: boolean;
    setTranscodeAutoEnqueue: (a: boolean) => void;
    isTranscoding: boolean;
    transcodeProgress: any;
    transcodeElapsedSeconds: number;
    setIsSettingsOpen: (v: boolean) => void;
    handleTranscode: () => void;
    lastExportedTrack: any;
    setLastExportedTrack: (t: any) => void;
    handlePlayLibraryTrack: any;
    handleAddTrackToQueue: any;
    setTrackToAddToPlaylist: any;
    setShowPlaylistModal: any;
    handleOpenContainingFolder: any;
    showMessage: any;
    handleUseCurrentTrackAsSource: any;
  }>;
  themes?: Partial<{
    setLanguage: (l: any) => void;
    buttonGlowEnabled: boolean;
    setButtonGlowEnabled: React.Dispatch<React.SetStateAction<boolean>>;
    uiScale: number;
    handleResetScale: () => void;
    handleSelectScale: (s: number) => void;
    themes: any[];
    currentTheme: any;
    handleSelectTheme: any;
    customBgPath: string;
    setCustomBgPath: any;
    themeBgImage: string | null;
    handlePickWallpaperFromDisk: any;
    handleWallpaperDrop: any;
    handleUploadBgImage: any;
    handleRemoveBgImage: any;
    handleSaveBackgroundSettings: any;
    themeOverlay: number;
    setThemeOverlay: any;
    themeBlur: number;
    setThemeBlur: any;
    appIconStyle: any;
    handleSelectIconStyle: any;
    jsonExportContent: string;
    handleExportTheme: any;
    jsonImportContent: string;
    setJsonImportContent: any;
    handleImportTheme: any;
  }>;
  about?: Partial<{
    appIconStyle: any;
    setIsHealthCheckModalOpen: (v: boolean) => void;
    setSettingsTab: (t: any) => void;
    setIsOnboardingOpen: (v: boolean) => void;
  }>;
  backup?: Partial<{
    handleExportProfileBackup: any;
    handleImportProfileBackup: any;
    closeToTray: boolean;
    handleToggleCloseToTray: any;
    discordRpcEnabled: boolean;
    discordRpcConnected: boolean;
    discordClientId: string;
    handleToggleDiscordRpc: any;
    handleSaveDiscordClientId: any;
    crossfadeDuration: number;
    handleCrossfadeDurationChange: any;
    listenbrainzEnabled: boolean;
    listenbrainzToken: string;
    listenbrainzUser: string | null;
    listenbrainzStatusMsg: string | null;
    listenbrainzTesting: boolean;
    handleToggleListenbrainz: any;
    handleListenbrainzTokenChange: any;
    handleTestListenbrainz: any;
    lastfmEnabled: boolean;
    lastfmUsername: string | null;
    lastfmSessionKey: string;
    lastfmPendingToken: string | null;
    lastfmTesting: boolean;
    lastfmStatusMsg: string | null;
    lastfmCustomKey: string;
    lastfmCustomSecret: string;
    handleToggleLastfm: any;
    handleConnectLastfm: any;
    handleConfirmLastfmAuth: any;
    handleDisconnectLastfm: any;
    handleManualLastfmSessionKeyChange: any;
    handleValidateLastfmSession: any;
    handleSaveLastfmCustomKeys: any;
  }>;
}

export function useAppSettingsModalProps(params: UseAppSettingsModalPropsParams) {
  const { language, loc } = params;

  const audioDevices = {
    ...(params.audioSettings || {}),
    ...(params.dspManager || {}),
    ...(params.modalManager || {}),
    ...(params.audioDevices || {}),
  };
  const transcode = {
    ...(params.transcodeManager || {}),
    ...(params.playbackController || {}),
    ...(params.dspManager || {}),
    ...(params.modalManager || {}),
    ...(params.transcode || {}),
  };
  const themes = {
    ...(params.themeManager || {}),
    ...(params.themes || {}),
  };
  const about = {
    ...(params.themeManager || {}),
    ...(params.modalManager || {}),
    ...params.about,
  };
  const backup = {
    ...(params.sessionManager || {}),
    ...(params.scrobblerManager || {}),
    ...(params.masteringEffects || {}),
    ...(params.backup || {}),
  };

  const devicesProps: AudioDevicesSettingsViewProps = {
    language,
    loc,
    onOpenHealthCheck: () => audioDevices.setIsHealthCheckModalOpen(true),
    onRefreshDevices: audioDevices.refreshDevices,
    seekFadeEnabled: audioDevices.seekFadeEnabled,
    onToggleSeekFade: audioDevices.handleToggleSeekFade,
    instantVolume: audioDevices.instantVolume,
    onToggleInstantVolume: () => {
      const next = !audioDevices.instantVolume;
      audioDevices.setInstantVolume(next);
      try { localStorage.setItem('auralune_instant_volume', String(next)); } catch {}
    },
    volumeUnit: audioDevices.volumeUnit,
    onSetVolumeUnit: audioDevices.handleSetVolumeUnit,
    volumeOsdPosition: audioDevices.volumeOsdPosition,
    onSetVolumeOsdPosition: (pos) => {
      audioDevices.setVolumeOsdPosition(pos);
      try { localStorage.setItem('auralune_volume_osd_position', pos); } catch {}
    },
    recapOptIn: audioDevices.recapOptIn,
    onToggleRecapOptIn: () => {
      const next = !audioDevices.recapOptIn;
      audioDevices.setRecapOptIn(next);
      try { localStorage.setItem('auralune_recap_opt_in', String(next)); } catch {}
    },
    restoreSessionOnStartup: audioDevices.restoreSessionOnStartup,
    onToggleRestoreSessionOnStartup: audioDevices.handleToggleRestoreSessionOnStartup,
    dspAutoStartup: audioDevices.dspAutoStartup,
    onToggleDspAutoStartup: audioDevices.handleToggleDspAutoStartup,
    dspDefaultEngine: audioDevices.dspDefaultEngine,
    onSetDefaultDspEngine: audioDevices.handleSetDefaultDspEngine,
    audioBufferMs: audioDevices.audioBufferMs,
    onSetAudioBuffer: audioDevices.handleSetAudioBuffer,
    dspBlockSize: audioDevices.dspBlockSize,
    onSetDspBlockSize: audioDevices.handleSetDspBlockSize,
    desktopNotificationsEnabled: audioDevices.desktopNotificationsEnabled,
    onToggleDesktopNotifications: () => {
      const nextVal = !audioDevices.desktopNotificationsEnabled;
      audioDevices.setDesktopNotificationsEnabled(nextVal);
      try { localStorage.setItem('auralune_notifications_enabled', String(nextVal)); } catch {}
    },
    albumPlaybackMode: audioDevices.albumPlaybackMode,
    onSetAlbumPlaybackMode: (mode) => {
      audioDevices.setAlbumPlaybackMode(mode);
      try { localStorage.setItem('auralune_album_playback_mode', mode); } catch {}
    },
    replaygainMode: audioDevices.replaygainMode,
    replaygainPreAmp: audioDevices.replaygainPreAmp,
    replaygainFallbackGain: audioDevices.replaygainFallbackGain,
    replaygainPreventClipping: audioDevices.replaygainPreventClipping,
    onSetReplayGain: audioDevices.handleSetReplayGain,
    replaygainStatus: audioDevices.replaygainStatus,
    replaygainScanWriteTags: audioDevices.replaygainScanWriteTags,
    onToggleReplaygainScanWriteTags: () => audioDevices.setReplaygainScanWriteTags((prev: boolean) => !prev),
    onScanLibraryReplayGain: audioDevices.handleScanLibraryReplayGain,
    isReplaygainScanning: audioDevices.isReplaygainScanning,
    crossfeedEnabled: audioDevices.crossfeedEnabled,
    crossfeedPreset: audioDevices.crossfeedPreset,
    crossfeedFcut: audioDevices.crossfeedFcut,
    crossfeedFeed: audioDevices.crossfeedFeed,
    onSetCrossfeed: audioDevices.handleSetCrossfeed,
    silenceTrimmingEnabled: audioDevices.silenceTrimmingEnabled,
    silenceTrimmingThreshold: audioDevices.silenceTrimmingThreshold,
    onSetSilenceTrimming: audioDevices.handleSetSilenceTrimming,
    cards: audioDevices.cards,
    onDisableProAudio: audioDevices.handleDisableProAudio,
    onEnableProAudio: audioDevices.handleEnableProAudio,
    onSetCardProfile: audioDevices.handleSetCardProfile,
    onSetBluetoothCodec: audioDevices.handleSetBluetoothCodec,
  };

  const transcodeProps: TranscodeSettingsViewProps = {
    language,
    loc,
    currentPlayingTrack: transcode.currentPlayingTrack,
    status: transcode.status,
    onUseCurrentTrackAsSource: transcode.handleUseCurrentTrackAsSource,
    filePath: transcode.filePath,
    onFilePathChange: transcode.setFilePath,
    isPickingSource: transcode.isPickingSource,
    onPickTranscodeSource: transcode.handlePickTranscodeSource,
    transcodeOutput: transcode.transcodeOutput,
    onTranscodeOutputChange: transcode.setTranscodeOutput,
    isPickingDestination: transcode.isPickingDestination,
    onPickTranscodeDestination: transcode.handlePickTranscodeDestination,
    transcodeFormat: transcode.transcodeFormat,
    onTranscodeFormatChange: transcode.setTranscodeFormat,
    transcodeBitrate: transcode.transcodeBitrate,
    onTranscodeBitrateChange: transcode.setTranscodeBitrate,
    transcodeApplyDsp: transcode.transcodeApplyDsp,
    onTranscodeApplyDspChange: transcode.setTranscodeApplyDsp,
    reverbEnabled: transcode.reverbEnabled,
    reverbLevel: transcode.reverbLevel,
    transcodeApplyRange: transcode.transcodeApplyRange,
    onTranscodeApplyRangeChange: transcode.setTranscodeApplyRange,
    transcodeRangeA: transcode.transcodeRangeA,
    onTranscodeRangeAChange: transcode.setTranscodeRangeA,
    transcodeRangeB: transcode.transcodeRangeB,
    onTranscodeRangeBChange: transcode.setTranscodeRangeB,
    loopPointA: transcode.loopPointA,
    loopPointB: transcode.loopPointB,
    currentTrackBookmarks: transcode.currentTrackBookmarks,
    transcodeAutoEnqueue: transcode.transcodeAutoEnqueue,
    onTranscodeAutoEnqueueChange: transcode.setTranscodeAutoEnqueue,
    isTranscoding: transcode.isTranscoding,
    transcodeProgress: transcode.transcodeProgress,
    transcodeElapsedSeconds: transcode.transcodeElapsedSeconds,
    onMinimizeToBackground: () => transcode.setIsSettingsOpen(false),
    onTranscode: transcode.handleTranscode,
    lastExportedTrack: transcode.lastExportedTrack,
    onDismissLastExported: () => transcode.setLastExportedTrack(null),
    onPlayLibraryTrack: transcode.handlePlayLibraryTrack,
    onAddTrackToQueue: transcode.handleAddTrackToQueue,
    onAddToPlaylist: (tr) => {
      transcode.setTrackToAddToPlaylist(tr);
      transcode.setShowPlaylistModal(true);
    },
    onOpenContainingFolder: transcode.handleOpenContainingFolder,
    onShowMessage: transcode.showMessage,
  };

  const themesProps: ThemesSettingsViewProps = {
    language,
    loc,
    onLanguageChange: themes.setLanguage,
    buttonGlowEnabled: themes.buttonGlowEnabled,
    onToggleGlow: () => themes.setButtonGlowEnabled((prev: boolean) => !prev),
    uiScale: themes.uiScale,
    onResetScale: themes.handleResetScale,
    onSelectScale: themes.handleSelectScale,
    themes: themes.themes,
    currentTheme: themes.currentTheme,
    onSelectTheme: themes.handleSelectTheme,
    customBgPath: themes.customBgPath,
    onCustomBgPathChange: themes.setCustomBgPath,
    themeBgImage: themes.themeBgImage,
    onPickWallpaperFromDisk: themes.handlePickWallpaperFromDisk,
    onWallpaperDrop: themes.handleWallpaperDrop,
    onUploadBgImage: themes.handleUploadBgImage,
    onRemoveBgImage: themes.handleRemoveBgImage,
    onSaveBackgroundSettings: themes.handleSaveBackgroundSettings,
    themeOverlay: themes.themeOverlay,
    onThemeOverlayChange: themes.setThemeOverlay,
    themeBlur: themes.themeBlur,
    onThemeBlurChange: themes.setThemeBlur,
    appIconStyle: themes.appIconStyle,
    onSelectIconStyle: themes.handleSelectIconStyle,
    jsonExportContent: themes.jsonExportContent,
    onExportTheme: themes.handleExportTheme,
    jsonImportContent: themes.jsonImportContent,
    onJsonImportContentChange: themes.setJsonImportContent,
    onImportTheme: themes.handleImportTheme,
  };

  const aboutProps: AboutSettingsViewProps = {
    appIconStyle: about.appIconStyle,
    language,
    loc,
    onOpenHealthCheck: () => about.setIsHealthCheckModalOpen(true),
    onOpenChangelog: () => about.setSettingsTab('changelog'),
    onOpenOnboarding: () => about.setIsOnboardingOpen(true),
  };

  const backupProps: BackupSettingsViewProps = {
    language,
    loc,
    onExportBackup: backup.handleExportProfileBackup,
    onImportBackup: backup.handleImportProfileBackup,
    closeToTray: backup.closeToTray,
    onToggleCloseToTray: backup.handleToggleCloseToTray,
    discordRpcEnabled: backup.discordRpcEnabled,
    discordRpcConnected: backup.discordRpcConnected,
    discordClientId: backup.discordClientId,
    onToggleDiscordRpc: backup.handleToggleDiscordRpc,
    onSaveDiscordClientId: backup.handleSaveDiscordClientId,
    crossfadeDuration: backup.crossfadeDuration,
    onCrossfadeDurationChange: backup.handleCrossfadeDurationChange,
    listenbrainzEnabled: backup.listenbrainzEnabled,
    listenbrainzToken: backup.listenbrainzToken,
    listenbrainzUser: backup.listenbrainzUser,
    listenbrainzStatusMsg: backup.listenbrainzStatusMsg,
    listenbrainzTesting: backup.listenbrainzTesting,
    onToggleListenbrainz: backup.handleToggleListenbrainz,
    onListenbrainzTokenChange: backup.handleListenbrainzTokenChange,
    onTestListenbrainz: backup.handleTestListenbrainz,
    lastfmEnabled: backup.lastfmEnabled,
    lastfmUsername: backup.lastfmUsername,
    lastfmSessionKey: backup.lastfmSessionKey,
    lastfmPendingToken: backup.lastfmPendingToken,
    lastfmTesting: backup.lastfmTesting,
    lastfmStatusMsg: backup.lastfmStatusMsg,
    lastfmCustomKey: backup.lastfmCustomKey,
    lastfmCustomSecret: backup.lastfmCustomSecret,
    onToggleLastfm: backup.handleToggleLastfm,
    onConnectLastfm: backup.handleConnectLastfm,
    onConfirmLastfmAuth: backup.handleConfirmLastfmAuth,
    onDisconnectLastfm: backup.handleDisconnectLastfm,
    onManualLastfmSessionKeyChange: backup.handleManualLastfmSessionKeyChange,
    onValidateLastfmSession: backup.handleValidateLastfmSession,
    onSaveLastfmCustomKeys: backup.handleSaveLastfmCustomKeys,
  };

  return {
    devicesProps,
    transcodeProps,
    themesProps,
    aboutProps,
    backupProps,
  };
}
