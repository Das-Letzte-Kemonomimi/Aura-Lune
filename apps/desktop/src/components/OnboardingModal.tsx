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
} from 'lucide-react';
import type { Language } from '../i18n';
import { getTranslations } from '../i18n';

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
      // Ignoruj błędy localStorage
    }
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        background: 'rgba(5, 6, 12, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '560px',
          borderRadius: '24px',
          background: 'linear-gradient(145deg, rgba(22, 24, 44, 0.96), rgba(12, 14, 26, 0.98))',
          border: '1px solid rgba(168, 85, 247, 0.4)',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.85), 0 0 32px rgba(168, 85, 247, 0.25)',
          padding: '32px',
          color: '#fff',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Zamknięcie */}
        <button
          onClick={handleFinish}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px',
          }}
          title={loc.common.close}
        >
          <X size={20} />
        </button>

        {/* Wskaźnik kroków */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '24px' }}>
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              style={{
                width: step === s ? '32px' : '10px',
                height: '8px',
                borderRadius: '4px',
                background: step === s ? 'var(--accent-pink)' : 'rgba(255, 255, 255, 0.15)',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>

        {/* KROK 1: Kim jestem, dlaczego powstało Auralune & Disclaimer */}
        {step === 1 && (
          <div style={{ animation: 'fadeIn 0.25s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.3), rgba(168, 85, 247, 0.4))',
                  border: '1px solid var(--accent-pink)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 20px rgba(244, 63, 94, 0.3)',
                }}
              >
                <Sparkles size={28} color="var(--accent-pink)" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                  Auralune <span style={{ fontSize: '0.9rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>Kitsune Player</span>
                </h2>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  {loc.onboarding.subtitle}
                </p>
              </div>
            </div>

            {/* Osobista notka autorki */}
            <div
              style={{
                padding: '16px',
                borderRadius: '14px',
                background: 'rgba(168, 85, 247, 0.08)',
                border: '1px solid rgba(168, 85, 247, 0.25)',
                marginBottom: '18px',
                lineHeight: 1.55,
                fontSize: '0.88rem',
                color: '#e2e8f0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontWeight: 700, color: 'var(--accent-purple)' }}>
                <Heart size={16} fill="var(--accent-purple)" />
                {loc.onboarding.whyAuralune}
              </div>
              <p style={{ margin: 0, fontStyle: 'italic' }}>
                {loc.onboarding.whyAuraluneDesc}
              </p>
            </div>

            {/* Klauzula wyłączenia odpowiedzialności (No warranty / As-is disclaimer) */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '14px',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                marginBottom: '20px',
                fontSize: '0.8rem',
                lineHeight: 1.5,
                color: '#fca5a5',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', fontWeight: 700, color: '#ef4444' }}>
                <ShieldAlert size={16} />
                {loc.onboarding.disclaimer}
              </div>
              <p style={{ margin: 0 }}>
                {loc.onboarding.disclaimerDesc}
              </p>
            </div>
          </div>
        )}

        {/* KROK 2: Auralune Recap (Spotify Wrapped) Opt-in & Język */}
        {step === 2 && (
          <div style={{ animation: 'fadeIn 0.25s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'rgba(6, 182, 212, 0.2)',
                  border: '1px solid var(--accent-cyan)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BarChart2 size={24} color="var(--accent-cyan)" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                  {loc.onboarding.recapAndLang}
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {loc.onboarding.recapAndLangDesc}
                </p>
              </div>
            </div>

            {/* Toggle Opt-in Recap */}
            <div
              style={{
                padding: '16px',
                borderRadius: '14px',
                background: recapOptIn ? 'rgba(6, 182, 212, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${recapOptIn ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                marginBottom: '20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
              onClick={() => onRecapOptInChange(!recapOptIn)}
            >
              <div style={{ flex: 1, paddingRight: '14px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: '4px', color: recapOptIn ? 'var(--accent-cyan)' : '#fff' }}>
                  {loc.onboarding.enableRecap}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {loc.onboarding.enableRecapDesc}
                </div>
              </div>
              <div
                style={{
                  width: '46px',
                  height: '26px',
                  borderRadius: '13px',
                  background: recapOptIn ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.2)',
                  position: 'relative',
                  transition: 'background 0.2s',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: '#fff',
                    position: 'absolute',
                    top: '3px',
                    left: recapOptIn ? '23px' : '3px',
                    transition: 'left 0.2s',
                  }}
                />
              </div>
            </div>

            {/* Wybór języka */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px' }}>
                {loc.onboarding.interfaceLang}
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
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
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: currentLang === item.id ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${currentLang === item.id ? 'var(--accent-purple)' : 'var(--border-subtle)'}`,
                      color: currentLang === item.id ? '#fff' : 'var(--text-secondary)',
                      fontWeight: currentLang === item.id ? 700 : 500,
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* KROK 3: Głośność (Instant vs Fade) & Pozycja OSD */}
        {step === 3 && (
          <div style={{ animation: 'fadeIn 0.25s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'rgba(244, 63, 94, 0.2)',
                  border: '1px solid var(--accent-pink)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sliders size={24} color="var(--accent-pink)" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                  {loc.onboarding.audioAndVolume}
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {loc.onboarding.audioAndVolumeDesc}
                </p>
              </div>
            </div>

            {/* Tryb głośności: Instant vs Fade */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px' }}>
                {loc.onboarding.volumeMode}
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div
                  onClick={() => onInstantVolumeChange(false)}
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    background: !instantVolume ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                    border: `1px solid ${!instantVolume ? 'var(--accent-purple)' : 'var(--border-subtle)'}`,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '3px' }}>
                    {loc.onboarding.volumeSmooth}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {loc.onboarding.volumeSmoothDesc}
                  </div>
                </div>

                <div
                  onClick={() => onInstantVolumeChange(true)}
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    background: instantVolume ? 'rgba(244, 63, 94, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                    border: `1px solid ${instantVolume ? 'var(--accent-pink)' : 'var(--border-subtle)'}`,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '3px' }}>
                    {loc.onboarding.volumeInstant}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {loc.onboarding.volumeInstantDesc}
                  </div>
                </div>
              </div>
            </div>

            {/* Pozycja wskaźnika głośności OSD */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px' }}>
                {loc.onboarding.hudPlacement}
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
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
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: volumeOsdPosition === pos.id ? 'rgba(6, 182, 212, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${volumeOsdPosition === pos.id ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                      color: volumeOsdPosition === pos.id ? '#fff' : 'var(--text-secondary)',
                      fontWeight: volumeOsdPosition === pos.id ? 700 : 500,
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                    }}
                  >
                    {pos.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Przyciski nawigacji kroków */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '16px' }}>
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              style={{
                padding: '9px 18px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid var(--border-subtle)',
                color: '#fff',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <ChevronLeft size={16} /> {loc.onboarding.back}
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              style={{
                padding: '9px 24px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                border: 'none',
                color: '#fff',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 16px rgba(244, 63, 94, 0.4)',
              }}
            >
              {loc.onboarding.next} <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              style={{
                padding: '10px 28px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                border: 'none',
                color: '#fff',
                fontSize: '0.88rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)',
              }}
            >
              <Check size={18} /> {loc.onboarding.startListening}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
