/**
 * Desktop sidebar navigation (the wide-layout counterpart to the bottom tab
 * bar). Presentational only — the caller maps routes into grouped `sections`, so
 * this component has no dependency on the navigator and stays easy to test.
 *
 * Shape follows the Talvori desktop mock: wordmark, grouped nav sections
 * (Plan & Spend / Money & Household / App & Account) where the active row is a
 * brand label on a tinted pill, and a user card pinned to the bottom.
 */

import { Feather } from '@expo/vector-icons';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { radius, spacing } from '@/components/theme';
import { useTheme, useThemedStyles, type Palette } from '@/components/ThemeProvider';
import { Avatar } from '@/components/ui/Avatar';
import { Text } from '@/components/ui/Text';

const MARK = require('@/assets/brand/talvori-mark.png');

export interface SideNavItem {
  key: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  active: boolean;
  onPress: () => void;
  /** Optional count pill (e.g. Shop basket). */
  badge?: number;
}

export interface SideNavSection {
  /** Uppercase group label; omitted for an ungrouped block. */
  title?: string;
  items: SideNavItem[];
}

export interface SideNavFooter {
  name: string;
  meta?: string;
  onPress: () => void;
}

export interface SideNavProps {
  brand: string;
  sections: SideNavSection[];
  footer?: SideNavFooter;
}

export const SIDEBAR_WIDTH = 260;

export function SideNav({ brand, sections, footer }: SideNavProps) {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.sidebar}>
      <View style={styles.brandRow}>
        <Image source={MARK} style={styles.brandMark} accessibilityIgnoresInvertColors />
        <Text variant="heading" style={styles.brand}>
          {brand}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {sections.map((section, i) => (
          <View key={section.title ?? `section-${i}`} style={styles.section}>
            {section.title ? (
              <Text variant="eyebrow" muted style={styles.sectionTitle}>
                {section.title}
              </Text>
            ) : null}
            {section.items.map((item) => (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityState={{ selected: item.active }}
                onPress={item.onPress}
                style={({ pressed }) => [
                  styles.item,
                  item.active ? styles.itemActive : null,
                  pressed && !item.active ? styles.itemPressed : null,
                ]}
              >
                <Feather
                  name={item.icon}
                  size={19}
                  color={item.active ? palette.brand : palette.textMuted}
                />
                <Text
                  variant="button"
                  style={item.active ? styles.labelActive : styles.label}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
                {item.badge ? (
                  <View style={styles.badge}>
                    <Text variant="caption" style={styles.badgeText}>
                      {item.badge}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>

      {footer ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={footer.name}
          onPress={footer.onPress}
          style={({ pressed }) => [styles.footer, pressed ? styles.itemPressed : null]}
        >
          <Avatar name={footer.name} size={36} variant="self" />
          <View style={styles.footerText}>
            <Text variant="button" numberOfLines={1}>
              {footer.name}
            </Text>
            {footer.meta ? (
              <Text variant="caption" muted numberOfLines={1}>
                {footer.meta}
              </Text>
            ) : null}
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: c.surfaceMuted,
    borderRightWidth: 1,
    borderRightColor: c.border,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  brandMark: { width: 28, height: 28 },
  brand: { color: c.brand },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  section: { gap: spacing.xs },
  sectionTitle: { paddingHorizontal: spacing.sm, marginBottom: 2 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.control,
  },
  itemActive: { backgroundColor: c.brandMuted },
  itemPressed: { backgroundColor: c.field },
  label: { color: c.textMuted, flex: 1 },
  labelActive: { color: c.brand, flex: 1 },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    backgroundColor: c.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: c.white },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    margin: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  footerText: { flex: 1, gap: 2 },
});
