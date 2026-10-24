import React from 'react';
import { X, Keyboard } from 'lucide-react';
import { type Language, getTranslations } from '../i18n';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLang?: Language;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose, currentLang = 'en' }) => {
  if (!isOpen) return null;

  const t = getTranslations(currentLang);

  const shortcuts = [
    {
      category: t.shortcuts.catPlayback,
      items: [
        { key: 'Space', desc: t.shortcuts.playPause },
        { key: '← / →', desc: t.shortcuts.seekFwdBack },
        { key: '↑ / ↓', desc: t.shortcuts.volUpDown },
        { key: 'M', desc: t.shortcuts.muteUnmute },
        { key: 'F2 / Shift+M', desc: t.shortcuts.miniPlayer },
        { key: 'F11', desc: t.shortcuts.fullscreen },
      ],
    },
    {
      category: t.shortcuts.catNavigation,
      items: [
        { key: 'N', desc: t.shortcuts.nextTrack },
        { key: 'P', desc: t.shortcuts.prevTrack },
        { key: 'S', desc: t.shortcuts.shuffle },
        { key: 'L', desc: t.shortcuts.loop },
        { key: 'T', desc: t.shortcuts.lyrics },
      ],
    },
    {
      category: t.shortcuts.catDsp,
      items: [
        { key: '[ / ]', desc: t.shortcuts.pitchShift },
        { key: '- / +', desc: t.shortcuts.tempoShift },
        { key: '0', desc: t.shortcuts.resetDsp },
      ],
    },
    {
      category: t.shortcuts.catLoop,
      items: [
        { key: 'A', desc: t.shortcuts.loopA },
        { key: 'B', desc: t.shortcuts.loopB },
        { key: 'C', desc: t.shortcuts.loopClear },
        { key: '?', desc: t.shortcuts.toggleHelp },
      ],
    },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 15, 0.82)',
        backdropFilter: 'blur(10px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '28px',
          borderRadius: '20px',
          border: '1px solid var(--border-accent)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nagłówek */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.3), rgba(244, 63, 94, 0.3))',
                border: '1px solid var(--accent-cyan)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Keyboard size={18} color="var(--accent-cyan)" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>
                {t.shortcuts.title}
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {t.shortcuts.subtitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '6px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Lista kategorii */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {shortcuts.map((cat) => (
            <div
              key={cat.category}
              style={{
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <h4
                style={{
                  margin: 0,
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: 'var(--accent-cyan)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {cat.category}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {cat.items.map((it) => (
                  <div
                    key={it.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      fontSize: '0.78rem',
                    }}
                  >
                    <span style={{ color: 'var(--text-secondary)' }}>{it.desc}</span>
                    <kbd
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        color: 'var(--accent-pink)',
                        fontSize: '0.72rem',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {it.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
