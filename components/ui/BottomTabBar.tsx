/**
 * Mobile bottom navigation (the narrow-layout counterpart to SideNav).
 * Presentational only — the caller maps navigation state into `items`.
 *
 * Shape follows the Talvori dashboard mock: a white bar with rounded top
 * corners floating over the canvas on a raised shadow; the active tab is an
 * indigo pill holding its icon and label, inactive tabs are muted icon+label.
 */

import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { elevation, palette, radius, spacing } from '@/components/theme';
import type { SideNavItem } from '@/components/ui/SideNav';
import { Text } from '@/components/ui/Text';

export interface BottomTabBarProps {
  items: SideNavItem[];
}

export function BottomTabBar({ items }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {items.map((item) => (
        <Pressable
          key={item.key}
          accessibilityRole="button"
          accessibilityState={{ selected: item.active }}
          onPress={item.onPress}
          style={styles.item}
        >
          <View style={[styles.slot, item.active ? styles.slotActive : null]}>
            <Feather
              name={item.icon}
              size={20}
              color={item.active ? palette.white : palette.textMuted}
            />
            <Text
              variant="caption"
              numberOfLines={1}
              style={item.active ? styles.labelActive : styles.label}
            >
              {item.label}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: palette.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    boxShadow: elevation.raised,
  },
  item: {
    flex: 1,
    alignItems: 'center',
  },
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minHeight: 52,
    alignSelf: 'stretch',
    borderRadius: radius.lg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  slotActive: {
    backgroundColor: palette.brand,
  },
  label: {
    fontSize: 11,
    color: palette.textMuted,
  },
  labelActive: {
    fontSize: 11,
    color: palette.white,
  },
});
