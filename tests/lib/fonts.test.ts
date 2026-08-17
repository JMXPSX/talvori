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
  it('uses Archivo ExtraBold for the display, heading, button and eyebrow roles', () => {
    expect(fontFamilyFor('title', false)).toBe('Archivo_800ExtraBold');
    expect(fontFamilyFor('heading', false)).toBe('Archivo_800ExtraBold');
    expect(fontFamilyFor('button', false)).toBe('Archivo_800ExtraBold');
    expect(fontFamilyFor('eyebrow', false)).toBe('Archivo_800ExtraBold');
  });
  it('uses Archivo Regular for body and caption', () => {
    expect(fontFamilyFor('body', false)).toBe('Archivo_400Regular');
    expect(fontFamilyFor('caption', false)).toBe('Archivo_400Regular');
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
