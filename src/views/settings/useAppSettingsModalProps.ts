import type { useAudioSettings } from '../../hooks/useAudioSettings';
import type { useTranscodeManager } from '../../hooks/useTranscodeManager';
import type { useThemeManager } from '../../hooks/useThemeManager';
import type { useModalManager } from '../../hooks/useModalManager';
import type { useSessionManager } from '../../hooks/useSessionManager';
import type { useScrobblerManager } from '../../hooks/useScrobblerManager';
import type { useDspManager } from '../../hooks/useDspManager';
import type { usePlaybackController } from '../../hooks/usePlaybackController';
import type { UpdateManager } from '../../hooks/useUpdateManager';
import type { useAudioMasteringEffects } from '../../hooks/useAudioMasteringEffects';
import React from 'react';
import type { Language, Translations } from '../../i18n';
import type { AudioDevicesSettingsViewProps } from './AudioDevicesSettingsView';
import type { TranscodeSettingsViewProps } from './TranscodeSettingsView';
import type { ThemesSettingsViewProps } from './ThemesSettingsView';
import type { UpdatesSettingsViewProps } from './UpdatesSettingsView';
import type { AboutSettingsViewProps } from './AboutSettingsView';
import type { SettingsTab } from './SettingsModal';
import type { BackupSettingsViewProps } from './BackupSettingsView';

