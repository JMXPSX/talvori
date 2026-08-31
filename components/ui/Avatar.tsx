/**
 * Avatar (§3.13) — a circle showing the profile photo when present, else the
 * person's initials (max 2, uppercase) on `primaryTint` with `primary` text.
 *
 * The signed-in user's own avatar in headers uses the filled treatment
 * (`variant="self"` → `primary` fill + white initials). One photo per user drives
 * every surface (headers, rosters, grocery "added by"), so pass the same
 * `photoUrl` everywhere and initials appear identically when it's absent.
 */

import { Image, StyleSheet, View } from 'react-native';

import { radius } from '@/components/theme';
import { useThemedStyles, type Palette } from '@/components/ThemeProvider';
import { Text } from '@/components/ui/Text';

export interface AvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: number;
  /** `self` = the filled treatment for the signed-in user's header avatar. */
  variant?: 'default' | 'self';
}

/** First letters of up to the first two words, uppercased. "Jo Cruz" → "JC". */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const letters = parts.slice(0, 2).map((p) => p[0]);
  return letters.join('').toUpperCase();
}

export function Avatar({ name, photoUrl, size = 40, variant = 'default' }: AvatarProps) {
  const styles = useThemedStyles(makeStyles);
  const dim = { width: size, height: size, borderRadius: radius.pill } as const;

  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={[dim, styles.photo]}
        accessibilityIgnoresInvertColors
        accessibilityLabel={name}
      />
    );
  }
  const self = variant === 'self';
  // Scale the glyph to the circle so initials stay centred at any size.
  const fontSize = Math.round(size * 0.4);
  return (
    <View
      accessibilityLabel={name}
      style={[dim, styles.fallback, self ? styles.fallbackSelf : styles.fallbackDefault]}
    >
      <Text style={[styles.initials, self ? styles.initialsSelf : styles.initialsDefault, { fontSize }]}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  photo: { backgroundColor: c.fill },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  fallbackDefault: { backgroundColor: c.primaryTint },
  fallbackSelf: { backgroundColor: c.primary },
  initials: { fontWeight: '700' },
  initialsDefault: { color: c.primary },
  initialsSelf: { color: c.white },
});
