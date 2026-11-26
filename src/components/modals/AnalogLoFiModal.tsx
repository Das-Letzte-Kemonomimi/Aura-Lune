import React, { useEffect, useId, useState } from 'react';
import { Sparkles, Disc, CassetteTape, Volume2, Check, Radio } from '../ui/icons';
import { vinylSimulator, type VinylSimConfig } from '../../utils/vinylSimulator';
import { type Language, getTranslations } from '../../i18n';
import { cn } from '../../utils/cn';
import {
  Button,
  Callout,
  Card,
  Chip,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalShell,
  OptionCard,
  RangeSlider,
  SettingRow,
  StatusDot,
  type Tone,
} from '../ui';
import { textTones } from '../ui/tones';
import { ToggleSwitch } from '../common/ToggleSwitch';
import type { Translations } from '../../i18n';

/** The two simulated media, each with its own tone. */
const MEDIA = [
  { mode: 'vinyl', desc: 'vinylDesc', tone: 'pink', icon: <Disc size={20} /> },
  { mode: 'tape', desc: 'tapeDesc', tone: 'cyan', icon: <CassetteTape size={20} /> },
] as const satisfies readonly { mode: VinylSimConfig['mode']; desc: keyof Translations['analogLoFi']; tone: Tone; icon: React.ReactNode }[];

export interface AnalogLoFiModalProps {
  isOpen: boolean;
  onClose: () => void;
  isPlaying?: boolean;
  currentLang?: Language;
}