export interface UseAppSettingsModalPropsParams {
  audioSettings?: ReturnType<typeof useAudioSettings>;
  transcodeManager?: ReturnType<typeof useTranscodeManager>;
  themeManager?: ReturnType<typeof useThemeManager>;
  modalManager?: ReturnType<typeof useModalManager>;
  sessionManager?: ReturnType<typeof useSessionManager>;
  scrobblerManager?: ReturnType<typeof useScrobblerManager>;
  dspManager?: ReturnType<typeof useDspManager>;
  playbackController?: ReturnType<typeof usePlaybackController>;
  masteringEffects?: ReturnType<typeof useAudioMasteringEffects>;
  updateManager: UpdateManager;
  language: Language;
  loc: Translations;
  appVersion: string;
  audioDevices?: Partial<{
    instantVolume: boolean;
    setInstantVolume: React.Dispatch<React.SetStateAction<boolean>>;
    volumeUnit: import("../../hooks/useVolumeUnit").VolumeUnit;
    handleSetVolumeUnit: (unit: import("../../hooks/useVolumeUnit").VolumeUnit) => void;
    volumeCurve: import("../../utils/volumeCurve").VolumeCurve;
    handleSetVolumeCurve: (curve: import("../../utils/volumeCurve").VolumeCurve) => void;
    volumeOsdPosition: import("../../components/player/VolumeOsd").VolumeOsdPosition;
    setVolumeOsdPosition: React.Dispatch<React.SetStateAction<import("../../components/player/VolumeOsd").VolumeOsdPosition>>;
    recapOptIn: boolean;
    setRecapOptIn: React.Dispatch<React.SetStateAction<boolean>>;
    desktopNotificationsEnabled: boolean;
    setDesktopNotificationsEnabled: (next: boolean | ((prev: boolean) => boolean)) => void;
    albumPlaybackMode: import("../../types/playback").AlbumPlaybackBehavior;
    setAlbumPlaybackMode: React.Dispatch<React.SetStateAction<import("../../types/playback").AlbumPlaybackBehavior>>;
  }>;
  transcode?: Partial<{
    currentPlayingTrack: import("../../types/library").TrackRecord | null;
    status: import("../../types/playback").PlaybackStatus;
    filePath: string;
    setFilePath: React.Dispatch<React.SetStateAction<string>>;
    reverbEnabled: boolean;
    reverbLevel: number;
    loopPointA: number | null;
    loopPointB: number | null;
    currentTrackBookmarks: import("../../types/player").TrackBookmarkDto[];
    lastExportedTrack: import("../../types/library").TrackRecord | null;
    setLastExportedTrack: React.Dispatch<React.SetStateAction<import("../../types/library").TrackRecord | null>>;
    handlePlayLibraryTrack: (track: import("../../types/library").TrackRecord, contextTracks?: import("../../types/library").TrackRecord[] | undefined) => Promise<void>;
    handleAddTrackToQueue: (track: import("../../types/library").TrackRecord, e?: React.MouseEvent<Element, MouseEvent> | undefined) => Promise<void>;
    setTrackToAddToPlaylist: React.Dispatch<React.SetStateAction<import("../../types/library").TrackRecord | null>>;
    setShowPlaylistModal: React.Dispatch<React.SetStateAction<boolean>>;
    handleOpenContainingFolder: (rawPath: string, e?: React.MouseEvent<Element, MouseEvent> | undefined) => Promise<void>;
    showMessage: (msg: string, isError?: boolean) => void;
    handleUseCurrentTrackAsSource: () => void;
  }>;
  themes?: Partial<{
    setLanguage: React.Dispatch<React.SetStateAction<import("../../i18n").Language>>;
    buttonGlowEnabled: boolean;
    setButtonGlowEnabled: React.Dispatch<React.SetStateAction<boolean>>;
    customBgPath: string;
    setCustomBgPath: React.Dispatch<React.SetStateAction<string>>;
    themeBgImage: string | null;
    handlePickWallpaperFromDisk: () => Promise<void>;
    handleWallpaperDrop: (e: React.DragEvent<Element>) => Promise<void>;
    handleUploadBgImage: () => Promise<void>;
    handleRemoveBgImage: () => Promise<void>;
    handleSaveBackgroundSettings: () => Promise<void>;
    handleSelectIconStyle: (style: "lineout" | "classic") => Promise<void>;
    handleExportTheme: () => Promise<void>;
    handleImportTheme: () => Promise<void>;
  }>;
  about?: Partial<{
    appIconStyle: AboutSettingsViewProps['appIconStyle'];
    setIsHealthCheckModalOpen: (v: boolean) => void;
    setSettingsTab: (t: SettingsTab) => void;
    setIsOnboardingOpen: (v: boolean) => void;
  }>;
  backup?: Partial<{
    handleExportProfileBackup: () => Promise<void>;
    handleImportProfileBackup: () => Promise<void>;
    closeToTray: boolean;
    handleToggleCloseToTray: (enabled: boolean) => Promise<void>;
    discordRpcEnabled: boolean;
    discordRpcConnected: boolean;
    discordClientId: string;
    handleToggleDiscordRpc: (enabled: boolean) => Promise<void>;
    handleSaveDiscordClientId: (newId: string) => Promise<void>;
    crossfadeDuration: number;
    handleCrossfadeDurationChange: (ms: number) => Promise<void>;
  }>;
}

/**
 * Builds the Settings window tab props from the domain hooks and overrides from `App`.
 * Each tab merges several managers; the type assertions describe where the values come from
 * (field types are checked, completeness is not; React contexts will replace this eventually).
 */
