/**
 * Splash (§6.1) — navy `ink` ground, the mark centred with the white `talvori`
 * wordmark beneath and the tagline in `primary` under that. No spinner text.
 *
 * Used as the app's branded loading gate (font load + auth init) in place of a
 * bare ActivityIndicator, so the first paint is the brand rather than a spinner.
 */

import { StyleSheet, View } from 'react-native';

import { spacing } from '@/components/theme';
import { useThemedStyles, type Palette } from '@/components/ThemeProvider';
import { BrandLockup } from '@/components/ui/BrandLockup';

export function Splash() {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.ground}>
      <BrandLockup markSize={78} showTagline tone="dark" stacked />
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  // Fixed navy brand ground in both themes — a brand surface.
  ground: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.brandNavy,
    padding: spacing.lg,
  },
});
