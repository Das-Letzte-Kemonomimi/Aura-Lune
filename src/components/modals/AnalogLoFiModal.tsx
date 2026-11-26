import React, { useState, useEffect } from 'react';
import { X, Sparkles, Disc, CassetteTape, Volume2, Check, Radio } from '../ui/icons';
import { vinylSimulator, type VinylSimConfig } from '../../utils/vinylSimulator';
import { type Language, getTranslations } from '../../i18n';
import { cn } from '../../utils/cn';
import { ModalShell } from '../ui';

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

  useEffect(() => {
    return vinylSimulator.subscribe((newCfg) => {
      setConfig(newCfg);
    });
  }, []);

  // Escape closes the modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
    <ModalShell
      onClose={onClose}
      layer="studio"
      className="flex max-h-[90vh] max-w-140 flex-col overflow-hidden rounded-3xl border border-accent-purple/45"
    >
      {/* Pop-up header */}
      <div className="flex items-center justify-between border-b border-white/8 bg-white/2 px-6 pt-5 pb-4">
        <div className="flex items-center gap-3.5">
          <div
            className="flex h-10.5 w-10.5 items-center justify-center rounded-xl border border-pink-500/50 bg-linear-135 from-pink-500/30 to-accent-purple/30 shadow-halo-lg shadow-pink-500/30"
          >
            <Sparkles size={22} className="text-accent-pink" />
          </div>
          <div>
            <h3 className="m-0 text-xl font-extrabold tracking-tight text-fg">
              {t.analogLoFi.title}
            </h3>
            <p className="mx-0 mt-0.5 mb-0 text-ui text-fg-secondary">
              {t.analogLoFi.subtitle}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          aria-label={t.common.close}
          className="flex h-8.5 w-8.5 items-center justify-center rounded-xl border border-white/10 bg-white/6 text-fg-secondary transition-all duration-200"
        >
          <X size={18} />
        </button>
      </div>

      {/* Modal content */}
      <div className="flex flex-col gap-5 overflow-y-auto px-6 py-5.5">
        
        {/* Main ON / OFF toggle */}
        <div
          className={cn(
            'flex items-center justify-between rounded-2xl border px-4.5 py-3.5 transition-all duration-300',
            config.enabled ? 'bg-linear-135 from-pink-500/10 to-accent-purple/10' : 'bg-white/3',
            config.enabled ? 'border-pink-500/40' : 'border-white/8',
          )}
        >
          <div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'inline-block h-2.5 w-2.5 rounded-full',
                  config.enabled ? 'bg-green-500' : 'bg-fg-muted',
                  config.enabled ? 'shadow-halo-sm shadow-green-500' : 'shadow-none',
                )}
              />
              <span className="text-base font-bold text-fg">
                {config.enabled ? t.analogLoFi.active : t.analogLoFi.disabled}
              </span>
            </div>
            <p className="mx-0 mt-1 mb-0 text-ui text-fg-secondary">
              {t.analogLoFi.desc}
            </p>
          </div>

          <button
            onClick={() => vinylSimulator.setEnabled(!config.enabled)}
            className={cn(
              'rounded-xl border-0 px-5 py-2 text-sm font-bold text-fg transition-all duration-200',
              config.enabled ? 'bg-accent-gradient' : 'bg-white/10',
              config.enabled ? 'shadow-lift shadow-pink-500/40' : 'shadow-none',
            )}
          >
            {config.enabled ? t.analogLoFi.enabledBtn : t.analogLoFi.disabledBtn}
          </button>
        </div>

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

      </div>

      {/* Window footer */}
      <div className="flex justify-end border-t border-white/8 bg-black/25 px-6 py-3.5">
        <button
          onClick={onClose}
          className="rounded-xl border-0 bg-accent-gradient px-6 py-2 text-sm font-bold text-on-accent shadow-lift shadow-accent-purple/35"
        >
          {t.analogLoFi.applyAndClose}
        </button>
      </div>

    </ModalShell>
  );
};