export const AnalogLoFiModal: React.FC<AnalogLoFiModalProps> = ({
  isOpen,
  onClose,
  isPlaying = false,
  currentLang = 'en',
}) => {
  const t = getTranslations(currentLang);
  const [config, setConfig] = useState<VinylSimConfig>(() => vinylSimulator.getConfig());
  const [previewActive, setPreviewActive] = useState<boolean>(false);
  const titleId = useId();

  useEffect(() => {
    return vinylSimulator.subscribe((newCfg) => {
      setConfig(newCfg);
    });
  }, []);

  // While the modal is open and the user clicks preview, temporarily force the playing state
  useEffect(() => {
    if (!isOpen && previewActive) {
      setPreviewActive(false);
      vinylSimulator.setPlaybackState(isPlaying);
    }
  }, [isOpen, isPlaying, previewActive]);

  const handleTogglePreview = () => {
    const next = !previewActive;
    setPreviewActive(next);
    vinylSimulator.setPlaybackState(next ? true : isPlaying);
  };

  if (!isOpen) return null;

  const presets = [
    { label: t.analogLoFi.presetSubtle, value: 0.12 },
    { label: t.analogLoFi.presetVintage, value: 0.25 },
    { label: t.analogLoFi.presetLofi, value: 0.50 },
    { label: t.analogLoFi.presetDeep, value: 0.80 },
  ];

  const isActuallyAudible = config.enabled && (isPlaying || previewActive || !config.autoSync);

  return (
    <ModalShell onClose={onClose} layer="studio" size="md" labelledBy={titleId}>
      <ModalHeader
        titleId={titleId}
        title={t.analogLoFi.title}
        subtitle={t.analogLoFi.subtitle}
        icon={<Sparkles size={20} />}
        onClose={onClose}
        closeLabel={t.common.close}
      />

      <ModalBody className="flex flex-col gap-5">
        {/* Main ON / OFF toggle */}
        <Callout
          tone={config.enabled ? 'pink' : 'purple'}
          className={cn('flex items-center justify-between gap-4', !config.enabled && 'border-line bg-white/5')}
        >
          <div>
            <div className="flex items-center gap-2">
              <StatusDot tone={config.enabled ? 'green' : 'neutral'} />
              <span className="text-base font-bold text-fg">
                {config.enabled ? t.analogLoFi.active : t.analogLoFi.disabled}
              </span>
            </div>
            <p className="mt-1 text-ui text-fg-secondary">{t.analogLoFi.desc}</p>
          </div>

          <Button
            variant={config.enabled ? 'primary' : 'secondary'}
            aria-pressed={config.enabled}
            onClick={() => vinylSimulator.setEnabled(!config.enabled)}
          >
            {config.enabled ? t.analogLoFi.enabledBtn : t.analogLoFi.disabledBtn}
          </Button>
        </Callout>

        {/* Medium: vinyl or tape */}
        <div role="group" aria-labelledby={`${titleId}-medium`}>
          <span id={`${titleId}-medium`} className="label-caps mb-2.5 block">
            {t.analogLoFi.mediumLabel}
          </span>
          <div className="grid grid-cols-2 gap-3">
            {MEDIA.map((m) => {
              const selected = config.mode === m.mode;
              return (
                <OptionCard key={m.mode} tone={m.tone} pressed={selected} onClick={() => vinylSimulator.setMode(m.mode)}>
                  <span className={cn('flex w-full items-center justify-between', selected ? textTones[m.tone] : 'text-fg-secondary')}>
                    <span className="flex items-center gap-2">
                      {m.icon}
                      <span className="text-md font-extrabold">{t.analogLoFi[m.mode]}</span>
                    </span>
                    {selected && <Check size={16} />}
                  </span>
                  <span className="text-xs leading-snug text-fg-secondary">{t.analogLoFi[m.desc]}</span>
                </OptionCard>
              );
            })}
          </div>
        </div>

        {/* Noise intensity */}
        <Card padding="sm" className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label htmlFor={`${titleId}-intensity`} className="flex items-center gap-2 text-sm font-bold text-fg">
              <Volume2 size={18} className="text-accent-purple" />
              {t.analogLoFi.noiseIntensity}
            </label>
            <strong className="font-mono text-lg text-accent-pink">{Math.round(config.intensity * 100)}%</strong>
          </div>
          <RangeSlider
            id={`${titleId}-intensity`}
            min={0}
            max={1}
            step={0.01}
            value={config.intensity}
            onChange={(v) => vinylSimulator.setIntensity(v)}
          />
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <Chip
                key={preset.label}
                pressed={Math.abs(config.intensity - preset.value) < 0.03}
                onClick={() => vinylSimulator.setIntensity(preset.value)}
                className="flex-1 justify-center"
              >
                {preset.label} ({Math.round(preset.value * 100)}%)
              </Chip>
            ))}
          </div>
        </Card>

        {/* Follow playback */}
        <Card padding="none" className="px-4">
          <SettingRow
            title={t.analogLoFi.autoSyncLabel}
            description={t.analogLoFi.autoSyncDesc}
            control={
              <ToggleSwitch
                checked={config.autoSync}
                onChange={(on) => vinylSimulator.setAutoSync(on)}
                label={t.analogLoFi.autoSyncLabel}
              />
            }
          />
        </Card>

        {/* Generator status and live preview */}
        <Card variant="inset" padding="none" className="flex items-center justify-between px-3.5 py-2.5">
          <div className="flex items-center gap-2 text-xs text-fg-secondary">
            <Radio size={14} className={isActuallyAudible ? 'text-accent-green' : 'text-fg-muted'} />
            <span>
              {t.analogLoFi.generatorStatus}{' '}
              <strong className={isActuallyAudible ? 'text-accent-green' : 'text-fg-secondary'}>
                {isActuallyAudible ? t.analogLoFi.statusAudible : t.analogLoFi.statusStandby}
              </strong>
            </span>
          </div>
          <Chip size="xs" pressed={previewActive} onClick={handleTogglePreview}>
            {previewActive ? t.analogLoFi.stopPreview : t.analogLoFi.testPreview}
          </Chip>
        </Card>
      </ModalBody>

      <ModalFooter>
        <Button variant="primary" onClick={onClose}>
          {t.analogLoFi.applyAndClose}
        </Button>
      </ModalFooter>
    </ModalShell>
  );
};
