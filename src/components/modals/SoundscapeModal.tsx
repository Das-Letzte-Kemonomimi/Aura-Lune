import React, { useEffect, useId, useState } from 'react';
import {
  Waves,
  CloudRain,
  Disc,
  Flame,
  Wind,
  Coffee,
  Sparkles,
  RotateCcw,
} from '../ui/icons';
import { type Language, getTranslations } from '../../i18n';
import {
  soundscapeEngine,
  SOUNDSCAPE_PRESETS,
  type SoundscapeVolumes,
  type SoundscapePreset,
} from '../../utils/soundscapeAudio';
import { cn } from '../../utils/cn';
import { ToggleSwitch } from '../common/ToggleSwitch';
import { Button, Card, ModalBody, ModalHeader, ModalShell, RangeSlider, SettingRow, type Tone } from '../ui';
import { iconTileTones, textTones } from '../ui/tones';

interface SoundscapeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLang?: Language;
}

export const SoundscapeModal: React.FC<SoundscapeModalProps> = ({
  isOpen,
  onClose,
  currentLang = 'pl',
}) => {
  const loc = getTranslations(currentLang);
  const titleId = useId();
  const [volumes, setVolumes] = useState<SoundscapeVolumes>(() => soundscapeEngine.getVolumes());
  const [isMuted, setIsMuted] = useState<boolean>(() => soundscapeEngine.getIsMuted());
  const [autoSync, setAutoSync] = useState<boolean>(() => soundscapeEngine.isAutoSyncEnabled());

  useEffect(() => {
    if (!isOpen) return;
    const anim = requestAnimationFrame(() => {
      setVolumes(soundscapeEngine.getVolumes());
      setIsMuted(soundscapeEngine.getIsMuted());
      setAutoSync(soundscapeEngine.isAutoSyncEnabled());
    });
    return () => cancelAnimationFrame(anim);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleMasterChange = (val: number) => {
    soundscapeEngine.setMasterVolume(val);
    setVolumes(soundscapeEngine.getVolumes());
  };

  const handleChannelChange = (channel: keyof Omit<SoundscapeVolumes, 'master'>, val: number) => {
    soundscapeEngine.setChannelVolume(channel, val);
    setVolumes(soundscapeEngine.getVolumes());
  };

  const handleToggleEnabled = (enabled: boolean) => {
    soundscapeEngine.setEnabled(enabled);
    setIsMuted(!enabled);
  };

  const handleApplyPreset = (preset: SoundscapePreset) => {
    soundscapeEngine.applyPreset(preset);
    setVolumes(soundscapeEngine.getVolumes());
    setIsMuted(false);
  };

  const handleResetAll = () => {
    soundscapeEngine.setChannelVolume('rain', 0);
    soundscapeEngine.setChannelVolume('vinyl', 0);
    soundscapeEngine.setChannelVolume('campfire', 0);
    soundscapeEngine.setChannelVolume('wind_chimes', 0);
    soundscapeEngine.setChannelVolume('cafe_brown', 0);
    setVolumes(soundscapeEngine.getVolumes());
  };

  const handleAutoSyncToggle = () => {
    const nextVal = !autoSync;
    setAutoSync(nextVal);
    soundscapeEngine.setAutoSyncEnabled(nextVal);
  };

  const channels: Array<{
    key: keyof Omit<SoundscapeVolumes, 'master'>;
    label: string;
    sublabel: string;
    icon: React.ReactNode;
    tone: Tone;
  }> = [
    {
      key: 'rain',
      label: loc.soundscape.channelRain,
      sublabel: loc.soundscape.channelRainDesc,
      icon: <CloudRain size={18} />,
      tone: 'cyan',
    },
    {
      key: 'vinyl',
      label: loc.soundscape.channelVinyl,
      sublabel: loc.soundscape.channelVinylDesc,
      icon: <Disc size={18} />,
      tone: 'amber',
    },
    {
      key: 'campfire',
      label: loc.soundscape.channelCampfire,
      sublabel: loc.soundscape.channelCampfireDesc,
      icon: <Flame size={18} />,
      tone: 'red',
    },
    {
      key: 'wind_chimes',
      label: loc.soundscape.channelWind,
      sublabel: loc.soundscape.channelWindDesc,
      icon: <Wind size={18} />,
      tone: 'pink',
    },
    {
      key: 'cafe_brown',
      label: loc.soundscape.channelCafe,
      sublabel: loc.soundscape.channelCafeDesc,
      icon: <Coffee size={18} />,
      tone: 'purple',
    },
  ];

  const isAnyActive = soundscapeEngine.isSoundscapeActive();

  return (
    <ModalShell onClose={onClose} layer="studio" size="md" labelledBy={titleId}>
      <ModalHeader
        titleId={titleId}
        title={loc.soundscape.title}
        subtitle={loc.soundscape.subtitle}
        icon={<Waves size={20} />}
        tone="purple"
        onClose={onClose}
        closeLabel={loc.common.close}
      />

      <ModalBody className="flex flex-col gap-5">
      {/* Master volume and state */}
      <Card padding="none" className="flex flex-col gap-3 px-4.5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ToggleSwitch checked={!isMuted} onChange={handleToggleEnabled} label={loc.soundscape.power} />
            <div>
              <span className="text-md font-semibold">
                {loc.soundscape.masterVolume}
              </span>
              <div className="text-ui text-fg-secondary">
                {isMuted
                  ? loc.soundscape.off
                  : isAnyActive
                  ? loc.soundscape.active
                  : loc.soundscape.allSilent}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="min-w-10 text-right text-sm font-bold">
              {`${Math.round(volumes.master * 100)}%`}
            </span>
            <Button size="sm" onClick={handleResetAll}>
              <RotateCcw size={12} /> {loc.soundscape.resetZero}
            </Button>
          </div>
        </div>

        <RangeSlider
          min={0}
          max={1}
          step={0.01}
          value={volumes.master}
          onChange={handleMasterChange}
          aria-label={loc.soundscape.masterVolume}
        />
      </Card>

      {/* Ready-made presets */}
      <div>
        <div className="mb-2 text-ui font-semibold text-fg-secondary">
          {loc.soundscape.quickPresets}
        </div>
        <div className="flex flex-wrap gap-2">
          {SOUNDSCAPE_PRESETS.map((preset) => (
            <Button key={preset.id} onClick={() => handleApplyPreset(preset)}>
              <span>{preset.icon}</span>
              <span>{preset.name[currentLang] || preset.name.en}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Ambient channel list */}
      <div className="flex flex-col gap-2.5">
        <div className="text-ui font-semibold text-fg-secondary">
          {loc.soundscape.individualLayers}
        </div>

        {channels.map((chan) => {
          const vol = volumes[chan.key];
          const isActive = vol > 0.01 && !isMuted;

          return (
            <Card
              key={chan.key}
              padding="none"
              highlight={isActive && chan.tone}
              className="flex flex-col gap-2 rounded-2xl px-3.5 py-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={cn('flex size-7.5 items-center justify-center rounded-lg', iconTileTones[chan.tone])}>
                    {chan.icon}
                  </div>
                  <div>
                    <div className={cn('text-sm font-semibold', isActive ? 'text-fg' : 'text-fg-secondary')}>
                      {chan.label}
                    </div>
                    <div className="text-xs text-fg-secondary">
                      {chan.sublabel}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={cn('min-w-9.5 text-right text-ui font-bold', isActive ? textTones[chan.tone] : 'text-fg-muted')}>
                    {Math.round(vol * 100)}%
                  </span>
                  <Button size="sm" onClick={() => handleChannelChange(chan.key, vol > 0 ? 0 : 0.6)}>
                    {vol > 0 ? loc.soundscape.mute : loc.soundscape.unmute}
                  </Button>
                </div>
              </div>

              <RangeSlider
                min={0}
                max={1}
                step={0.01}
                value={vol}
                onChange={(v) => handleChannelChange(chan.key, v)}
                aria-label={chan.label}
              />
            </Card>
          );
        })}
      </div>

        {/* Sync with the anime particles option */}
        <Card padding="none" className="px-4">
          <SettingRow
            icon={<Sparkles size={16} className="text-accent-pink" />}
            title={loc.soundscape.autoSyncTitle}
            description={loc.soundscape.autoSyncDesc}
            control={
              <ToggleSwitch checked={autoSync} onChange={handleAutoSyncToggle} label={loc.soundscape.autoSyncTitle} />
            }
          />
        </Card>
      </ModalBody>
    </ModalShell>
  );
};
