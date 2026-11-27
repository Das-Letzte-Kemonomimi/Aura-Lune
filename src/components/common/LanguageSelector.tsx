import React, { useRef, useState } from 'react';
import { Globe, ChevronDown } from '../ui/icons';
import { type Language, supportedLanguages, getTranslations, hasLoadedLocale, loadLocale } from '../../i18n';
import { cn } from '../../utils/cn';
import { Button, MenuItem, Popover } from '../ui';

interface LanguageSelectorProps {
  currentLang: Language;
  onLanguageChange: (lang: Language) => void;
  className?: string;
  /** `toolbar`: quiet button that sits inside a header tool group. */
  variant?: 'default' | 'toolbar';
}

/** Flag button that opens a menu of the supported UI languages. */
export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  currentLang,
  onLanguageChange,
  className,
  variant = 'default',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const pendingLangRef = useRef<Language | null>(null);
  const loc = getTranslations(currentLang);
  const close = () => setIsOpen(false);

  const handleSelectLanguage = (lang: Language) => {
    close();
    if (hasLoadedLocale(lang)) {
      pendingLangRef.current = null;
      onLanguageChange(lang);
      return;
    }
    pendingLangRef.current = lang;
    void loadLocale(lang).then(() => {
      if (pendingLangRef.current === lang) {
        pendingLangRef.current = null;
        onLanguageChange(lang);
      }
    });
  };

  const activeOption =
    supportedLanguages.find((l) => l.code === currentLang) || supportedLanguages[0];
  const title = `${loc.settings.language}: ${activeOption.label} (${activeOption.code})`;

  return (
    <div className={cn('inline-flex', className)}>
      <Popover
        open={isOpen}
        onClose={close}
        align="end"
        label={loc.settings.language}
        className="min-w-37.5"
        trigger={
          <Button
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
            aria-haspopup="menu"
            aria-label={title}
            title={title}
            variant={variant === 'toolbar' ? 'ghost' : 'secondary'}
            className={variant === 'toolbar' ? 'h-8 gap-1.5 rounded-xl px-2.5 text-fg-secondary hover:bg-white/8 hover:text-fg' : 'px-2.5 py-1.5'}
          >
            <Globe size={14} className="text-accent-cyan" />
            <span className="text-base leading-none">{activeOption.flag}</span>
            <ChevronDown size={12} className="opacity-60" />
          </Button>
        }
      >
        {supportedLanguages.map((lang) => (
          <MenuItem
            key={lang.code}
            selected={lang.code === currentLang}
            icon={<span aria-hidden="true">{lang.flag}</span>}
            onClick={() => handleSelectLanguage(lang.code)}
          >
            {lang.label}
          </MenuItem>
        ))}
      </Popover>
    </div>
  );
};
