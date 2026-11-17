import en from './locales/en.json';
import pl from './locales/pl.json';
import de from './locales/de.json';
import fi from './locales/fi.json';
import la from './locales/la.json';

export type Language = 'en' | 'pl' | 'de' | 'fi' | 'la';

export type Translations = typeof en;

export const translations: Record<Language, Translations> = {
  en,
  pl,
  de,
  fi,
  la,
};

export const supportedLanguages: { code: Language; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'pl', label: 'Polski', flag: '🇵🇱' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'fi', label: 'Suomi', flag: '🇫🇮' },
  { code: 'la', label: 'Latina', flag: '🏛️' },
];

export function getTranslations(lang: Language): Translations {
  return translations[lang] || translations.en;
}
