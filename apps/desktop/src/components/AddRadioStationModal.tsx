import React, { useState } from 'react';
import { Radio, X, Check, Link, Tag } from 'lucide-react';
import type { Language } from '../i18n';
import { getTranslations } from '../i18n';

interface AddRadioStationModalProps {
  isOpen: boolean;
  currentLang?: Language;
  onClose: () => void;
  onSave: (station: { name: string; url: string; genre: string }) => void;
}

export const AddRadioStationModal: React.FC<AddRadioStationModalProps> = ({
  isOpen,
  currentLang = 'pl',
  onClose,
  onSave,
}) => {
  const [name, setName] = useState<string>('');
  const [url, setUrl] = useState<string>('');
  const [genre, setGenre] = useState<string>('Anime / J-Pop');

  if (!isOpen) return null;

  const loc = getTranslations(currentLang);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    if (!trimmedName || !trimmedUrl) return;

    onSave({
      name: trimmedName,
      url: trimmedUrl,
      genre: genre.trim() || 'Internet Radio',
    });
    setName('');
    setUrl('');
    setGenre('Anime / J-Pop');
    onClose();
  };

  const isValidUrl = url.trim().startsWith('http://') || url.trim().startsWith('https://');

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
          width: '460px',
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(6, 182, 212, 0.3)',
            }}
          >
            <Radio size={22} color="#fff" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>
              {loc.radio.addCustomStation}
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Icecast / Shoutcast / Direct Audio Stream URL
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Nazwa stacji:
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="np. Touhou Memories Radio"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid var(--border-subtle)',
                color: '#fff',
                fontSize: '0.9rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              URL strumienia (audio stream):
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="url"
                required
                placeholder="https://stream.server.org:8000/live.mp3"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  fontSize: '0.88rem',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <Link
                size={16}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
              />
            </div>
            {url && !isValidUrl && (
              <span style={{ fontSize: '0.74rem', color: '#ff6b81', marginTop: '4px', display: 'block' }}>
                Adres musi zaczynać się od http:// lub https://
              </span>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Gatunek / Etykieta:
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="np. Anime, J-Rock, Vocaloid, Chiptune"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  fontSize: '0.88rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <Tag
                size={16}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
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
              disabled={!name.trim() || !isValidUrl}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 20px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.86rem',
                cursor: !name.trim() || !isValidUrl ? 'not-allowed' : 'pointer',
                opacity: !name.trim() || !isValidUrl ? 0.5 : 1,
                boxShadow: '0 4px 16px rgba(6, 182, 212, 0.3)',
              }}
            >
              <Check size={16} />
              Dodaj stację
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
