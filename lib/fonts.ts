/**
 * Typography faces for the "Modernist" system.
 *   - All Latin roles: Archivo (geometric grotesque; 400 body, 800 for every
 *     heading/label/button — the system leans hard on the ExtraBold weight).
 *   - Arabic (all roles): Readex Pro (harmonizes with the grotesque Latin, full
 *     Arabic coverage — Archivo has none) — RN selects weight by FAMILY name,
 *     not fontWeight, so each weight is its own family.
 *
 * `fontMap` is passed to expo-font's useFonts(); `fontFamilyFor` picks the family
 * for a typography variant, switching to the Arabic face when the UI is in Arabic.
 */

import { Archivo_400Regular, Archivo_800ExtraBold } from '@expo-google-fonts/archivo';
import {
  ReadexPro_400Regular,
  ReadexPro_600SemiBold,
  ReadexPro_700Bold,
} from '@expo-google-fonts/readex-pro';

import type { TypographyVariant } from '@/components/theme';

export const fontMap = {
  Archivo_400Regular,
  Archivo_800ExtraBold,
  ReadexPro_400Regular,
  ReadexPro_600SemiBold,
  ReadexPro_700Bold,
} as const;

/** Family name for a variant, using the Arabic face when the UI is Arabic. */
export function fontFamilyFor(variant: TypographyVariant, isArabic: boolean): string {
  if (isArabic) {
    switch (variant) {
      case 'title':
        return 'ReadexPro_700Bold';
      case 'heading':
      case 'button':
      case 'eyebrow':
        return 'ReadexPro_600SemiBold';
      // Readex Pro has no ExtraBold; headings cap at 700, body/caption at regular.
      default:
        return 'ReadexPro_400Regular';
    }
  }
  switch (variant) {
    case 'title':
    case 'heading':
    case 'button':
    case 'eyebrow':
      return 'Archivo_800ExtraBold';
    // Modernist body and captions are the single regular weight.
    default:
      return 'Archivo_400Regular';
  }
}

/** True when a language tag is Arabic (drives the Arabic face + RTL). */
export function isArabicLanguage(language: string | undefined): boolean {
  return (language ?? '').toLowerCase().startsWith('ar');
}
