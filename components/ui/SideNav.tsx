/**
 * Desktop sidebar navigation (the wide-layout counterpart to the bottom tab
 * bar). Presentational only — the caller maps navigation state into `items`, so
 * this component has no dependency on the navigator and stays easy to test.
 *
 * Modernist: a paper column with a 2px ink edge rule, split into FOUR sections
 * by 2px divider rules — (1) wordmark, (2) household switcher, (3) nav list,
 * (4) account footer — matching the Claude Design "Household Redesign" sidebar.
 * The active nav row is a solid ink block with a paper label.
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

/** Section 2 — the tappable household switcher. */
export interface SideNavHousehold {
  name: string;
  meta?: string;
  /** Short mark (initials) shown in the square tile. */
  mark: string;
  onPress?: () => void;
}

/** Section 4 — the account footer. */
export interface SideNavUser {
  name: string;
  meta?: string;
  mark: string;
}

export interface SideNavProps {
  /** Wordmark shown at the top. */
  brand: string;
  household?: SideNavHousehold;
  user?: SideNavUser;
  items: SideNavItem[];
}

export const SIDEBAR_WIDTH = 260;

export function SideNav({ brand, household, user, items }: SideNavProps) {
  return (
    <View style={styles.sidebar}>
      {/* 1 — wordmark */}
      <View style={styles.brandBlock}>
        <Text variant="heading" style={styles.brand}>
          {brand}
          <Text style={styles.brandDot}>.</Text>
        </Text>
      </View>

      {/* 2 — household switcher */}
      {household ? (
        <Pressable
          accessibilityRole="button"
          onPress={household.onPress}
          style={({ pressed }) => [styles.switcher, pressed ? styles.pressed : null]}
        >
          <View style={styles.mark}>
            <Text variant="button" style={styles.markLabel}>
              {household.mark}
            </Text>
          </View>
          <View style={styles.switcherText}>
            <Text variant="button" numberOfLines={1}>
              {household.name}
            </Text>
            {household.meta ? (
              <Text variant="caption" muted numberOfLines={1}>
                {household.meta}
              </Text>
            ) : null}
          </View>
          <Feather name="chevron-down" size={18} color={palette.textMuted} />
        </Pressable>
      ) : null}

      {/* 3 — nav list */}
      <ScrollView style={styles.navScroll} contentContainerStyle={styles.items}>
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
            <Feather name={item.icon} size={20} color={item.active ? palette.white : palette.text} />
            <Text
              variant="button"
              style={item.active ? styles.labelActive : styles.label}
              numberOfLines={1}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* 4 — account footer */}
      {user ? (
        <View style={styles.footer}>
          <View style={styles.avatar}>
            <Text variant="button" style={styles.avatarLabel}>
              {user.mark}
            </Text>
          </View>
          <View style={styles.footerText}>
            <Text variant="button" numberOfLines={1}>
              {user.name}
            </Text>
            {user.meta ? (
              <Text variant="caption" muted numberOfLines={1}>
                {user.meta}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: palette.background,
    // 2px edge rule between sidebar and content; borderEnd is RTL-safe (the
    // sidebar sits on the right in Arabic, so the rule follows to its inner edge).
    borderEndWidth: 2,
    borderEndColor: palette.borderStrong,
  },
  // 1 — wordmark
  brandBlock: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: palette.border,
  },
  brand: { color: palette.text },
  brandDot: { color: palette.brand },
  // 2 — household switcher
  switcher: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: palette.border,
  },
  pressed: { backgroundColor: palette.surface },
  mark: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: palette.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markLabel: { color: palette.white, fontSize: 13 },
  switcherText: { flex: 1, minWidth: 0, gap: 2 },
  // 3 — nav list
  navScroll: { flex: 1 },
  items: {
    padding: spacing.sm,
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
  itemActive: { backgroundColor: palette.text },
  itemPressed: { backgroundColor: palette.surface },
  label: { flex: 1, color: palette.text },
  labelActive: { flex: 1, color: palette.white },
  // 4 — account footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 2,
    borderTopColor: palette.border,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: { color: palette.text, fontSize: 12 },
  footerText: { flex: 1, minWidth: 0, gap: 2 },
});
