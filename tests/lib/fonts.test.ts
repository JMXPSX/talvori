import { fontFamilyFor, isArabicLanguage } from '@/lib/fonts';

describe('isArabicLanguage', () => {
  it('detects Arabic tags', () => {
    expect(isArabicLanguage('ar')).toBe(true);
    expect(isArabicLanguage('ar-SA')).toBe(true);
    expect(isArabicLanguage('AR')).toBe(true);
  });
  it('is false for other languages and undefined', () => {
    expect(isArabicLanguage('en')).toBe(false);
    expect(isArabicLanguage('fil')).toBe(false);
    expect(isArabicLanguage(undefined)).toBe(false);
  });
});

describe('fontFamilyFor (Latin)', () => {
  it('uses Plus Jakarta Sans bold for the display role', () => {
    expect(fontFamilyFor('title', false)).toBe('PlusJakartaSans_700Bold');
  });
  it('uses semibold for heading, button and eyebrow', () => {
    expect(fontFamilyFor('heading', false)).toBe('PlusJakartaSans_600SemiBold');
    expect(fontFamilyFor('button', false)).toBe('PlusJakartaSans_600SemiBold');
    expect(fontFamilyFor('eyebrow', false)).toBe('PlusJakartaSans_600SemiBold');
  });
  it('uses regular for body and medium for caption', () => {
    expect(fontFamilyFor('body', false)).toBe('PlusJakartaSans_400Regular');
    expect(fontFamilyFor('caption', false)).toBe('PlusJakartaSans_500Medium');
  });
});

describe('fontFamilyFor (Arabic)', () => {
  it('uses Readex Pro for every role', () => {
    expect(fontFamilyFor('title', true)).toBe('ReadexPro_700Bold');
    expect(fontFamilyFor('heading', true)).toBe('ReadexPro_600SemiBold');
    expect(fontFamilyFor('eyebrow', true)).toBe('ReadexPro_600SemiBold');
    expect(fontFamilyFor('body', true)).toBe('ReadexPro_400Regular');
    expect(fontFamilyFor('caption', true)).toBe('ReadexPro_400Regular');
  });
});
