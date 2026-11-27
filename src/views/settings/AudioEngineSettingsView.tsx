import React from 'react';
import { Radio, Activity, RefreshCw } from '../../components/ui/icons';
import { Button, Select, SettingRow, SettingsGroup } from '../../components/ui';
import { type DspEngineType } from '../../types/player';
import { SoundCardList } from './audio/SoundCardList';
import { CrossfeedOption } from './audio/CrossfeedOption';
import { DspBlockSizeOption } from './audio/DspBlockSizeOption';
import { OutputBufferOption } from './audio/OutputBufferOption';
import type { AudioSettingsProps } from './audio/audioSettingsProps';
import { SettingsPage } from './SettingsPage';
import { ToggleRow } from './ToggleRow';

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
          <Button onClick={onOpenHealthCheck}>
            <Activity size={16} /> {loc.settings.runHealthCheck}
          </Button>
          <Button variant="tinted" tone="green" onClick={onRefreshDevices}>
            <RefreshCw size={16} /> {loc.library.refresh}
          </Button>
        </>
      }
    >
      {/* Sound card list */}
      <SoundCardList {...props} />

      <SettingsGroup label={loc.settings.group.engine}>
        {/* Audio output buffer (PipeWire / ALSA) */}
        <OutputBufferOption {...props} />

        {/* DSP processor block size */}
        <DspBlockSizeOption {...props} />

        {/* Remember the DSP settings at app start-up */}
        <ToggleRow
          title={loc.dsp.dspAutostart}
          description={loc.dsp.bypassActiveNotice}
          checked={dspAutoStartup}
          onChange={onToggleDspAutoStartup}
        />

        {/* Default DSP engine at start-up */}
        <SettingRow
          compact
          title={loc.settings.dspStartupTitle}
          description={loc.settings.dspStartupDesc}
          control={
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

        {/* Bauer crossfeed filter (bs2b) for headphones */}
        <CrossfeedOption {...props} />
      </SettingsGroup>
    </SettingsPage>
  );
};
