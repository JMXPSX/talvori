/**
 * Localization setup (see 09_PHASE_1_CLAUDE_BUILD_PROMPT.md §G).
 *
 * expo-localization detects the device locale; i18next + react-i18next resolve
 * strings. Placeholder catalogs only (en / fil / ar) — the full translation
 * effort comes later. Every UI string MUST use a key via `t('...')`; no
 * hard-coded copy anywhere in the app.
 */

import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { logger } from '@/lib/logger';
import { applyDirectionForLanguage } from '@/lib/rtl';

import ar from '@/locales/ar.json';
import en from '@/locales/en.json';
import fil from '@/locales/fil.json';

export const SUPPORTED_LANGUAGES = ['en', 'fil', 'ar'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

const resources = {
  en: { translation: en },
  fil: { translation: fil },
  ar: { translation: ar },
} as const;

/** Map a device language code to a supported catalog, falling back to English. */
export function resolveLanguage(deviceCode: string | undefined | null): SupportedLanguage {
  const base = (deviceCode ?? '').split('-')[0]?.toLowerCase();
  // Tagalog reports as 'tl'; treat it as Filipino.
  if (base === 'fil' || base === 'tl') return 'fil';
  if (base === 'ar') return 'ar';
  if (base === 'en') return 'en';
  return DEFAULT_LANGUAGE;
}

function detectInitialLanguage(): SupportedLanguage {
  try {
    const locales = getLocales();
    return resolveLanguage(locales[0]?.languageCode ?? undefined);
  } catch (err) {
    logger.warn('Locale detection failed; using default language.', {
      error: String(err),
    });
    return DEFAULT_LANGUAGE;
  }
}

const initialLanguage = detectInitialLanguage();

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: SUPPORTED_LANGUAGES,
  defaultNS: 'translation',
  interpolation: { escapeValue: false },
  returnNull: false,
});

// Align layout direction with the initial language (RTL for Arabic).
applyDirectionForLanguage(initialLanguage);

/** Change the active language at runtime and sync layout direction. */
export async function changeLanguage(language: SupportedLanguage): Promise<void> {
  await i18n.changeLanguage(language);
  applyDirectionForLanguage(language);
}

export default i18n;
