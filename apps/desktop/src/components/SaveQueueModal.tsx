import React, { useState } from 'react';
import { BookmarkPlus, X, Check, ListMusic } from 'lucide-react';
import type { Language } from '../i18n';
import { getTranslations } from '../i18n';

interface SaveQueueModalProps {
  isOpen: boolean;
  currentLang?: Language;
  queueLength: number;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}

export const SaveQueueModal: React.FC<SaveQueueModalProps> = ({
  isOpen,
  currentLang = 'pl',
  queueLength,
  onClose,
  onSave,
}) => {
  const [playlistName, setPlaylistName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const loc = getTranslations(currentLang);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = playlistName.trim();
    if (!trimmed || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onSave(trimmed);
      setPlaylistName('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{
          width: '420px',
          maxWidth: '92vw',
          padding: '24px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(25, 20, 40, 0.95) 0%, rgba(15, 10, 25, 0.98) 100%)',
          border: '1px solid var(--border-accent)',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.65)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(236, 72, 153, 0.3)',
            }}
          >
            <BookmarkPlus size={22} color="#fff" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>
              {loc.queue.saveAsPlaylistTitle}
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {queueLength} {loc.library.tracks} w bieżącej kolejce
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '8px',
              }}
            >
              Nazwa nowej playlisty:
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                autoFocus
                placeholder={loc.queue.playlistNamePlaceholder}
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px 10px 38px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  fontSize: '0.9rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <ListMusic
                size={16}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              className="glass-card"
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontSize: '0.86rem',
                cursor: 'pointer',
              }}
            >
              {loc.common.cancel}
            </button>
            <button
              type="submit"
              disabled={!playlistName.trim() || isSubmitting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 20px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.86rem',
                cursor: !playlistName.trim() || isSubmitting ? 'not-allowed' : 'pointer',
                opacity: !playlistName.trim() || isSubmitting ? 0.6 : 1,
                boxShadow: '0 4px 16px rgba(236, 72, 153, 0.3)',
              }}
            >
              <Check size={16} />
              {loc.common.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
