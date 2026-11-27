import en from './locales/en.json';

export type Language = 'en' | 'pl' | 'de' | 'fi' | 'la';

export type Translations = typeof en;

const localeCache: Partial<Record<Language, Translations>> = { en };
const pendingLocaleLoads: Partial<Record<Language, Promise<Translations>>> = {};

export const supportedLanguages: { code: Language; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'pl', label: 'Polski', flag: '🇵🇱' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'fi', label: 'Suomi', flag: '🇫🇮' },
  { code: 'la', label: 'Latina', flag: '🏛️' },
];

export function isSupportedLanguage(lang: string | null | undefined): lang is Language {
  return lang === 'en' || lang === 'pl' || lang === 'de' || lang === 'fi' || lang === 'la';
}

export function hasLoadedLocale(lang: Language): boolean {
  return Boolean(localeCache[lang]);
}

async function importLocaleModule(lang: Exclude<Language, 'en'>): Promise<{ default?: Translations } & Translations> {
  switch (lang) {
    case 'pl':
      return import('./locales/pl.json');
    case 'de':
      return import('./locales/de.json');
    case 'fi':
      return import('./locales/fi.json');
    case 'la':
      return import('./locales/la.json');
  }
}

/** Lazily loads and caches a non-English locale dictionary, falling back to `en`. */
export async function loadLocale(lang: Language): Promise<Translations> {
  const cached = localeCache[lang];
  if (cached) return cached;

  if (!isSupportedLanguage(lang) || lang === 'en') {
    return en;
  }

  const inflight = pendingLocaleLoads[lang];
  if (inflight) return inflight;

  const promise = importLocaleModule(lang)
    .then((mod) => {
      const dict = (mod.default ?? mod) as Translations;
      localeCache[lang] = dict;
      return dict;
    })
    .catch((err) => {
      console.warn(`Failed to load locale '${lang}', falling back to 'en':`, err);
      return en;
    })
    .finally(() => {
      delete pendingLocaleLoads[lang];
    });

  pendingLocaleLoads[lang] = promise;
  return promise;
}

export function getTranslations(lang?: Language): Translations {
  return (lang && localeCache[lang]) || en;
}
