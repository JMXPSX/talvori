/**
 * Typography faces for the "Ledger & Remittance" system.
 *   - Display / headings / buttons: Space Grotesk (geometric, strong figures)
 *   - Body / caption: Inter (legible at small sizes)
 *   - Arabic (all roles): Readex Pro (harmonizes with the geometric Latin, full
 *     Arabic coverage) — RN selects weight by FAMILY name, not fontWeight, so
 *     each weight is its own family.
 *
 * `fontMap` is passed to expo-font's useFonts(); `fontFamilyFor` picks the family
 * for a typography variant, switching to the Arabic face when the UI is in Arabic.
 */

import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import {
  ReadexPro_400Regular,
  ReadexPro_600SemiBold,
  ReadexPro_700Bold,
} from '@expo-google-fonts/readex-pro';
import {
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';

import type { TypographyVariant } from '@/components/theme';

export const fontMap = {
  Inter_400Regular,
  Inter_600SemiBold,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
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
      default:
        return 'ReadexPro_400Regular';
    }
  }
  switch (variant) {
    case 'title':
      return 'SpaceGrotesk_700Bold';
    case 'heading':
    case 'button':
      return 'SpaceGrotesk_600SemiBold';
    case 'eyebrow':
      return 'Inter_600SemiBold';
    default:
      return 'Inter_400Regular';
  }
}

/** True when a language tag is Arabic (drives the Arabic face + RTL). */
export function isArabicLanguage(language: string | undefined): boolean {
  return (language ?? '').toLowerCase().startsWith('ar');
}
