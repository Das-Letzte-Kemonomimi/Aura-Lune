import React, { useEffect, useId, useState } from 'react';
import { Moon, Clock, VolumeX, Check, BellOff, Sliders } from '../ui/icons';
import type { Language } from '../../i18n';
import { getTranslations } from '../../i18n';
import { cn } from '../../utils/cn';
import { cssVars } from '../../utils/cssVars';
import { ToggleSwitch } from '../common/ToggleSwitch';
import {
  Button,
  Callout,
  Card,
  Chip,
  FieldLabel,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalShell,
  NudgeButtons,
  SettingRow,
  TextField,
} from '../ui';

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

const PRESET_MINUTES = [15, 30, 45, 60, 90];
const MIN_MINUTES = 1;
const MAX_MINUTES = 720;
const SLIDER_MAX = 180;
const NUDGE_STEPS = [-15, -5, -1, 1, 5, 15] as const;

const formatCountdown = (secs: number) => {
  const mins = Math.floor(secs / 60);
  const s = secs % 60;
  return `${mins}:${s < 10 ? '0' : ''}${s}`;
};

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
  const id = useId();

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

  const setMinutes = (mins: number) => {
    setIsEndOfTrack(false);
    setSelectedMinutes(Math.max(MIN_MINUTES, Math.min(MAX_MINUTES, mins)));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setIsEndOfTrack(false);
    if (!isNaN(val)) setMinutes(val);
  };

  const cancelAndClose = () => {
    onCancelTimer();
    onClose();
  };

  const custom = !isEndOfTrack;
  const sliderPercent = Math.min(100, Math.max(0, ((Math.min(SLIDER_MAX, selectedMinutes) - 1) / (SLIDER_MAX - 1)) * 100));

  return (
    <ModalShell onClose={onClose} layer="nested" size="sm" labelledBy={`${id}-title`}>
      <ModalHeader
        titleId={`${id}-title`}
        title={loc.sleepTimerModal.title}
        subtitle={loc.sleepTimerModal.subtitle}
        icon={<Moon size={20} />}
        tone="purple"
        onClose={onClose}
        closeLabel={loc.common.close}
      />

      <ModalBody className="flex flex-col gap-4">
        {/* Active countdown (while the timer runs) */}
        {remainingSec !== null && remainingSec > 0 && (
          <Callout tone="purple" className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Clock size={18} className="text-accent-cyan" />
              <div>
                <span className="block text-xs text-fg-muted">{loc.sleepTimerModal.activeTimer}</span>
                <span className="font-mono text-lg font-bold text-accent-cyan">{formatCountdown(remainingSec)}</span>
              </div>
            </div>
            <Button variant="danger" size="sm" onClick={cancelAndClose}>
              <BellOff size={13} /> {loc.sleepTimerModal.cancel}
            </Button>
          </Callout>
        )}

        {targetMode === 'end_of_track' && (
          <Callout tone="cyan" className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-ui font-semibold text-accent-cyan">
              <Clock size={16} />
              {loc.sleepTimerModal.stopAfterCurrent}
            </div>
            <Button variant="danger" size="sm" onClick={cancelAndClose}>
              {loc.sleepTimerModal.cancel}
            </Button>
          </Callout>
        )}

        {/* Time choice: quick presets */}
        <div>
          <FieldLabel>{loc.sleepTimerModal.chooseTime}</FieldLabel>
          <div className="grid grid-cols-3 gap-2">
            {PRESET_MINUTES.map((mins) => (
              <Chip
                key={mins}
                pressed={!isEndOfTrack && selectedMinutes === mins}
                onClick={() => setMinutes(mins)}
                className="py-2 text-ui"
              >
                {mins} {loc.stats.minsUnit}
              </Chip>
            ))}
            <Chip pressed={isEndOfTrack} onClick={() => setIsEndOfTrack(true)} className="py-2 text-ui">
              {loc.sleepTimerModal.endOfTrack}
            </Chip>
          </div>
        </div>

        {/* Manual adjustment (any number of minutes, stepper and slider) */}
        <Card variant="inset" padding="sm" className={cn('border', custom ? 'border-accent-pink/30' : 'border-line')}>
          <div className="mb-3 flex items-center justify-between">
            <label
              htmlFor={`${id}-minutes`}
              className={cn('label-caps flex items-center gap-1.5', custom && 'text-accent-pink')}
            >
              <Sliders size={14} />
              {loc.sleepTimerModal.customDuration}
            </label>
            <div className="flex items-center gap-1.5">
              <TextField
                id={`${id}-minutes`}
                type="number"
                mono
                min={MIN_MINUTES}
                max={MAX_MINUTES}
                value={selectedMinutes}
                onChange={handleNumberChange}
                onFocus={() => setIsEndOfTrack(false)}
                className={cn('w-17 px-2 py-1 text-center text-base font-bold', !custom && 'text-fg-muted')}
              />
              <span className={cn('text-ui font-semibold', custom ? 'text-accent-pink' : 'text-fg-muted')}>
                {loc.stats.minsUnit}
              </span>
            </div>
          </div>

          <NudgeButtons
            value={selectedMinutes}
            onChange={setMinutes}
            steps={NUDGE_STEPS}
            min={MIN_MINUTES}
            max={MAX_MINUTES}
            className="mb-3 *:flex-1 *:py-1"
          />

          <input
            type="range"
            aria-label={loc.sleepTimerModal.customDuration}
            min={MIN_MINUTES}
            max={SLIDER_MAX}
            value={Math.min(SLIDER_MAX, selectedMinutes)}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className={cn('w-full', custom && 'range-fill')}
            style={custom ? cssVars({ '--fill': `${sliderPercent}%` }) : undefined}
          />
          <div className="mt-1 flex justify-between font-mono text-2xs text-fg-muted">
            <span>1 min</span>
            <span>45 min</span>
            <span>90 min (1.5h)</span>
            <span>180 min (3h)</span>
          </div>
        </Card>

        {/* Fade-out option */}
        <SettingRow
          icon={<VolumeX size={14} className="text-accent-pink" />}
          title={loc.sleepTimerModal.gentleFade}
          description={loc.sleepTimerModal.gentleFadeDesc}
          control={
            <ToggleSwitch checked={enableFadeOut} onChange={setEnableFadeOut} label={loc.sleepTimerModal.gentleFade} />
          }
          className="py-0"
        />
      </ModalBody>

      <ModalFooter>
        <Button onClick={onClose}>{loc.settings.close}</Button>
        <Button
          variant="primary"
          onClick={() => {
            onSetTimer(isEndOfTrack ? 'end_of_track' : selectedMinutes, enableFadeOut);
            onClose();
          }}
        >
          <Check size={15} /> {loc.sleepTimerModal.startTimer}
        </Button>
      </ModalFooter>
    </ModalShell>
  );
};
