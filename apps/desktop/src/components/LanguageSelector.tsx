import React, { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { type Language, supportedLanguages } from '../i18n';

interface LanguageSelectorProps {
  currentLang: Language;
  onLanguageChange: (lang: Language) => void;
  style?: React.CSSProperties;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  currentLang,
  onLanguageChange,
  style,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const activeOption =
    supportedLanguages.find((l) => l.code === currentLang) || supportedLanguages[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'inline-block',
        ...style,
      }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="glass-card"
        style={{
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          fontSize: '0.8rem',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          background: 'rgba(255, 255, 255, 0.04)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        title="Wybierz język interfejsu (Language / Język / Sprache / Kieli / Lingua)"
      >
        <Globe size={14} color="var(--accent-cyan)" />
        <span>
          {activeOption.flag} {activeOption.label}
        </span>
        <ChevronDown size={13} style={{ opacity: 0.6 }} />
      </button>

      {isOpen && (
        <div
          className="glass-panel"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 1000,
            background: 'rgba(15, 20, 32, 0.96)',
            borderRadius: '12px',
            border: '1px solid var(--border-accent)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6)',
            padding: '6px',
            minWidth: '150px',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          {supportedLanguages.map((lang) => {
            const isSelected = lang.code === currentLang;
            return (
              <button
                key={lang.code}
                onClick={() => {
                  onLanguageChange(lang.code);
                  setIsOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: isSelected ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                  color: isSelected ? 'var(--accent-cyan)' : '#fff',
                  fontSize: '0.82rem',
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{lang.flag}</span>
                  <span>{lang.label}</span>
                </div>
                {isSelected && <Check size={14} color="var(--accent-cyan)" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