export function useAppSettingsModalProps(params: UseAppSettingsModalPropsParams) {
  const { language, loc, updateManager } = params;

  const audioDevices = {
    ...(params.audioSettings || {}),
    // "Restore the session at start-up" belongs to useSessionManager (it was missing here before,
    // so the toggle in the Devices tab did nothing).
    ...(params.sessionManager || {}),
    ...(params.dspManager || {}),
    ...(params.modalManager || {}),
    ...(params.audioDevices || {}),
  } as ReturnType<typeof useAudioSettings> &
    ReturnType<typeof useSessionManager> &
    ReturnType<typeof useDspManager> &
    ReturnType<typeof useModalManager> &
    Required<NonNullable<UseAppSettingsModalPropsParams['audioDevices']>>;
  const transcode = {
    ...(params.transcodeManager || {}),
    ...(params.playbackController || {}),
    ...(params.dspManager || {}),
    ...(params.modalManager || {}),
    ...(params.transcode || {}),
  } as ReturnType<typeof useTranscodeManager> &
    ReturnType<typeof usePlaybackController> &
    ReturnType<typeof useDspManager> &
    ReturnType<typeof useModalManager> &
    Required<NonNullable<UseAppSettingsModalPropsParams['transcode']>>;
  const themes = {
    ...(params.themeManager || {}),
    ...(params.themes || {}),
  } as ReturnType<typeof useThemeManager> &
    Required<NonNullable<UseAppSettingsModalPropsParams['themes']>>;
  const about = {
    ...(params.themeManager || {}),
    ...(params.modalManager || {}),
    ...params.about,
  } as ReturnType<typeof useThemeManager> &
    ReturnType<typeof useModalManager> &
    Required<NonNullable<UseAppSettingsModalPropsParams['about']>>;
  const backup = {
    ...(params.sessionManager || {}),
    ...(params.scrobblerManager || {}),
    ...(params.masteringEffects || {}),
    ...(params.backup || {}),
  } as ReturnType<typeof useSessionManager> &
    ReturnType<typeof useScrobblerManager> &
    ReturnType<typeof useAudioMasteringEffects> &
    Required<NonNullable<UseAppSettingsModalPropsParams['backup']>>;

  const devicesProps: AudioDevicesSettingsViewProps = {
    language,
    loc,
    onOpenHealthCheck: () => audioDevices.setIsHealthCheckModalOpen(true),
    onRefreshDevices: audioDevices.refreshDevices,
    seekFadeEnabled: audioDevices.seekFadeEnabled,
    onToggleSeekFade: audioDevices.handleToggleSeekFade,
    instantVolume: audioDevices.instantVolume,
    onToggleInstantVolume: () => {
      audioDevices.setInstantVolume(!audioDevices.instantVolume);
    },
    volumeUnit: audioDevices.volumeUnit,
    onSetVolumeUnit: audioDevices.handleSetVolumeUnit,
    volumeCurve: audioDevices.volumeCurve,
    onSetVolumeCurve: audioDevices.handleSetVolumeCurve,
    volumeOsdPosition: audioDevices.volumeOsdPosition,
    onSetVolumeOsdPosition: (pos) => {
      audioDevices.setVolumeOsdPosition(pos);
    },
    recapOptIn: audioDevices.recapOptIn,
    onToggleRecapOptIn: () => {
      audioDevices.setRecapOptIn(!audioDevices.recapOptIn);
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
    },
    albumPlaybackMode: audioDevices.albumPlaybackMode,
    onSetAlbumPlaybackMode: (mode) => {
      audioDevices.setAlbumPlaybackMode(mode);
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

  const updatesProps: UpdatesSettingsViewProps = {
    language,
    loc,
    buildInfo: updateManager.buildInfo,
    info: updateManager.info,
    checking: updateManager.checking,
    installing: updateManager.installing,
    installed: updateManager.installed,
    progress: updateManager.progress,
    error: updateManager.error,
    isSkipped: updateManager.isSkipped,
    autoCheckEnabled: updateManager.autoCheckEnabled,
    onCheckNow: () => void updateManager.checkNow(),
    onInstall: () => void updateManager.install(),
    onRestart: () => void updateManager.restart(),
    onSkip: () => void updateManager.skip(),
    onToggleAutoCheck: (enabled) => void updateManager.setAutoCheck(enabled),
  };

  const aboutProps: AboutSettingsViewProps = {
    appIconStyle: about.appIconStyle,
    appVersion: params.appVersion,
    buildInfo: updateManager.buildInfo,
    language,
    loc,
    onOpenHealthCheck: () => about.setIsHealthCheckModalOpen(true),
    onOpenChangelog: () => about.setSettingsTab('updates'),
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
    updatesProps,
    aboutProps,
    backupProps,
  };
}
