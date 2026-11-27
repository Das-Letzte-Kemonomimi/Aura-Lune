import type { Language, Translations } from '../../../i18n';
import type { AudioCard, DspEngineType, AlbumPlaybackBehavior } from '../../../types/player';
import type { VolumeOsdPosition } from '../../../components/player/VolumeOsd';
import type { VolumeCurve } from '../../../utils/volumeCurve';

/** Every audio-related value the settings tabs read; each tab picks the fields it needs. */
export interface AudioSettingsProps {
  language: Language;
  loc: Translations;
  onOpenHealthCheck: () => void;
  onRefreshDevices: () => void;
  seekFadeEnabled: boolean;
  onToggleSeekFade: () => void;
  instantVolume: boolean;
  onToggleInstantVolume: () => void;
  volumeUnit: 'percent' | 'db';
  onSetVolumeUnit: (unit: 'percent' | 'db') => void;
  volumeCurve: VolumeCurve;
  onSetVolumeCurve: (curve: VolumeCurve) => void;
  volumeOsdPosition: VolumeOsdPosition;
  onSetVolumeOsdPosition: (pos: VolumeOsdPosition) => void;
  recapOptIn: boolean;
  onToggleRecapOptIn: () => void;
  restoreSessionOnStartup: boolean;
  onToggleRestoreSessionOnStartup: () => void;
  dspAutoStartup: boolean;
  onToggleDspAutoStartup: () => void;
  dspDefaultEngine: DspEngineType;
  onSetDefaultDspEngine: (engine: DspEngineType) => void;
  audioBufferMs: number;
  onSetAudioBuffer: (ms: number) => void;
  dspBlockSize: number;
  onSetDspBlockSize: (frames: number) => void;
  desktopNotificationsEnabled: boolean;
  onToggleDesktopNotifications: () => void;
  albumPlaybackMode: AlbumPlaybackBehavior;
  onSetAlbumPlaybackMode: (mode: AlbumPlaybackBehavior) => void;
  replaygainMode: 'Off' | 'Track' | 'Album' | 'Auto';
  replaygainPreAmp: number;
  replaygainFallbackGain: number;
  replaygainPreventClipping: boolean;
  onSetReplayGain: (
    mode: 'Off' | 'Track' | 'Album' | 'Auto',
    preAmp: number,
    fallback: number,
    preventClipping: boolean
  ) => void;
  replaygainStatus: [number, number, boolean];
  replaygainScanWriteTags: boolean;
  onToggleReplaygainScanWriteTags: (enabled: boolean) => void;
  onScanLibraryReplayGain: () => void;
  isReplaygainScanning: boolean;
  crossfeedEnabled: boolean;
  crossfeedPreset: 'Default' | 'ChuMoy' | 'JanMeier' | 'Custom';
  crossfeedFcut: number;
  crossfeedFeed: number;
  onSetCrossfeed: (
    enabled: boolean,
    preset: 'Default' | 'ChuMoy' | 'JanMeier' | 'Custom',
    fcut?: number,
    feed?: number
  ) => void;
  silenceTrimmingEnabled: boolean;
  silenceTrimmingThreshold: number;
  onSetSilenceTrimming: (enabled: boolean, threshold: number) => void;
  cards: AudioCard[];
  onDisableProAudio: (cardName: string) => void;
  onEnableProAudio: (cardName: string) => void;
  onSetCardProfile: (cardName: string, profileName: string) => void;
  onSetBluetoothCodec: (cardName: string, codec: string) => void;
}
