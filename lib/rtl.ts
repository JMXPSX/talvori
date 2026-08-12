/**
 * RTL foundation (see 05_GLOBALIZATION_MARKETS_OFW_SPEC.md + 09 §H).
 *
 * Arabic ships from Day 1, so layout direction must be a first-class concept,
 * not a retrofit. Rules for the whole codebase:
 *   - Never assume left-to-right. Use logical style props (marginStart /
 *     marginEnd / textAlign: 'left' resolves per-direction on RN) instead of
 *     hard left/right where direction matters.
 *   - Read the active direction from `isRTLLanguage()` / `I18nManager`, never
 *     from a per-screen boolean.
 */

import { I18nManager } from 'react-native';

/** Language codes that render right-to-left. Extend as markets are added. */
const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur']);

export function isRTLLanguage(languageCode: string): boolean {
  return RTL_LANGUAGES.has(languageCode.split('-')[0]?.toLowerCase() ?? '');
}

/** Current layout direction as reported by the RN layout manager. */
export function isRTL(): boolean {
  return I18nManager.isRTL;
}

/**
 * Align the native layout manager with the active language. Returns true if the
 * direction changed — on native a change requires an app reload to fully apply,
 * which the caller can prompt for. On web the DOM `dir` follows automatically.
 */
export function applyDirectionForLanguage(languageCode: string): boolean {
  const shouldBeRTL = isRTLLanguage(languageCode);
  if (I18nManager.isRTL === shouldBeRTL) return false;

  I18nManager.allowRTL(shouldBeRTL);
  I18nManager.forceRTL(shouldBeRTL);
  return true;
}

/** Direction-aware start/end aliases for building styles. */
export const direction = {
  get textAlign(): 'left' | 'right' {
    return I18nManager.isRTL ? 'right' : 'left';
  },
  get flexRow(): 'row' | 'row-reverse' {
    return I18nManager.isRTL ? 'row-reverse' : 'row';
  },
} as const;
