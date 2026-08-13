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
  it('uses Space Grotesk for display roles', () => {
    expect(fontFamilyFor('title', false)).toBe('SpaceGrotesk_700Bold');
    expect(fontFamilyFor('heading', false)).toBe('SpaceGrotesk_600SemiBold');
    expect(fontFamilyFor('button', false)).toBe('SpaceGrotesk_600SemiBold');
  });
  it('uses Inter for body and eyebrow', () => {
    expect(fontFamilyFor('body', false)).toBe('Inter_400Regular');
    expect(fontFamilyFor('caption', false)).toBe('Inter_400Regular');
    expect(fontFamilyFor('eyebrow', false)).toBe('Inter_600SemiBold');
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
