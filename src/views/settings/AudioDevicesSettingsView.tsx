import React from 'react';
import { Radio, Activity, RefreshCw, VolumeX, History, ListMusic, Check } from '../../components/ui/icons';
import { type Language, type Translations } from '../../i18n';
import {
  type AudioCard,
  type DspEngineType,
  type AlbumPlaybackBehavior,
} from '../../types/player';
import { type VolumeOsdPosition } from '../../components/player/VolumeOsd';
import { SoundCardList } from './audio/SoundCardList';
import { CrossfeedOption } from './audio/CrossfeedOption';
import { ReplayGainOption } from './audio/ReplayGainOption';
import { DspBlockSizeOption } from './audio/DspBlockSizeOption';
import { OutputBufferOption } from './audio/OutputBufferOption';
import { VolumeAndOsdCard } from './audio/VolumeAndOsdCard';
import { cn } from '../../utils/cn';

export interface AudioDevicesSettingsViewProps {
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

export const AudioDevicesSettingsView: React.FC<AudioDevicesSettingsViewProps> = (props) => {
  const {
    language: _language,
    loc,
    onOpenHealthCheck,
    onRefreshDevices,
    seekFadeEnabled,
    onToggleSeekFade,
    restoreSessionOnStartup,
    onToggleRestoreSessionOnStartup,
    dspAutoStartup,
    onToggleDspAutoStartup,
    dspDefaultEngine,
    onSetDefaultDspEngine,
    desktopNotificationsEnabled,
    onToggleDesktopNotifications,
    albumPlaybackMode,
    onSetAlbumPlaybackMode,
    silenceTrimmingEnabled,
    silenceTrimmingThreshold,
    onSetSilenceTrimming,
  } = props;
  return (
    <div className="glass-panel mx-auto my-0 max-w-200 p-7">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl">
          <Radio size={20} className="text-accent-green" /> {loc.settings.audioDevices}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenHealthCheck}
            className="flex items-center gap-1.5 rounded-lg border border-green-500/40 bg-green-500/20 px-3.5 py-2 text-ui font-bold text-green-400"
          >
            <Activity size={14} />
            Test Toru Audio (Health Check)
          </button>
          <button
            onClick={onRefreshDevices}
            className="glass-card flex items-center gap-1.5 px-3.5 py-2 text-ui text-fg"
          >
            <RefreshCw size={14} /> {loc.library.refresh}
          </button>
        </div>
      </div>

      {/* Smooth progress bar fade option (Seek Fade) */}
      <div
        className={cn(
          'glass-card mb-3.5 flex items-center justify-between rounded-xl border px-5 py-4',
          seekFadeEnabled ? 'border-pink-500/40' : 'border-line',
        )}
      >
        <div>
          <div className="mb-1 text-md font-bold text-fg">
            {loc.player.seekFadeTitle}
          </div>
          <div className="text-ui text-fg-secondary">
            {loc.player.seekFadeDesc}
          </div>
        </div>
        <button
          onClick={onToggleSeekFade}
          className={cn(
            'rounded-lg border px-4 py-2 text-ui font-bold transition-all duration-150',
            seekFadeEnabled ? 'bg-pink-500/25' : 'bg-white/6',
            seekFadeEnabled ? 'border-accent-pink' : 'border-line',
            seekFadeEnabled ? 'text-accent-pink' : 'text-fg-muted',
          )}
        >
          {seekFadeEnabled ? loc.player.seekFadeOn : loc.player.seekFadeOff}
        </button>
      </div>

      {/* Volume, OSD and Recap stats card */}
      <VolumeAndOsdCard {...props} />

      {/* Remember the playback session on restart */}
      <div
        className={cn(
          'glass-card mb-3.5 flex items-center justify-between rounded-xl border px-5 py-4',
          restoreSessionOnStartup ? 'border-accent-purple/45' : 'border-line',
        )}
      >
        <div>
          <div className="mb-1 flex items-center gap-2 text-md font-bold text-fg">
            <History size={16} className="text-accent-purple" />
            {loc.settings.restoreSessionTitle}
          </div>
          <div className="text-ui text-fg-secondary">
            {loc.settings.restoreSessionDesc}
          </div>
        </div>
        <button
          onClick={onToggleRestoreSessionOnStartup}
          className={cn(
            'rounded-lg border px-4 py-2 text-ui font-bold transition-all duration-150',
            restoreSessionOnStartup ? 'bg-accent-purple/25' : 'bg-white/6',
            restoreSessionOnStartup ? 'border-accent-purple' : 'border-line',
            restoreSessionOnStartup ? 'text-accent-purple' : 'text-fg-muted',
          )}
        >
          {restoreSessionOnStartup ? loc.settings.restoreSessionOn : loc.settings.restoreSessionOff}
        </button>
      </div>

      {/* Remember the DSP settings at app start-up */}
      <div
        className={cn(
          'glass-card mb-3.5 flex items-center justify-between rounded-xl border px-5 py-4',
          dspAutoStartup ? 'border-accent-green/40' : 'border-line',
        )}
      >
        <div>
          <div className="mb-1 text-md font-bold text-fg">
            {loc.dsp.dspAutostart}
          </div>
          <div className="text-ui text-fg-secondary">
            {loc.dsp.bypassActiveNotice}
          </div>
        </div>
        <button
          onClick={onToggleDspAutoStartup}
          className={cn(
            'rounded-lg border px-4 py-2 text-ui font-bold transition-all duration-150',
            dspAutoStartup ? 'bg-accent-green/25' : 'bg-white/6',
            dspAutoStartup ? 'border-accent-green' : 'border-line',
            dspAutoStartup ? 'text-accent-green' : 'text-fg-muted',
          )}
        >
          {dspAutoStartup ? loc.dsp.dspAutostartOn : loc.dsp.dspAutostartOff}
        </button>
      </div>

      {/* Default DSP engine at start-up */}
      <div className="glass-card mb-3.5 flex items-center justify-between rounded-xl px-5 py-4">
        <div>
          <div className="mb-1 text-md font-bold text-fg">
            {loc.settings.dspStartupTitle}
          </div>
          <div className="text-ui text-fg-secondary">
            {loc.settings.dspStartupDesc}
          </div>
        </div>
        <select
          value={dspDefaultEngine}
          onChange={(e) => onSetDefaultDspEngine(e.target.value as DspEngineType)}
          className="pl-3 pr-7.5 py-2"
        >
          <option value="Bypass">
            {loc.settings.dspEngineDirectBypass}
          </option>
          <option value="RubberBand">Rubber Band (Hi-Fi R3)</option>
          <option value="SoundTouch">
            {loc.settings.dspEngineSoundTouch}
          </option>
        </select>
      </div>

      {/* Audio output buffer (PipeWire / ALSA) */}
      <OutputBufferOption {...props} />

      {/* DSP processor block size option */}
      <DspBlockSizeOption {...props} />

      {/* Linux OSD notifications (libnotify / D-Bus) */}
      <div
        className={cn(
          'glass-card mb-3.5 flex items-center justify-between rounded-xl border px-5 py-4',
          desktopNotificationsEnabled ? 'border-blue-500/40' : 'border-line',
        )}
      >
        <div>
          <div className="mb-1 text-md font-bold text-fg">
            {loc.settings.desktopNotificationsTitle}
          </div>
          <div className="text-ui text-fg-secondary">
            {loc.settings.desktopNotificationsDesc}
          </div>
        </div>
        <button
          onClick={onToggleDesktopNotifications}
          className={cn(
            'rounded-lg border px-4 py-2 text-ui font-bold transition-all duration-150',
            desktopNotificationsEnabled ? 'bg-blue-500/25' : 'bg-white/6',
            desktopNotificationsEnabled ? 'border-blue-500' : 'border-line',
            desktopNotificationsEnabled ? 'text-blue-400' : 'text-fg-muted',
          )}
        >
          {desktopNotificationsEnabled
            ? loc.settings.desktopNotificationsEnabled
            : loc.settings.desktopNotificationsDisabled}
        </button>
      </div>

      {/* Album and playlist playback behaviour (autoplay and queue) */}
      <div className="glass-card mb-3.5 rounded-xl border border-line bg-white/3 px-5 py-4.5">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListMusic size={18} className="text-accent-pink" />
            <span className="text-md font-bold text-fg">
              {loc.settings.albumPlaybackTitle}
            </span>
          </div>
          <span className="rounded-md bg-pink-500/20 px-2 py-1 text-xs font-bold text-accent-pink">
            {albumPlaybackMode === 'replace'
              ? loc.settings.albumModeReplace
              : albumPlaybackMode === 'append'
                ? loc.settings.albumModeAppend
                : loc.settings.albumModeSingle}
          </span>
        </div>

        <div className="mb-3.5 text-ui text-fg-secondary">
          {loc.settings.albumPlaybackDesc}
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(--spacing(50),1fr))] gap-2">
          {[
            { id: 'replace', label: loc.settings.albumPlaybackReplace },
            { id: 'append', label: loc.settings.albumPlaybackAppend },
            { id: 'single', label: loc.settings.albumPlaybackSingle },
          ].map((item) => {
            const isActive = albumPlaybackMode === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSetAlbumPlaybackMode(item.id as AlbumPlaybackBehavior)}
                className={cn(
                  'rounded-lg border px-3.5 py-2.5 text-left text-ui font-semibold transition-all duration-150',
                  isActive ? 'bg-pink-500/25' : 'bg-white/5',
                  isActive ? 'border-accent-pink' : 'border-line',
                  isActive ? 'text-fg' : 'text-fg-muted',
                )}
              >
                {isActive && <Check size={12} className="icon-inline mr-1" />}{item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ReplayGain 2.0 / EBU R128 volume normalisation */}
      <ReplayGainOption {...props} />

      {/* Bauer Crossfeed filter (bs2b) for headphones */}
      <CrossfeedOption {...props} />

      {/* Automatic silence skipping option (Silence Trimming) */}
      <div
        className={cn(
          'glass-card mb-3.5 rounded-xl border px-5 py-4.5 transition-all duration-200',
          silenceTrimmingEnabled ? 'border-accent-green/45' : 'border-line',
          silenceTrimmingEnabled ? 'bg-accent-green/5' : 'bg-white/3',
        )}
      >
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <VolumeX size={18} className="text-accent-green" />
            <span className="text-md font-bold text-fg">
              {loc.settings.silenceTrimmingTitle}
            </span>
          </div>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={silenceTrimmingEnabled}
              onChange={(e) => onSetSilenceTrimming(e.target.checked, silenceTrimmingThreshold)}
              className="h-4.5 w-4.5 cursor-pointer accent-accent-green"
            />
            <span className={cn(
              'text-ui font-semibold',
              silenceTrimmingEnabled ? 'text-accent-green' : 'text-fg-muted',
            )}>
              {silenceTrimmingEnabled ? loc.settings.desktopNotificationsEnabled : loc.settings.desktopNotificationsDisabled}
            </span>
          </label>
        </div>

        <div className="mb-3.5 text-ui text-fg-secondary">
          {loc.settings.silenceTrimmingDesc}
        </div>

        <div className={cn(
          'transition-opacity duration-200',
          silenceTrimmingEnabled ? 'opacity-100' : 'opacity-45',
          silenceTrimmingEnabled ? 'pointer-events-auto' : 'pointer-events-none',
        )}>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-ui text-fg-secondary">
              {loc.settings.silenceTrimmingThreshold}
            </span>
            <span className="font-mono text-ui font-bold text-fg">
              {silenceTrimmingThreshold.toFixed(1)} dBFS
            </span>
          </div>
          <input
            type="range"
            min="-80"
            max="-25"
            step="2.5"
            value={silenceTrimmingThreshold}
            onChange={(e) => onSetSilenceTrimming(silenceTrimmingEnabled, parseFloat(e.target.value))}
            className="w-full accent-accent-green"
          />
          <div className="mt-1 flex justify-between text-xxs text-fg-muted">
            <span>-80 dB ({loc.settings.silenceTrimmingPure})</span>
            <span>-50 dB ({loc.settings.silenceTrimmingRecommended})</span>
            <span>-25 dB ({loc.settings.silenceTrimmingAggressive})</span>
          </div>
        </div>
      </div>

      {/* Sound card list */}
      <SoundCardList {...props} />
    </div>
  );
};
