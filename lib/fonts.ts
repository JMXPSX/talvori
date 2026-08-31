/**
 * Typography faces for the "Talvori" system.
 *   - All Latin roles: Plus Jakarta Sans (geometric, friendly, strong figures)
 *   - Arabic (all roles): Readex Pro (harmonizes with the geometric Latin, full
 *     Arabic coverage — Plus Jakarta Sans has none) — RN selects weight by FAMILY
 *     name, not fontWeight, so each weight is its own family.
 *
 * `fontMap` is passed to expo-font's useFonts(); `fontFamilyFor` picks the family
 * for a typography variant, switching to the Arabic face when the UI is in Arabic.
 */

import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  ReadexPro_400Regular,
  ReadexPro_600SemiBold,
  ReadexPro_700Bold,
} from '@expo-google-fonts/readex-pro';

import type { TypographyVariant } from '@/components/theme';

export const fontMap = {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
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
      case 'subheading':
      case 'moneyMin':
      case 'button':
      case 'eyebrow':
        return 'ReadexPro_600SemiBold';
      // Readex Pro has no medium; caption falls back to regular.
      default:
        return 'ReadexPro_400Regular';
    }
  }
  switch (variant) {
    case 'title':
      // §2.3 — screen titles, the wordmark and hero numbers are 800.
      return 'PlusJakartaSans_800ExtraBold';
    case 'heading':
    case 'subheading':
    case 'moneyMin':
    case 'button':
    case 'eyebrow':
      return 'PlusJakartaSans_600SemiBold';
    case 'caption':
      return 'PlusJakartaSans_500Medium';
    default:
      return 'PlusJakartaSans_400Regular';
  }
}

/** True when a language tag is Arabic (drives the Arabic face + RTL). */
export function isArabicLanguage(language: string | undefined): boolean {
  return (language ?? '').toLowerCase().startsWith('ar');
}
