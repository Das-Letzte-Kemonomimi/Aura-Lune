import React from 'react';
import { Moon, Clock, VolumeX, X, Check, BellOff } from 'lucide-react';
import type { Language } from '../i18n';
import { getTranslations } from '../i18n';

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
  const [selectedMinutes, setSelectedMinutes] = React.useState<number | 'end_of_track'>(30);
  const [enableFadeOut, setEnableFadeOut] = React.useState<boolean>(fadeOut);

  if (!isOpen) return null;

  const loc = getTranslations(currentLang);

  const formatCountdown = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const presetTimes = [15, 30, 45, 60, 90];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        background: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '440px',
          borderRadius: '16px',
          background: 'linear-gradient(145deg, rgba(26, 20, 46, 0.94), rgba(16, 12, 30, 0.98))',
          border: '1px solid var(--border-accent)',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.8), 0 0 24px rgba(168, 85, 247, 0.25)',
          padding: '24px',
          color: '#fff',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Zamknięcie */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px',
          }}
        >
          <X size={18} />
        </button>

        {/* Nagłówek */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(168, 85, 247, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--accent-purple)',
            }}
          >
            <Moon size={22} color="var(--accent-purple)" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
              {loc.sleepTimerModal.title}
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {loc.sleepTimerModal.subtitle}
            </p>
          </div>
        </div>

        {/* Aktywny licznik (jeśli timer działa) */}
        {remainingSec !== null && remainingSec > 0 && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '10px',
              background: 'rgba(168, 85, 247, 0.15)',
              border: '1px solid rgba(168, 85, 247, 0.35)',
              marginBottom: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock size={18} color="var(--accent-cyan)" />
              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block' }}>
                  {loc.sleepTimerModal.activeTimer}
                </span>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                  {formatCountdown(remainingSec)}
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                onCancelTimer();
                onClose();
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                background: 'rgba(239, 68, 68, 0.2)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <BellOff size={13} /> {loc.sleepTimerModal.cancel}
            </button>
          </div>
        )}

        {targetMode === 'end_of_track' && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '10px',
              background: 'rgba(6, 182, 212, 0.15)',
              border: '1px solid rgba(6, 182, 212, 0.35)',
              marginBottom: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} color="var(--accent-cyan)" />
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent-cyan)' }}>
                {loc.sleepTimerModal.stopAfterCurrent}
              </span>
            </div>
            <button
              onClick={() => {
                onCancelTimer();
                onClose();
              }}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                background: 'rgba(239, 68, 68, 0.2)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {loc.sleepTimerModal.cancel}
            </button>
          </div>
        )}

        {/* Wybór czasu */}
        <div style={{ marginBottom: '18px' }}>
          <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
            {loc.sleepTimerModal.chooseTime}
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {presetTimes.map((mins) => (
              <button
                key={mins}
                onClick={() => setSelectedMinutes(mins)}
                style={{
                  padding: '10px 8px',
                  borderRadius: '8px',
                  background: selectedMinutes === mins ? 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))' : 'rgba(255, 255, 255, 0.05)',
                  border: selectedMinutes === mins ? '1px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
                  color: selectedMinutes === mins ? '#fff' : 'var(--text-secondary)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {mins} {loc.stats.minsUnit}
              </button>
            ))}
            <button
              onClick={() => setSelectedMinutes('end_of_track')}
              style={{
                padding: '10px 8px',
                borderRadius: '8px',
                background: selectedMinutes === 'end_of_track' ? 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))' : 'rgba(255, 255, 255, 0.05)',
                border: selectedMinutes === 'end_of_track' ? '1px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
                color: selectedMinutes === 'end_of_track' ? '#fff' : 'var(--text-secondary)',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {loc.sleepTimerModal.endOfTrack}
            </button>
          </div>
        </div>

        {/* Opcja Fade-Out */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid var(--border-subtle)',
            marginBottom: '20px',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={enableFadeOut}
            onChange={(e) => setEnableFadeOut(e.target.checked)}
            style={{ cursor: 'pointer', accentColor: 'var(--accent-pink)' }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <VolumeX size={14} color="var(--accent-pink)" />
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff' }}>
                {loc.sleepTimerModal.gentleFade}
              </span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
              {loc.sleepTimerModal.gentleFadeDesc}
            </span>
          </div>
        </label>

        {/* Przyciski akcji */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {loc.settings.close}
          </button>
          <button
            onClick={() => {
              onSetTimer(selectedMinutes, enableFadeOut);
              onClose();
            }}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
              border: 'none',
              color: '#fff',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 14px rgba(244, 63, 94, 0.35)',
            }}
          >
            <Check size={15} /> {loc.sleepTimerModal.startTimer}
          </button>
        </div>
      </div>
    </div>
  );
};
