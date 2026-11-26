import React, { useState, useEffect } from 'react';
import { Moon, Clock, VolumeX, X, Check, BellOff, Sliders } from '../ui/icons';
import type { Language } from '../../i18n';
import { getTranslations } from '../../i18n';
import { cn } from '../../utils/cn';
import { ModalShell } from '../ui';
import { cssVars } from '../../utils/cssVars';

interface SleepTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLang?: Language;
  remainingSec: number | null;
  targetMode: 'time' | 'end_of_track' | null;
  fadeOut: boolean;
  onSetTimer: (minutes: number | 'end_of_track', fadeOut: boolean) => void;
  onCancelTimer: () => void;
}

export const SleepTimerModal: React.FC<SleepTimerModalProps> = ({
  isOpen,
  onClose,
  currentLang = 'pl',
  remainingSec,
  targetMode,
  fadeOut,
  onSetTimer,
  onCancelTimer,
}) => {
  const [selectedMinutes, setSelectedMinutes] = useState<number>(30);
  const [isEndOfTrack, setIsEndOfTrack] = useState<boolean>(false);
  const [enableFadeOut, setEnableFadeOut] = useState<boolean>(fadeOut);

  useEffect(() => {
    if (isOpen) {
      if (targetMode === 'end_of_track') {
        setIsEndOfTrack(true);
      } else if (remainingSec && remainingSec > 0) {
        setIsEndOfTrack(false);
        setSelectedMinutes(Math.max(1, Math.ceil(remainingSec / 60)));
      } else {
        setIsEndOfTrack(false);
        setSelectedMinutes(30);
      }
      setEnableFadeOut(fadeOut);
    }
  }, [isOpen, targetMode, remainingSec, fadeOut]);

  if (!isOpen) return null;

  const loc = getTranslations(currentLang);

  const formatCountdown = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const presetTimes = [15, 30, 45, 60, 90];

  const handleSelectPreset = (mins: number) => {
    setIsEndOfTrack(false);
    setSelectedMinutes(mins);
  };

  const handleSelectEndOfTrack = () => {
    setIsEndOfTrack(true);
  };

  const handleStep = (delta: number) => {
    setIsEndOfTrack(false);
    setSelectedMinutes((prev) => Math.max(1, Math.min(720, prev + delta)));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setIsEndOfTrack(false);
    if (!isNaN(val)) {
      setSelectedMinutes(Math.max(1, Math.min(720, val)));
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsEndOfTrack(false);
    setSelectedMinutes(Number(e.target.value));
  };

  const sliderPercent = Math.min(100, Math.max(0, ((Math.min(180, selectedMinutes) - 1) / 179) * 100));

  return (
    <ModalShell
      onClose={onClose}
      layer="nested"
      className="max-w-115 rounded-2xl border border-line-accent p-6 text-fg"
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 border-0 bg-transparent p-1 text-fg-muted"
      >
        <X size={18} />
      </button>

      {/* Header */}
      <div className="mb-4.5 flex items-center gap-2.5">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-accent-purple bg-accent-purple/20"
        >
          <Moon size={22} className="text-accent-purple" />
        </div>
        <div>
          <h3 className="m-0 text-lg font-bold">
            {loc.sleepTimerModal.title}
          </h3>
          <p className="mx-0 mt-0.5 mb-0 text-ui text-fg-muted">
            {loc.sleepTimerModal.subtitle}
          </p>
        </div>
      </div>

      {/* Active countdown (while the timer runs) */}
      {remainingSec !== null && remainingSec > 0 && (
        <div
          className="mb-4 flex items-center justify-between rounded-xl border border-accent-purple/35 bg-accent-purple/15 px-4 py-3"
        >
          <div className="flex items-center gap-2.5">
            <Clock size={18} className="text-accent-cyan" />
            <div>
              <span className="block text-xs text-fg-muted">
                {loc.sleepTimerModal.activeTimer}
              </span>
              <span className="font-mono text-lg font-bold text-accent-cyan">
                {formatCountdown(remainingSec)}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              onCancelTimer();
              onClose();
            }}
            className="flex items-center gap-1.5 rounded-md border border-accent-red/40 bg-accent-red/20 px-3 py-1.5 text-xs font-semibold text-accent-red"
          >
            <BellOff size={13} /> {loc.sleepTimerModal.cancel}
          </button>
        </div>
      )}

      {targetMode === 'end_of_track' && (
        <div
          className="mb-4 flex items-center justify-between rounded-xl border border-accent-cyan/35 bg-accent-cyan/15 px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-accent-cyan" />
            <span className="text-ui font-semibold text-accent-cyan">
              {loc.sleepTimerModal.stopAfterCurrent}
            </span>
          </div>
          <button
            onClick={() => {
              onCancelTimer();
              onClose();
            }}
            className="rounded-md border border-accent-red/40 bg-accent-red/20 px-2.5 py-1.5 text-xs font-semibold text-accent-red"
          >
            {loc.sleepTimerModal.cancel}
          </button>
        </div>
      )}

      {/* Time choice: quick presets */}
      <div className="mb-3.5">
        <label className="mb-2 block text-xs font-bold tracking-wider text-fg-muted">
          {loc.sleepTimerModal.chooseTime}
        </label>
        <div className="grid grid-cols-3 gap-2">
          {presetTimes.map((mins) => {
            const isSelected = !isEndOfTrack && selectedMinutes === mins;
            return (
              <button
                key={mins}
                onClick={() => handleSelectPreset(mins)}
                className={cn(
                  'rounded-lg border px-2 py-2.5 text-ui font-semibold transition-all duration-150',
                  isSelected ? 'bg-accent-gradient' : 'bg-white/5',
                  isSelected ? 'border-accent-pink' : 'border-line',
                  isSelected ? 'text-fg' : 'text-fg-secondary',
                  isSelected && 'shadow-halo shadow-accent-pink/35',
                )}
              >
                {mins} {loc.stats.minsUnit}
              </button>
            );
          })}
          <button
            onClick={handleSelectEndOfTrack}
            className={cn(
              'rounded-lg border px-2 py-2.5 text-ui font-semibold transition-all duration-150',
              isEndOfTrack ? 'bg-accent-gradient' : 'bg-white/5',
              isEndOfTrack ? 'border-accent-pink' : 'border-line',
              isEndOfTrack ? 'text-fg' : 'text-fg-secondary',
              isEndOfTrack && 'shadow-halo shadow-accent-pink/35',
            )}
          >
            {loc.sleepTimerModal.endOfTrack}
          </button>
        </div>
      </div>

      {/* Manual adjustment panel (any number of minutes, stepper and slider) */}
      <div
        className={cn(
          'mb-4 rounded-xl border bg-white/3 px-3.5 py-3 transition-all duration-200',
          !isEndOfTrack ? 'border-accent-pink/30' : 'border-line',
        )}
      >
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sliders className={cn(!isEndOfTrack ? 'text-accent-pink' : 'text-fg-muted')} size={14} />
            <span className={cn(
              'text-xs font-bold tracking-wider',
              !isEndOfTrack ? 'text-accent-pink' : 'text-fg-muted',
            )}>
              {loc.sleepTimerModal.customDuration}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={720}
              value={selectedMinutes}
              onChange={handleNumberChange}
              onFocus={() => setIsEndOfTrack(false)}
              className={cn(
                'w-17 rounded-md border bg-black/45 px-2 py-1 text-center font-mono text-base font-extrabold outline-none',
                !isEndOfTrack ? 'border-accent-pink' : 'border-line',
                !isEndOfTrack ? 'text-fg' : 'text-fg-muted',
                !isEndOfTrack ? 'shadow-halo-sm shadow-accent-pink/30' : 'shadow-none',
              )}
            />
            <span className={cn('text-ui font-semibold', !isEndOfTrack ? 'text-accent-pink' : 'text-fg-muted')}>
              {loc.stats.minsUnit}
            </span>
          </div>
        </div>

        {/* Quick change buttons (+ / -) */}
        <div className="mb-2.5 flex justify-center gap-1.5">
          {[-15, -5, -1, 1, 5, 15].map((delta) => (
            <button
              key={delta}
              type="button"
              onClick={() => handleStep(delta)}
              className={cn(
                'flex-1 rounded-md border border-line bg-white/5 px-0 py-1.5 font-mono text-xs font-bold transition-all duration-150',
                !isEndOfTrack ? 'text-fg-secondary' : 'text-fg-muted',
              )}
              title={`${delta > 0 ? `+${delta}` : delta} ${loc.stats.minsUnit}`}
            >
              {delta > 0 ? `+${delta}` : delta}
            </button>
          ))}
        </div>

        {/* Range slider */}
        <div className="relative w-full">
          <input
            type="range"
            min={1}
            max={180}
            value={Math.min(180, selectedMinutes)}
            onChange={handleSliderChange}
            className={cn('w-full', !isEndOfTrack && 'range-fill')}
            style={isEndOfTrack ? undefined : cssVars({ '--fill': `${sliderPercent}%` })}
          />
          <div className="mt-1 flex justify-between font-mono text-2xs text-fg-muted">
            <span>1 min</span>
            <span>45 min</span>
            <span>90 min (1.5h)</span>
            <span>180 min (3h)</span>
          </div>
        </div>
      </div>

      {/* Fade-out option */}
      <label
        className="mb-5 flex cursor-pointer items-center gap-2.5 rounded-lg border border-line bg-white/4 px-3.5 py-2.5"
      >
        <input
          type="checkbox"
          checked={enableFadeOut}
          onChange={(e) => setEnableFadeOut(e.target.checked)}
          className="cursor-pointer accent-accent-pink"
        />
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <VolumeX size={14} className="text-accent-pink" />
            <span className="text-ui font-semibold text-fg">
              {loc.sleepTimerModal.gentleFade}
            </span>
          </div>
          <span className="mt-0.5 block text-xs text-fg-muted">
            {loc.sleepTimerModal.gentleFadeDesc}
          </span>
        </div>
      </label>

      {/* Action buttons */}
      <div className="flex justify-end gap-2.5">
        <button
          onClick={onClose}
          className="rounded-lg border border-line bg-white/8 px-4 py-2 text-ui font-semibold text-fg-muted"
        >
          {loc.settings.close}
        </button>
        <button
          onClick={() => {
            onSetTimer(isEndOfTrack ? 'end_of_track' : selectedMinutes, enableFadeOut);
            onClose();
          }}
          className="flex items-center gap-1.5 rounded-lg border-0 bg-accent-gradient px-5 py-2 text-ui font-bold text-on-accent shadow-lift shadow-accent-pink/35"
        >
          <Check size={15} /> {loc.sleepTimerModal.startTimer}
        </button>
      </div>
    </ModalShell>
  );
};
