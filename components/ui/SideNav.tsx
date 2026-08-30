/**
 * Desktop sidebar navigation (the wide-layout counterpart to the bottom tab
 * bar). Presentational only — the caller maps navigation state into `items`, so
 * this component has no dependency on the navigator and stays easy to test.
 *
 * Shape follows the Talvori web mock: wordmark, a household/plan header, then
 * nav rows where the active row is an indigo label on a tinted pill.
 */

import { Feather } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { palette, radius, spacing } from '@/components/theme';
import { Text } from '@/components/ui/Text';

export interface SideNavItem {
  key: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  active: boolean;
  onPress: () => void;
}

export interface SideNavProps {
  /** Wordmark shown at the top. */
  brand: string;
  /** Usually the active household name. */
  title?: string;
  /** Usually the plan tier. */
  subtitle?: string;
  items: SideNavItem[];
}

export const SIDEBAR_WIDTH = 260;

export function SideNav({ brand, title, subtitle, items }: SideNavProps) {
  return (
    <View style={styles.sidebar}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="heading" style={styles.brand}>
          {brand}
        </Text>

        {title ? (
          <View style={styles.header}>
            <Text variant="button" numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text variant="caption" style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.items}>
          {items.map((item) => (
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
                size={20}
                color={item.active ? palette.brand : palette.textMuted}
              />
              <Text
                variant="button"
                style={item.active ? styles.labelActive : styles.label}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: palette.surfaceMuted,
  },
  content: {
    padding: spacing.md,
    gap: spacing.lg,
  },
  brand: {
    color: palette.brand,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
  },
  header: {
    paddingHorizontal: spacing.sm,
    gap: 2,
  },
  subtitle: {
    color: palette.brand,
  },
  items: {
    gap: spacing.xs,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.control,
  },
  itemActive: {
    backgroundColor: palette.brandMuted,
  },
  itemPressed: {
    backgroundColor: palette.field,
  },
  label: {
    color: palette.textMuted,
  },
  labelActive: {
    color: palette.brand,
  },
});
