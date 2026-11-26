import React, { useEffect, useId, useState } from 'react';
import {
  Waves,
  CloudRain,
  Disc,
  Flame,
  Wind,
  Coffee,
  Volume2,
  VolumeX,
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
import { Card, ModalBody, ModalHeader, ModalShell, SettingRow } from '../ui';

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

  const handleToggleMute = () => {
    const muted = soundscapeEngine.toggleMute();
    setIsMuted(muted);
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
    color: string;
    bgAccent: string;
  }> = [
    {
      key: 'rain',
      label: loc.soundscape.channelRain,
      sublabel: loc.soundscape.channelRainDesc,
      icon: <CloudRain size={18} />,
      color: '#38bdf8',
      bgAccent: 'rgba(56, 189, 248, 0.15)',
    },
    {
      key: 'vinyl',
      label: loc.soundscape.channelVinyl,
      sublabel: loc.soundscape.channelVinylDesc,
      icon: <Disc size={18} />,
      color: '#f59e0b',
      bgAccent: 'rgba(245, 158, 11, 0.15)',
    },
    {
      key: 'campfire',
      label: loc.soundscape.channelCampfire,
      sublabel: loc.soundscape.channelCampfireDesc,
      icon: <Flame size={18} />,
      color: '#f43f5e',
      bgAccent: 'rgba(244, 63, 94, 0.15)',
    },
    {
      key: 'wind_chimes',
      label: loc.soundscape.channelWind,
      sublabel: loc.soundscape.channelWindDesc,
      icon: <Wind size={18} />,
      color: '#ec4899',
      bgAccent: 'rgba(236, 72, 153, 0.15)',
    },
    {
      key: 'cafe_brown',
      label: loc.soundscape.channelCafe,
      sublabel: loc.soundscape.channelCafeDesc,
      icon: <Coffee size={18} />,
      color: '#a855f7',
      bgAccent: 'rgba(168, 85, 247, 0.15)',
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
      <div className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-white/4 px-4.5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleMute}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-xl border',
                isMuted ? 'bg-accent-red/25' : 'bg-accent-purple/20',
                isMuted ? 'border-accent-red' : 'border-accent-purple',
                isMuted ? 'text-red-400' : 'text-purple-400',
              )}
              title={isMuted ? loc.soundscape.unmute : loc.soundscape.mute}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <div>
              <span className="text-md font-semibold">
                {loc.soundscape.masterVolume}
              </span>
              <div className="text-ui text-fg-secondary">
                {isMuted
                  ? loc.soundscape.muted
                  : isAnyActive
                  ? loc.soundscape.active
                  : loc.soundscape.allSilent}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="min-w-10 text-right text-sm font-bold">
              {isMuted ? '0%' : `${Math.round(volumes.master * 100)}%`}
            </span>
            <button
              onClick={handleResetAll}
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/6 px-2.5 py-1.5 text-ui text-fg-secondary"
              title={loc.soundscape.resetZero}
            >
              <RotateCcw size={12} />
              <span>{loc.soundscape.resetZero}</span>
            </button>
          </div>
        </div>

        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={isMuted ? 0 : volumes.master}
          onChange={(e) => handleMasterChange(parseFloat(e.target.value))}
          className="h-1.5 w-full cursor-pointer accent-purple-400"
        />
      </div>

      {/* Ready-made presets */}
      <div>
        <div className="mb-2 text-ui font-semibold text-fg-secondary">
          {loc.soundscape.quickPresets}
        </div>
        <div className="flex flex-wrap gap-2">
          {SOUNDSCAPE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleApplyPreset(preset)}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-ui font-semibold text-slate-200 transition-all duration-200 hover:border-accent-purple/40 hover:bg-accent-purple/20"
            >
              <span>{preset.icon}</span>
              <span>{preset.name[currentLang] || preset.name.en}</span>
            </button>
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
            <div
              key={chan.key}
              className="flex flex-col gap-2 rounded-2xl px-3.5 py-3 transition-all duration-200"
              style={{
                background: isActive ? chan.bgAccent : 'rgba(255, 255, 255, 0.03)',
                border: isActive ? `1px solid ${chan.color}60` : '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-white/6"
                    style={{ color: chan.color }}
                  >
                    {chan.icon}
                  </div>
                  <div>
                    <div className={cn('text-sm font-semibold', isActive ? 'text-fg' : 'text-slate-300')}>
                      {chan.label}
                    </div>
                    <div className="text-xs text-fg-secondary">
                      {chan.sublabel}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className="min-w-9.5 text-right text-ui font-bold"
                    style={{ color: isActive ? chan.color : '#64748b' }}
                  >
                    {Math.round(vol * 100)}%
                  </span>
                  <button
                    onClick={() => handleChannelChange(chan.key, vol > 0 ? 0 : 0.6)}
                    className="rounded-md border border-white/8 bg-white/6 px-2 py-1 text-xs text-fg-secondary"
                  >
                    {vol > 0 ? loc.soundscape.mute : loc.soundscape.unmute}
                  </button>
                </div>
              </div>

              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={vol}
                onChange={(e) => handleChannelChange(chan.key, parseFloat(e.target.value))}
                className="h-1.5 w-full cursor-pointer"
                style={{ accentColor: chan.color }}
              />
            </div>
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
