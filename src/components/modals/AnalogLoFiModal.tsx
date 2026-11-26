import React, { useEffect, useId, useState } from 'react';
import { Sparkles, Disc, CassetteTape, Volume2, Check, Radio } from '../ui/icons';
import { vinylSimulator, type VinylSimConfig } from '../../utils/vinylSimulator';
import { type Language, getTranslations } from '../../i18n';
import { cn } from '../../utils/cn';
import { Button, Callout, ModalBody, ModalFooter, ModalHeader, ModalShell, StatusDot } from '../ui';

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

        {/* Medium choice: vinyl vs tape */}
        <div>
          <label className="mb-2.5 block text-ui font-bold text-slate-300">
            {t.analogLoFi.mediumLabel}
          </label>
          <div className="grid grid-cols-2 gap-3">
            
            {/* Vinyl option */}
            <button
              onClick={() => vinylSimulator.setMode('vinyl')}
              className={cn(
                'relative flex flex-col gap-2 rounded-2xl p-4 text-left transition-all duration-200',
                config.mode === 'vinyl' ? 'bg-linear-145 from-pink-500/20 to-accent-purple/10' : 'bg-white/3',
                config.mode === 'vinyl' ? 'border-2 border-accent-pink' : 'border border-white/8',
              )}
            >
              <div className="flex items-center justify-between">
                <div className={cn(
                  'flex items-center gap-2',
                  config.mode === 'vinyl' ? 'text-accent-pink' : 'text-slate-300',
                )}>
                  <Disc size={20} />
                  <span className="text-md font-extrabold">{t.analogLoFi.vinyl}</span>
                </div>
                {config.mode === 'vinyl' && (
                  <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-accent-pink text-on-accent">
                    <Check size={12} stroke={3} />
                  </span>
                )}
              </div>
              <p className="m-0 text-xs leading-snug text-fg-secondary">
                {t.analogLoFi.vinylDesc}
              </p>
            </button>

            {/* Tape option */}
            <button
              onClick={() => vinylSimulator.setMode('tape')}
              className={cn(
                'relative flex flex-col gap-2 rounded-2xl p-4 text-left transition-all duration-200',
                config.mode === 'tape' ? 'bg-linear-145 from-accent-cyan/20 to-blue-500/10' : 'bg-white/3',
                config.mode === 'tape' ? 'border-2 border-accent-cyan' : 'border border-white/8',
              )}
            >
              <div className="flex items-center justify-between">
                <div className={cn(
                  'flex items-center gap-2',
                  config.mode === 'tape' ? 'text-accent-cyan' : 'text-slate-300',
                )}>
                  <CassetteTape size={20} />
                  <span className="text-md font-extrabold">{t.analogLoFi.tape}</span>
                </div>
                {config.mode === 'tape' && (
                  <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-accent-cyan text-black">
                    <Check size={12} stroke={3} />
                  </span>
                )}
              </div>
              <p className="m-0 text-xs leading-snug text-fg-secondary">
                {t.analogLoFi.tapeDesc}
              </p>
            </button>

          </div>
        </div>

        {/* Noise intensity slider */}
        <div className="flex flex-col gap-3 rounded-2xl border border-white/6 bg-white/2 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 size={18} className="text-accent-purple" />
              <span className="text-sm font-bold text-slate-100">
                {t.analogLoFi.noiseIntensity}
              </span>
            </div>
            <strong className="font-mono text-lg text-accent-pink">
              {Math.round(config.intensity * 100)}%
            </strong>
          </div>

          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={config.intensity}
            onChange={(e) => vinylSimulator.setIntensity(parseFloat(e.target.value))}
            className="h-1.5 w-full cursor-pointer accent-accent-pink"
          />

          {/* Quick presets */}
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => {
              const isSelected = Math.abs(config.intensity - preset.value) < 0.03;
              return (
                <button
                  key={preset.label}
                  onClick={() => vinylSimulator.setIntensity(preset.value)}
                  className={cn(
                    'flex-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all duration-150',
                    isSelected ? 'border-accent-pink' : 'border-white/8',
                    isSelected ? 'bg-pink-500/20' : 'bg-white/4',
                    isSelected ? 'text-fg' : 'text-fg-secondary',
                  )}
                >
                  {preset.label} ({Math.round(preset.value * 100)}%)
                </button>
              );
            })}
          </div>
        </div>

        {/* Playback sync options */}
        <div className="flex items-center justify-between rounded-xl border border-white/6 bg-white/2 px-4 py-3.5">
          <div>
            <span className="text-ui font-semibold text-slate-200">
              {t.analogLoFi.autoSyncLabel}
            </span>
            <p className="mx-0 mt-0.5 mb-0 text-xs text-fg-secondary">
              {t.analogLoFi.autoSyncDesc}
            </p>
          </div>

          <input
            type="checkbox"
            checked={config.autoSync}
            onChange={(e) => vinylSimulator.setAutoSync(e.target.checked)}
            className="h-4.5 w-4.5 cursor-pointer accent-accent-purple"
          />
        </div>

        {/* Diagnostics bar & live preview */}
        <div className="flex items-center justify-between rounded-xl border border-white/4 bg-black/30 px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <Radio size={14} color={isActuallyAudible ? '#22c55e' : '#94a3b8'} />
            <span className="text-xs text-fg-secondary">
              {t.analogLoFi.generatorStatus}{' '}
              <strong className={cn(isActuallyAudible ? 'text-green-500' : 'text-slate-300')}>
                {isActuallyAudible ? t.analogLoFi.statusAudible : t.analogLoFi.statusStandby}
              </strong>
            </span>
          </div>

          <button
            onClick={handleTogglePreview}
            className={cn(
              'rounded-md border border-white/10 px-2.5 py-1 text-xs font-semibold text-fg',
              previewActive ? 'bg-accent-pink' : 'bg-white/6',
            )}
          >
            {previewActive ? t.analogLoFi.stopPreview : t.analogLoFi.testPreview}
          </button>
        </div>

      </ModalBody>

      <ModalFooter>
        <Button variant="primary" onClick={onClose}>
          {t.analogLoFi.applyAndClose}
        </Button>
      </ModalFooter>

    </ModalShell>
  );
};
