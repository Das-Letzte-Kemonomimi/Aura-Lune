import React, { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { type Language, supportedLanguages, getTranslations } from '../../i18n';
import { cn } from '../../utils/cn';

interface LanguageSelectorProps {
  currentLang: Language;
  onLanguageChange: (lang: Language) => void;
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  currentLang,
  onLanguageChange,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const loc = getTranslations(currentLang);

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
    <div ref={containerRef} className={cn('relative inline-block', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="flex items-center gap-1.5 rounded-xl border border-line bg-white/4 px-2.5 py-1.5 text-sm font-semibold text-fg-secondary"
        title={`${loc.settings.language}: ${activeOption.label} (${activeOption.code})`}
      >
        <Globe size={14} className="text-accent-cyan" />
        <span className="text-base leading-none">{activeOption.flag}</span>
        <ChevronDown size={12} className="opacity-60" />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 z-10 mt-1.5 min-w-37.5 rounded-xl border border-line-accent bg-deep/95 p-1.5 shadow-panel motion-safe:animate-fade-in">
          {supportedLanguages.map((lang) => {
            const isSelected = lang.code === currentLang;
            return (
              <button
                key={lang.code}
                type="button"
                aria-pressed={isSelected}
                onClick={() => {
                  onLanguageChange(lang.code);
                  setIsOpen(false);
                }}
                className="flex w-full items-center justify-between bg-transparent px-3 py-2 text-left text-ui font-medium text-fg aria-pressed:bg-accent-cyan/15 aria-pressed:font-bold aria-pressed:text-accent-cyan"
              >
                <div className="flex items-center gap-2">
                  <span>{lang.flag}</span>
                  <span>{lang.label}</span>
                </div>
                {isSelected && <Check size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
