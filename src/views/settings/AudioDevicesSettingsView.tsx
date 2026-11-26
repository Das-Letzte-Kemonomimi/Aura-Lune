import React from 'react';
import { Radio, Activity, RefreshCw, VolumeX, History, ListMusic, Check, Cpu, Power, Tv, Waves } from '../../components/ui/icons';
import { Badge, Button, Card, Chip, SectionHeader, Select, SliderRow, ToggleCard } from '../../components/ui';
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
import { SettingsPage } from './SettingsPage';
import type { VolumeCurve } from '../../utils/volumeCurve';

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

export const AudioDevicesSettingsView: React.FC<AudioDevicesSettingsViewProps> = (props) => {
  const {
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

  const albumModes: { id: AlbumPlaybackBehavior; label: string; short: string }[] = [
    { id: 'replace', label: loc.settings.albumPlaybackReplace, short: loc.settings.albumModeReplace },
    { id: 'append', label: loc.settings.albumPlaybackAppend, short: loc.settings.albumModeAppend },
    { id: 'single', label: loc.settings.albumPlaybackSingle, short: loc.settings.albumModeSingle },
  ];

  return (
    <SettingsPage
      title={loc.settings.audioDevices}
      icon={<Radio size={22} />}
      tone="green"
      actions={
        <>
          <Button variant="tinted" tone="green" onClick={onOpenHealthCheck}>
            <Activity size={16} /> {loc.settings.runHealthCheck}
          </Button>
          <Button onClick={onRefreshDevices}>
            <RefreshCw size={16} /> {loc.library.refresh}
          </Button>
        </>
      }
    >
      {/* Smooth fade when seeking */}
      <ToggleCard
        icon={<Waves size={20} />}
        tone="pink"
        title={loc.player.seekFadeTitle}
        description={loc.player.seekFadeDesc}
        checked={seekFadeEnabled}
        onChange={onToggleSeekFade}
      />

      {/* Volume, OSD and Recap stats card */}
      <VolumeAndOsdCard {...props} />

      {/* Remember the playback session on restart */}
      <ToggleCard
        icon={<History size={20} />}
        tone="purple"
        title={loc.settings.restoreSessionTitle}
        description={loc.settings.restoreSessionDesc}
        checked={restoreSessionOnStartup}
        onChange={onToggleRestoreSessionOnStartup}
      />

      {/* Remember the DSP settings at app start-up */}
      <ToggleCard
        icon={<Power size={20} />}
        tone="green"
        title={loc.dsp.dspAutostart}
        description={loc.dsp.bypassActiveNotice}
        checked={dspAutoStartup}
        onChange={onToggleDspAutoStartup}
      />

      {/* Default DSP engine at start-up */}
      <Card>
        <SectionHeader
          icon={<Cpu size={20} />}
          tone="purple"
          title={loc.settings.dspStartupTitle}
          description={loc.settings.dspStartupDesc}
          actions={
            <Select
              aria-label={loc.settings.dspStartupTitle}
              value={dspDefaultEngine}
              onChange={(e) => onSetDefaultDspEngine(e.target.value as DspEngineType)}
              className="w-auto"
            >
              <option value="Bypass">{loc.settings.dspEngineDirectBypass}</option>
              <option value="RubberBand">Rubber Band (Hi-Fi R3)</option>
              <option value="SoundTouch">{loc.settings.dspEngineSoundTouch}</option>
            </Select>
          }
        />
      </Card>

      {/* Audio output buffer (PipeWire / ALSA) */}
      <OutputBufferOption {...props} />

      {/* DSP processor block size */}
      <DspBlockSizeOption {...props} />

      {/* Desktop notifications (libnotify / D-Bus) */}
      <ToggleCard
        icon={<Tv size={20} />}
        tone="cyan"
        title={loc.settings.desktopNotificationsTitle}
        description={loc.settings.desktopNotificationsDesc}
        checked={desktopNotificationsEnabled}
        onChange={onToggleDesktopNotifications}
      />

      {/* Album and playlist playback behaviour (autoplay and queue) */}
      <Card>
        <SectionHeader
          icon={<ListMusic size={20} />}
          tone="pink"
          title={loc.settings.albumPlaybackTitle}
          description={loc.settings.albumPlaybackDesc}
          actions={<Badge tone="pink">{albumModes.find((m) => m.id === albumPlaybackMode)?.short}</Badge>}
        />
        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(--spacing(50),1fr))] gap-2">
          {albumModes.map((mode) => {
            const isActive = albumPlaybackMode === mode.id;
            return (
              <Chip
                key={mode.id}
                pressed={isActive}
                onClick={() => onSetAlbumPlaybackMode(mode.id)}
                className="justify-start px-3.5 py-2.5 text-left text-ui whitespace-normal"
              >
                {isActive && <Check size={14} className="shrink-0" />}
                {mode.label}
              </Chip>
            );
          })}
        </div>
      </Card>

      {/* ReplayGain 2.0 / EBU R128 volume normalisation */}
      <ReplayGainOption {...props} />

      {/* Bauer crossfeed filter (bs2b) for headphones */}
      <CrossfeedOption {...props} />

      {/* Automatic silence skipping (silence trimming) */}
      <ToggleCard
        icon={<VolumeX size={20} />}
        tone="green"
        title={loc.settings.silenceTrimmingTitle}
        description={loc.settings.silenceTrimmingDesc}
        checked={silenceTrimmingEnabled}
        onChange={(on) => onSetSilenceTrimming(on, silenceTrimmingThreshold)}
      >
        <SliderRow
          label={loc.settings.silenceTrimmingThreshold}
          tone="green"
          min={-80}
          max={-25}
          step={2.5}
          value={silenceTrimmingThreshold}
          format={(v) => `${v.toFixed(1)} dBFS`}
          disabled={!silenceTrimmingEnabled}
          onChange={(v) => onSetSilenceTrimming(silenceTrimmingEnabled, v)}
        />
        <div className="mt-1 flex justify-between text-xxs text-fg-muted">
          <span>-80 dB ({loc.settings.silenceTrimmingPure})</span>
          <span>-50 dB ({loc.settings.silenceTrimmingRecommended})</span>
          <span>-25 dB ({loc.settings.silenceTrimmingAggressive})</span>
        </div>
      </ToggleCard>

      {/* Sound card list */}
      <SoundCardList {...props} />
    </SettingsPage>
  );
};
