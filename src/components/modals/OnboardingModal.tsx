import React, { useState } from 'react';
import {
  Sparkles,
  ShieldAlert,
  Heart,
  BarChart2,
  Sliders,
  Check,
  ChevronRight,
  ChevronLeft,
  X,
} from '../ui/icons';
import type { Language } from '../../i18n';
import { getTranslations } from '../../i18n';
import { cn } from '../../utils/cn';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLang: Language;
  onLanguageChange: (lang: Language) => void;
  recapOptIn: boolean;
  onRecapOptInChange: (enabled: boolean) => void;
  instantVolume: boolean;
  onInstantVolumeChange: (instant: boolean) => void;
  volumeOsdPosition: string;
  onVolumeOsdPositionChange: (pos: string) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  currentLang,
  onLanguageChange,
  recapOptIn,
  onRecapOptInChange,
  instantVolume,
  onInstantVolumeChange,
  volumeOsdPosition,
  onVolumeOsdPositionChange,
}) => {
  const [step, setStep] = useState<number>(1);

  if (!isOpen) return null;

  const loc = getTranslations(currentLang);

  const handleFinish = () => {
    try {
      localStorage.setItem('auralune_onboarding_completed', 'true');
    } catch {
      // Ignore localStorage errors
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-80 flex items-center justify-center bg-deep/85 p-5 backdrop-blur-lg motion-safe:animate-fade-in"
    >
      <div
        className="glass-card relative flex max-h-[90vh] w-full max-w-140 flex-col overflow-y-auto rounded-3xl border border-accent-purple/40 bg-modal p-8 text-fg shadow-modal"
      >
        {/* Close */}
        <button
          onClick={handleFinish}
          className="absolute top-5 right-5 border-0 bg-transparent p-1 text-fg-muted"
          title={loc.common.close}
        >
          <X size={20} />
        </button>

        {/* Step indicator */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={cn(
                'h-2 rounded-sm transition-all duration-300',
                step === s ? 'w-8' : 'w-2.5',
                step === s ? 'bg-accent-pink' : 'bg-white/15',
              )}
            />
          ))}
        </div>

        {/* STEP 1: who I am, why Auralune exists & disclaimer */}
        {step === 1 && (
          <div className="motion-safe:animate-fade-in">
            <div className="mb-4 flex items-center gap-3.5">
              <div
                className="flex h-13.5 w-13.5 items-center justify-center rounded-2xl border border-accent-pink bg-linear-135 from-accent-pink/30 to-accent-purple/40 shadow-halo-lg shadow-accent-pink/30"
              >
                <Sparkles size={28} className="text-accent-pink" />
              </div>
              <div>
                <h2 className="m-0 text-2xl font-extrabold tracking-tight">
                  Auralune <span className="text-sm font-semibold text-accent-cyan">Kitsune Player</span>
                </h2>
                <p className="mx-0 mt-0.5 mb-0 text-ui text-fg-secondary">
                  {loc.onboarding.subtitle}
                </p>
              </div>
            </div>

            {/* The author's personal note */}
            <div
              className="mb-4.5 rounded-2xl border border-accent-purple/25 bg-accent-purple/8 p-4 text-sm leading-normal text-slate-200"
            >
              <div className="mb-2 flex items-center gap-2 font-bold text-accent-purple">
                <Heart className="fill-accent-purple" size={16} />
                {loc.onboarding.whyAuralune}
              </div>
              <p className="m-0 italic">
                {loc.onboarding.whyAuraluneDesc}
              </p>
            </div>

            {/* No warranty / as-is disclaimer */}
            <div
              className="mb-5 rounded-2xl border border-accent-red/30 bg-accent-red/8 px-4 py-3.5 text-ui leading-normal text-red-300"
            >
              <div className="mb-1.5 flex items-center gap-2 font-bold text-accent-red">
                <ShieldAlert size={16} />
                {loc.onboarding.disclaimer}
              </div>
              <p className="m-0">
                {loc.onboarding.disclaimerDesc}
              </p>
            </div>
          </div>
        )}

        {/* STEP 2: Auralune Recap (Spotify Wrapped) opt-in & language */}
        {step === 2 && (
          <div className="motion-safe:animate-fade-in">
            <div className="mb-4 flex items-center gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-accent-cyan bg-accent-cyan/20"
              >
                <BarChart2 size={24} className="text-accent-cyan" />
              </div>
              <div>
                <h3 className="m-0 text-xl font-bold">
                  {loc.onboarding.recapAndLang}
                </h3>
                <p className="mx-0 mt-0.5 mb-0 text-ui text-fg-muted">
                  {loc.onboarding.recapAndLangDesc}
                </p>
              </div>
            </div>

            {/* Toggle Opt-in Recap */}
            <div
              className={cn(
                'mb-5 flex cursor-pointer items-center justify-between rounded-2xl border p-4',
                recapOptIn ? 'bg-accent-cyan/10' : 'bg-white/4',
                recapOptIn ? 'border-accent-cyan' : 'border-line',
              )}
              onClick={() => onRecapOptInChange(!recapOptIn)}
            >
              <div className="flex-1 pr-3.5">
                <div className={cn('mb-1 text-md font-bold', recapOptIn ? 'text-accent-cyan' : 'text-fg')}>
                  {loc.onboarding.enableRecap}
                </div>
                <div className="text-ui leading-snug text-fg-secondary">
                  {loc.onboarding.enableRecapDesc}
                </div>
              </div>
              <div
                className={cn(
                  'relative h-6.5 w-11.5 shrink-0 rounded-xl transition-colors duration-200',
                  recapOptIn ? 'bg-accent-cyan' : 'bg-white/20',
                )}
              >
                <div
                  className={cn(
                    'absolute top-1 h-5 w-5 rounded-full bg-white transition-[left] duration-200',
                    recapOptIn ? 'left-6' : 'left-1',
                  )}
                />
              </div>
            </div>

            {/* Language choice */}
            <div className="mb-4.5">
              <label className="mb-2 block text-sm font-semibold">
                {loc.onboarding.interfaceLang}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'en', label: 'English 🇬🇧' },
                  { id: 'pl', label: 'Polski 🇵🇱' },
                  { id: 'de', label: 'Deutsch 🇩🇪' },
                  { id: 'fi', label: 'Suomi 🇫🇮' },
                  { id: 'la', label: 'Latina 🏛️' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onLanguageChange(item.id as Language)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-ui',
                      currentLang === item.id ? 'bg-accent-purple/25' : 'bg-white/5',
                      currentLang === item.id ? 'border-accent-purple' : 'border-line',
                      currentLang === item.id ? 'text-fg' : 'text-fg-secondary',
                      currentLang === item.id ? 'font-bold' : 'font-medium',
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: volume (instant vs fade) & OSD position */}
        {step === 3 && (
          <div className="motion-safe:animate-fade-in">
            <div className="mb-4 flex items-center gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-accent-pink bg-accent-pink/20"
              >
                <Sliders size={24} className="text-accent-pink" />
              </div>
              <div>
                <h3 className="m-0 text-xl font-bold">
                  {loc.onboarding.audioAndVolume}
                </h3>
                <p className="mx-0 mt-0.5 mb-0 text-ui text-fg-muted">
                  {loc.onboarding.audioAndVolumeDesc}
                </p>
              </div>
            </div>

            {/* Volume mode: instant vs fade */}
            <div className="mb-5">
              <label className="mb-2 block text-sm font-semibold">
                {loc.onboarding.volumeMode}
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <div
                  onClick={() => onInstantVolumeChange(false)}
                  className={cn(
                    'cursor-pointer rounded-xl border p-3',
                    !instantVolume ? 'bg-accent-purple/20' : 'bg-white/4',
                    !instantVolume ? 'border-accent-purple' : 'border-line',
                  )}
                >
                  <div className="mb-1 text-sm font-bold">
                    {loc.onboarding.volumeSmooth}
                  </div>
                  <div className="text-xs text-fg-muted">
                    {loc.onboarding.volumeSmoothDesc}
                  </div>
                </div>

                <div
                  onClick={() => onInstantVolumeChange(true)}
                  className={cn(
                    'cursor-pointer rounded-xl border p-3',
                    instantVolume ? 'bg-accent-pink/20' : 'bg-white/4',
                    instantVolume ? 'border-accent-pink' : 'border-line',
                  )}
                >
                  <div className="mb-1 text-sm font-bold">
                    {loc.onboarding.volumeInstant}
                  </div>
                  <div className="text-xs text-fg-muted">
                    {loc.onboarding.volumeInstantDesc}
                  </div>
                </div>
              </div>
            </div>

            {/* OSD volume indicator position */}
            <div className="mb-5">
              <label className="mb-2 block text-sm font-semibold">
                {loc.onboarding.hudPlacement}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'center', label: loc.onboarding.hudCenter },
                  { id: 'top-right', label: loc.onboarding.hudTopRight },
                  { id: 'bottom-center', label: loc.onboarding.hudBottom },
                  { id: 'top-left', label: loc.onboarding.hudTopLeft },
                  { id: 'bottom-right', label: loc.onboarding.hudBottomRight },
                  { id: 'off', label: loc.onboarding.hudDisabled },
                ].map((pos) => (
                  <button
                    key={pos.id}
                    onClick={() => onVolumeOsdPositionChange(pos.id)}
                    className={cn(
                      'rounded-lg border px-2.5 py-2 text-ui',
                      volumeOsdPosition === pos.id ? 'bg-accent-cyan/25' : 'bg-white/5',
                      volumeOsdPosition === pos.id ? 'border-accent-cyan' : 'border-line',
                      volumeOsdPosition === pos.id ? 'text-fg' : 'text-fg-secondary',
                      volumeOsdPosition === pos.id ? 'font-bold' : 'font-medium',
                    )}
                  >
                    {pos.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step navigation buttons */}
        <div className="mt-auto flex items-center justify-between pt-4">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-1.5 rounded-xl border border-line bg-white/8 px-4.5 py-2.5 text-sm font-semibold text-fg"
            >
              <ChevronLeft size={16} /> {loc.onboarding.back}
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-1.5 rounded-xl border-0 bg-accent-gradient px-6 py-2.5 text-sm font-bold text-on-accent shadow-lift shadow-accent-pink/40"
            >
              {loc.onboarding.next} <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="flex items-center gap-2 rounded-xl border-0 bg-linear-135 from-accent-green to-accent-cyan px-7 py-2.5 text-sm font-bold text-fg shadow-xl shadow-accent-green/40"
            >
              <Check size={18} /> {loc.onboarding.startListening}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
