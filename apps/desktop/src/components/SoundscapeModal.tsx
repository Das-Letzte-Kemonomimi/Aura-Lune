import React, { useState, useEffect } from 'react';
import {
  Waves,
  CloudRain,
  Disc,
  Flame,
  Wind,
  Coffee,
  Volume2,
  VolumeX,
  X,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import type { Language } from '../i18n';
import {
  soundscapeEngine,
  SOUNDSCAPE_PRESETS,
  type SoundscapeVolumes,
  type SoundscapePreset,
} from '../utils/soundscapeAudio';

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

  // Obsługa zamykania klawiszem Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isPl = currentLang === 'pl';

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
      label: isPl ? 'Cichy Deszcz' : 'Gentle Rain',
      sublabel: isPl ? 'Krople wody i szum deszczu' : 'Droplets & atmospheric rain',
      icon: <CloudRain size={18} />,
      color: '#38bdf8',
      bgAccent: 'rgba(56, 189, 248, 0.15)',
    },
    {
      key: 'vinyl',
      label: isPl ? 'Winyl & Kurz Igły' : 'Vinyl & Dust Crackle',
      sublabel: isPl ? 'Trzask płyty gramofonowej' : 'Analog needle crackle & warmth',
      icon: <Disc size={18} />,
      color: '#f59e0b',
      bgAccent: 'rgba(245, 158, 11, 0.15)',
    },
    {
      key: 'campfire',
      label: isPl ? 'Ognisko & Iskry' : 'Campfire & Embers',
      sublabel: isPl ? 'Trzaskające drewno i ciepły bas' : 'Crackling wood and warm bass',
      icon: <Flame size={18} />,
      color: '#f43f5e',
      bgAccent: 'rgba(244, 63, 94, 0.15)',
    },
    {
      key: 'wind_chimes',
      label: isPl ? 'Wiatr & Dzwonki Wietrzne' : 'Wind & Japanese Chimes',
      sublabel: isPl ? 'Japońskie dzwonki Furin w skali Insen' : 'Furin chimes in Japanese pentatonic scale',
      icon: <Wind size={18} />,
      color: '#ec4899',
      bgAccent: 'rgba(236, 72, 153, 0.15)',
    },
    {
      key: 'cafe_brown',
      label: isPl ? 'Kawiarnia / Szum Brązowy' : 'Warm Cafe / Brown Noise',
      sublabel: isPl ? 'Głęboki, kojący szum do nauki' : 'Deep brown noise for focus & relaxation',
      icon: <Coffee size={18} />,
      color: '#a855f7',
      bgAccent: 'rgba(168, 85, 247, 0.15)',
    },
  ];

  const isAnyActive = soundscapeEngine.isSoundscapeActive();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(5, 7, 18, 0.82)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '580px',
          background: 'linear-gradient(145deg, rgba(20, 24, 45, 0.96), rgba(12, 14, 28, 0.98))',
          border: '1px solid rgba(168, 85, 247, 0.35)',
          borderRadius: '24px',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.9), 0 0 32px rgba(168, 85, 247, 0.25)',
          color: '#fff',
          padding: '28px',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Zamknięcie */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)')}
          title={isPl ? 'Zamknij (Esc)' : 'Close (Esc)'}
        >
          <X size={18} />
        </button>

        {/* Nagłówek */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.4), rgba(236, 72, 153, 0.3))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f472b6',
              boxShadow: '0 0 16px rgba(236, 72, 153, 0.35)',
            }}
          >
            <Waves size={24} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
              {isPl ? 'Generator Dźwięków Tła' : 'Lofi Soundscape Mixer'}
            </h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #a1a1aa)', marginTop: '2px' }}>
              {isPl
                ? 'Relaksujące, proceduralne tło audio miksowane z muzyką'
                : 'Procedural ambient audio layers seamlessly blended with your music'}
            </div>
          </div>
        </div>

        {/* Główna głośność i stan Master */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={handleToggleMute}
                style={{
                  background: isMuted ? 'rgba(239, 68, 68, 0.25)' : 'rgba(168, 85, 247, 0.22)',
                  border: isMuted ? '1px solid #ef4444' : '1px solid #a855f7',
                  borderRadius: '10px',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isMuted ? '#f87171' : '#c084fc',
                  cursor: 'pointer',
                }}
                title={isMuted ? (isPl ? 'Włącz dźwięk' : 'Unmute') : (isPl ? 'Wycisz' : 'Mute')}
              >
                {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <div>
                <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                  {isPl ? 'Głośność główna (Master)' : 'Master Soundscape Volume'}
                </span>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  {isMuted
                    ? (isPl ? 'Wyciszono' : 'Muted')
                    : isAnyActive
                    ? (isPl ? 'Aktywny szum tła' : 'Soundscape active')
                    : (isPl ? 'Wszystkie kanały wyciszone' : 'All channels silent')}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, minWidth: '40px', textAlign: 'right' }}>
                {isMuted ? '0%' : `${Math.round(volumes.master * 100)}%`}
              </span>
              <button
                onClick={handleResetAll}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  color: '#94a3b8',
                  fontSize: '0.78rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                }}
                title={isPl ? 'Wyzeruj wszystkie suwaki' : 'Reset all sliders to zero'}
              >
                <RotateCcw size={12} />
                <span>{isPl ? 'Zeruj' : 'Reset'}</span>
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
            style={{
              width: '100%',
              accentColor: '#c084fc',
              cursor: 'pointer',
              height: '6px',
            }}
          />
        </div>

        {/* Gotowe presety */}
        <div>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>
            {isPl ? 'Szybkie presety nastroju:' : 'Quick Mood Presets:'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {SOUNDSCAPE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleApplyPreset(preset)}
                style={{
                  padding: '7px 12px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#e2e8f0',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(168, 85, 247, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                }}
              >
                <span>{preset.icon}</span>
                <span>{isPl ? preset.name.pl : preset.name.en}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Lista kanałów ambientowych */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#94a3b8' }}>
            {isPl ? 'Pojedyncze kanały otoczenia:' : 'Individual Ambient Layers:'}
          </div>

          {channels.map((chan) => {
            const vol = volumes[chan.key];
            const isActive = vol > 0.01 && !isMuted;

            return (
              <div
                key={chan.key}
                style={{
                  background: isActive ? chan.bgAccent : 'rgba(255, 255, 255, 0.03)',
                  border: isActive ? `1px solid ${chan.color}60` : '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '14px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        color: chan.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '30px',
                        height: '30px',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.06)',
                      }}
                    >
                      {chan.icon}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: isActive ? '#fff' : '#cbd5e1' }}>
                        {chan.label}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                        {chan.sublabel}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        color: isActive ? chan.color : '#64748b',
                        minWidth: '38px',
                        textAlign: 'right',
                      }}
                    >
                      {Math.round(vol * 100)}%
                    </span>
                    <button
                      onClick={() => handleChannelChange(chan.key, vol > 0 ? 0 : 0.6)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '6px',
                        padding: '3px 8px',
                        fontSize: '0.72rem',
                        color: '#94a3b8',
                        cursor: 'pointer',
                      }}
                    >
                      {vol > 0 ? (isPl ? 'Wycisz' : 'Off') : (isPl ? 'Włącz' : 'On')}
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
                  style={{
                    width: '100%',
                    accentColor: chan.color,
                    cursor: 'pointer',
                    height: '5px',
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Opcja synchronizacji z cząsteczkami anime */}
        <div
          onClick={handleAutoSyncToggle}
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={16} color="#f472b6" />
            <div>
              <div style={{ fontSize: '0.84rem', fontWeight: 600 }}>
                {isPl
                  ? 'Auto-synchronizacja z efektami cząsteczkowymi (Ambience FX)'
                  : 'Auto-sync with visual particle effects (Ambience FX)'}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                {isPl
                  ? 'Wybór Sakury włącza dzwonki, Neon Rain włącza deszcz, a Iskry ognisko'
                  : 'Sakura triggers wind chimes, Neon Rain triggers rain, Embers triggers campfire'}
              </div>
            </div>
          </div>
          <div
            style={{
              width: '38px',
              height: '20px',
              borderRadius: '20px',
              background: autoSync ? '#c084fc' : 'rgba(255, 255, 255, 0.15)',
              position: 'relative',
              transition: 'background 0.2s',
            }}
          >
            <div
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                background: '#fff',
                position: 'absolute',
                top: '2px',
                left: autoSync ? '20px' : '2px',
                transition: 'left 0.2s',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
