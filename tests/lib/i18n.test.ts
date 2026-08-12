/**
 * Localization + RTL foundation tests. Confirms language resolution and that
 * Arabic is recognized as right-to-left.
 */

import i18n, { changeLanguage, resolveLanguage } from '@/lib/i18n';
import { isRTLLanguage } from '@/lib/rtl';

describe('resolveLanguage', () => {
  it('maps supported languages', () => {
    expect(resolveLanguage('en-US')).toBe('en');
    expect(resolveLanguage('ar-SA')).toBe('ar');
    expect(resolveLanguage('fil-PH')).toBe('fil');
  });

  it('treats Tagalog (tl) as Filipino', () => {
    expect(resolveLanguage('tl')).toBe('fil');
  });

  it('falls back to English for unsupported languages', () => {
    expect(resolveLanguage('de-DE')).toBe('en');
    expect(resolveLanguage(null)).toBe('en');
  });
});

describe('isRTLLanguage', () => {
  it('flags Arabic as RTL and English as LTR', () => {
    expect(isRTLLanguage('ar')).toBe(true);
    expect(isRTLLanguage('ar-SA')).toBe(true);
    expect(isRTLLanguage('en')).toBe(false);
    expect(isRTLLanguage('fil')).toBe(false);
  });
});

describe('translation catalogs', () => {
  it('resolves keys across languages with no hard-coded English leak', async () => {
    await changeLanguage('en');
    expect(i18n.t('nav.home')).toBe('Home');

    await changeLanguage('ar');
    expect(i18n.t('nav.home')).toBe('الرئيسية');

    await changeLanguage('en');
  });

  it('has matching key sets across all languages', () => {
    const en = i18n.getResourceBundle('en', 'translation');
    const ar = i18n.getResourceBundle('ar', 'translation');
    const fil = i18n.getResourceBundle('fil', 'translation');

    const keysOf = (obj: Record<string, unknown>, prefix = ''): string[] =>
      Object.entries(obj).flatMap(([k, v]) =>
        v && typeof v === 'object'
          ? keysOf(v as Record<string, unknown>, `${prefix}${k}.`)
          : [`${prefix}${k}`],
      );

    const enKeys = keysOf(en).sort();
    expect(keysOf(ar).sort()).toEqual(enKeys);
    expect(keysOf(fil).sort()).toEqual(enKeys);
  });
});
