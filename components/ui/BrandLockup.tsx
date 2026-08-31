/**
 * Brand lockup (§2.1) — the mark + `talvori` wordmark, with the tagline on brand
 * surfaces only (splash, login, onboarding). Never inside app chrome.
 *
 * The wordmark is lowercase `talvori` in the 800 face (via the `title` variant's
 * font) with tight tracking; the tagline is uppercase, wide-tracked, in `primary`
 * (or white on a dark ground). Sizes come from the spec: 34px mark for headers,
 * 52px for the login lockup, 78px for marketing.
 */

import { Image, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@/components/theme';
import { useThemedStyles, type Palette } from '@/components/ThemeProvider';
import { Text } from '@/components/ui/Text';
import { direction } from '@/lib/rtl';

const MARK = require('@/assets/brand/talvori-mark.png');

export interface BrandLockupProps {
  /** Mark height in px; the wordmark scales with it. */
  markSize?: number;
  showTagline?: boolean;
  /** `dark` = white wordmark for a navy brand ground (splash). */
  tone?: 'light' | 'dark';
  /** Stack the mark above the wordmark and centre everything (splash §6.1). */
  stacked?: boolean;
}

export function BrandLockup({
  markSize = 34,
  showTagline = false,
  tone = 'light',
  stacked = false,
}: BrandLockupProps) {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const wordSize = Math.round(markSize * 0.85);
  const tagSize = Math.max(9, Math.round(markSize * 0.2));

  return (
    <View style={[styles.wrap, stacked ? styles.wrapStacked : null]}>
      <View style={[styles.lockup, stacked ? styles.lockupStacked : null]}>
        <Image
          source={MARK}
          style={{ width: markSize, height: markSize }}
          accessibilityIgnoresInvertColors
          accessibilityLabel={t('brand.wordmark')}
        />
        <Text
          variant="title"
          style={[
            styles.wordmark,
            { fontSize: wordSize, color: tone === 'dark' ? styles.onDark.color : styles.onLight.color },
          ]}
        >
          {t('brand.wordmark')}
        </Text>
      </View>
      {showTagline ? (
        <Text style={[styles.tagline, { fontSize: tagSize, letterSpacing: tagSize * 0.18 }]}>
          {t('brand.tagline').toUpperCase()}
        </Text>
      ) : null}
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  wrap: { gap: spacing.xs },
  wrapStacked: { alignItems: 'center', gap: spacing.md },
  lockup: { flexDirection: direction.flexRow, alignItems: 'center', gap: spacing.sm },
  lockupStacked: { flexDirection: 'column', gap: spacing.sm },
  // −0.02em tracking on the wordmark (§2.1); tone chosen inline above.
  wordmark: { letterSpacing: -0.4 },
  onLight: { color: c.ink },
  onDark: { color: c.white },
  tagline: { color: c.primary, fontWeight: '700' },
});
