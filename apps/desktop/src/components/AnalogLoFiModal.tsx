import React, { useState, useEffect } from 'react';
import { X, Sparkles, Disc, CassetteTape, Volume2, Check, Radio } from 'lucide-react';
import { vinylSimulator, type VinylSimConfig } from '../utils/vinylSimulator';

export interface AnalogLoFiModalProps {
  isOpen: boolean;
  onClose: () => void;
  isPlaying?: boolean;
}

export const AnalogLoFiModal: React.FC<AnalogLoFiModalProps> = ({
  isOpen,
  onClose,
  isPlaying = false,
}) => {
  const [config, setConfig] = useState<VinylSimConfig>(() => vinylSimulator.getConfig());
  const [previewActive, setPreviewActive] = useState<boolean>(false);

  useEffect(() => {
    return vinylSimulator.subscribe((newCfg) => {
      setConfig(newCfg);
    });
  }, []);

  // Obsługa klawisza Escape do zamknięcia
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Gdy modal jest otwarty i użytkownik kliknie preview, tymczasowo wymuś stan odtwarzania
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
    { label: 'Subtelny', value: 0.12 },
    { label: 'Vintage Hi-Fi', value: 0.25 },
    { label: 'Lo-Fi Chill', value: 0.50 },
    { label: 'Głęboki Retro', value: 0.80 },
  ];

  const isActuallyAudible = config.enabled && (isPlaying || previewActive || !config.autoSync);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'linear-gradient(145deg, rgba(22, 18, 38, 0.98), rgba(12, 10, 22, 0.98))',
          border: '1px solid rgba(168, 85, 247, 0.45)',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85), 0 0 35px rgba(168, 85, 247, 0.25)',
          overflow: 'hidden',
          animation: 'modalSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nagłówek okna pop-up */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.3), rgba(168, 85, 247, 0.3))',
                border: '1px solid rgba(236, 72, 153, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 16px rgba(236, 72, 153, 0.3)',
              }}
            >
              <Sparkles size={22} color="var(--accent-pink)" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.22rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
                Analog Lo-Fi FX Studio
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.80rem', color: '#94a3b8' }}>
                Generator organicznego szumu winylu i ciepłej taśmy magnetycznej
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Zamknij"
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '10px',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Zawartość modala */}
        <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
          
          {/* Główny przełącznik WŁĄCZ / WYŁĄCZ */}
          <div
            style={{
              padding: '14px 18px',
              borderRadius: '14px',
              background: config.enabled
                ? 'linear-gradient(135deg, rgba(236, 72, 153, 0.12), rgba(168, 85, 247, 0.12))'
                : 'rgba(255, 255, 255, 0.03)',
              border: config.enabled
                ? '1px solid rgba(236, 72, 153, 0.4)'
                : '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.3s ease',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '9px',
                    height: '9px',
                    borderRadius: '50%',
                    background: config.enabled ? '#22c55e' : '#64748b',
                    boxShadow: config.enabled ? '0 0 10px #22c55e' : 'none',
                    display: 'inline-block',
                  }}
                />
                <span style={{ fontSize: '0.98rem', fontWeight: 700, color: '#f8fafc' }}>
                  {config.enabled ? 'Efekt analogowy jest AKTYWNY' : 'Efekt analogowy jest WYŁĄCZONY'}
                </span>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                Generuje fizyczny szum mechaniczny w tle odtwarzanego dźwięku
              </p>
            </div>

            <button
              onClick={() => vinylSimulator.setEnabled(!config.enabled)}
              style={{
                padding: '8px 20px',
                borderRadius: '10px',
                border: 'none',
                background: config.enabled
                  ? 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))'
                  : 'rgba(255, 255, 255, 0.1)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: config.enabled ? '0 4px 16px rgba(236, 72, 153, 0.4)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              {config.enabled ? 'WŁĄCZONY' : 'WYŁĄCZONY'}
            </button>
          </div>

          {/* Wybór nośnika: Winyl vs Taśma */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '10px' }}>
              Wybierz charakter analogowy (nośnik):
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              
              {/* Opcja Winyl */}
              <button
                onClick={() => vinylSimulator.setMode('vinyl')}
                style={{
                  padding: '16px',
                  borderRadius: '14px',
                  textAlign: 'left',
                  background: config.mode === 'vinyl'
                    ? 'linear-gradient(145deg, rgba(236, 72, 153, 0.18), rgba(168, 85, 247, 0.12))'
                    : 'rgba(255, 255, 255, 0.03)',
                  border: config.mode === 'vinyl'
                    ? '2px solid var(--accent-pink)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  position: 'relative',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: config.mode === 'vinyl' ? 'var(--accent-pink)' : '#cbd5e1' }}>
                    <Disc size={20} />
                    <span style={{ fontWeight: 800, fontSize: '0.92rem' }}>Płyta Winylowa</span>
                  </div>
                  {config.mode === 'vinyl' && (
                    <span style={{ background: 'var(--accent-pink)', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: '0.74rem', color: '#94a3b8', lineHeight: 1.4 }}>
                  Mikrorowki, rotacyjny sweep 33⅓/45 RPM, trzaski kurzu i dudnienie igły (rumble).
                </p>
              </button>

              {/* Opcja Taśma */}
              <button
                onClick={() => vinylSimulator.setMode('tape')}
                style={{
                  padding: '16px',
                  borderRadius: '14px',
                  textAlign: 'left',
                  background: config.mode === 'tape'
                    ? 'linear-gradient(145deg, rgba(6, 182, 212, 0.18), rgba(59, 130, 246, 0.12))'
                    : 'rgba(255, 255, 255, 0.03)',
                  border: config.mode === 'tape'
                    ? '2px solid var(--accent-cyan)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  position: 'relative',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: config.mode === 'tape' ? 'var(--accent-cyan)' : '#cbd5e1' }}>
                    <CassetteTape size={20} />
                    <span style={{ fontWeight: 800, fontSize: '0.92rem' }}>Taśma Magnetyczna</span>
                  </div>
                  {config.mode === 'tape' && (
                    <span style={{ background: 'var(--accent-cyan)', color: '#000', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: '0.74rem', color: '#94a3b8', lineHeight: 1.4 }}>
                  Ciepły szum nośnika ferrytowego/chromowego (Tape Hiss) i nasycenie taśmy.
                </p>
              </button>

            </div>
          </div>

          {/* Suwak intensywności szumu */}
          <div
            style={{
              padding: '16px',
              borderRadius: '14px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Volume2 size={18} color="var(--accent-purple)" />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f1f5f9' }}>
                  Intensywność szumu i trzasków:
                </span>
              </div>
              <strong style={{ fontSize: '1.15rem', color: 'var(--accent-pink)', fontFamily: 'var(--font-mono)' }}>
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
              style={{
                width: '100%',
                accentColor: 'var(--accent-pink)',
                cursor: 'pointer',
                height: '6px',
              }}
            />

            {/* Szybkie presety */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {presets.map((preset) => {
                const isSelected = Math.abs(config.intensity - preset.value) < 0.03;
                return (
                  <button
                    key={preset.label}
                    onClick={() => vinylSimulator.setIntensity(preset.value)}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      borderRadius: '8px',
                      border: isSelected ? '1px solid var(--accent-pink)' : '1px solid rgba(255, 255, 255, 0.08)',
                      background: isSelected ? 'rgba(236, 72, 153, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                      color: isSelected ? '#fff' : '#94a3b8',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {preset.label} ({Math.round(preset.value * 100)}%)
                  </button>
                );
              })}
            </div>
          </div>

          {/* Opcje synchronizacji z odtwarzaniem */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#e2e8f0' }}>
                Wyciszaj szum przy wstrzymaniu (Auto-Sync)
              </span>
              <p style={{ margin: '2px 0 0', fontSize: '0.74rem', color: '#94a3b8' }}>
                Szum analogowy brzmi tylko wtedy, gdy muzyka jest aktywnie odtwarzana
              </p>
            </div>

            <input
              type="checkbox"
              checked={config.autoSync}
              onChange={(e) => vinylSimulator.setAutoSync(e.target.checked)}
              style={{
                width: '18px',
                height: '18px',
                accentColor: 'var(--accent-purple)',
                cursor: 'pointer',
              }}
            />
          </div>

          {/* Belka diagnostyczna & Podgląd na żywo */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Radio size={14} color={isActuallyAudible ? '#22c55e' : '#94a3b8'} />
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Status generatora audio:{' '}
                <strong style={{ color: isActuallyAudible ? '#22c55e' : '#cbd5e1' }}>
                  {isActuallyAudible ? 'Emisja szumu aktywna (Audible)' : 'Wyciszony (Muted / Standby)'}
                </strong>
              </span>
            </div>

            <button
              onClick={handleTogglePreview}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                background: previewActive ? 'var(--accent-pink)' : 'rgba(255, 255, 255, 0.06)',
                color: '#fff',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {previewActive ? 'Zatrzymaj odsłuch' : 'Przetestuj brzmienie'}
            </button>
          </div>

        </div>

        {/* Stopka okna */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'rgba(0, 0, 0, 0.25)',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 24px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(168, 85, 247, 0.35)',
            }}
          >
            Zatwierdź i zamknij
          </button>
        </div>

      </div>
    </div>
  );
};
