import React from 'react';
import { Radio, Activity, RefreshCw, Cpu, Power } from '../../components/ui/icons';
import { Button, Card, SectionHeader, Select, ToggleCard } from '../../components/ui';
import { type DspEngineType } from '../../types/player';
import { SoundCardList } from './audio/SoundCardList';
import { CrossfeedOption } from './audio/CrossfeedOption';
import { DspBlockSizeOption } from './audio/DspBlockSizeOption';
import { OutputBufferOption } from './audio/OutputBufferOption';
import type { AudioSettingsProps } from './audio/audioSettingsProps';
import { SettingsPage } from './SettingsPage';

export type AudioEngineSettingsViewProps = Pick<
  AudioSettingsProps,
  | 'loc'
  | 'onOpenHealthCheck'
  | 'onRefreshDevices'
  | 'dspAutoStartup'
  | 'onToggleDspAutoStartup'
  | 'dspDefaultEngine'
  | 'onSetDefaultDspEngine'
  | 'audioBufferMs'
  | 'onSetAudioBuffer'
  | 'dspBlockSize'
  | 'onSetDspBlockSize'
  | 'crossfeedEnabled'
  | 'crossfeedPreset'
  | 'crossfeedFcut'
  | 'crossfeedFeed'
  | 'onSetCrossfeed'
  | 'cards'
  | 'onDisableProAudio'
  | 'onEnableProAudio'
  | 'onSetCardProfile'
  | 'onSetBluetoothCodec'
>;

/** Output & Engine: sound cards, output buffer, DSP engine start-up and block size, crossfeed. */
export const AudioEngineSettingsView: React.FC<AudioEngineSettingsViewProps> = (props) => {
  const {
    loc,
    onOpenHealthCheck,
    onRefreshDevices,
    dspAutoStartup,
    onToggleDspAutoStartup,
    dspDefaultEngine,
    onSetDefaultDspEngine,
  } = props;

  return (
    <SettingsPage
      title={loc.settings.nav.audio}
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
      {/* Sound card list */}
      <SoundCardList {...props} />

      {/* Audio output buffer (PipeWire / ALSA) */}
      <OutputBufferOption {...props} />

      {/* DSP processor block size */}
      <DspBlockSizeOption {...props} />

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

      {/* Bauer crossfeed filter (bs2b) for headphones */}
      <CrossfeedOption {...props} />
    </SettingsPage>
  );
};
