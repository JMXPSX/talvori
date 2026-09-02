/**
 * Persistent desktop top bar (wide layout only). Sits above the screen content,
 * to the right of the sidebar — the Talvori desktop mock's header: a page
 * title/subtitle on the lead edge, then the household·currency pill (opens the
 * switcher), the money quick-actions, and the profile avatar on the trailing edge.
 */

import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, spacing } from '@/components/theme';
import { useTheme, useThemedStyles, type Palette } from '@/components/ThemeProvider';
import { Avatar } from '@/components/ui/Avatar';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import { HouseholdSwitcher } from '@/features/household/HouseholdSwitcher';

export interface DesktopTopBarProps {
  /** Optional lead title; omitted when the screen keeps its own H1. */
  title?: string;
  subtitle?: string;
}

export function DesktopTopBar({ title, subtitle }: DesktopTopBarProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { active } = useActiveHousehold();
  const { user } = useAuth();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const avatarName =
    (typeof user?.user_metadata?.display_name === 'string' && user.user_metadata.display_name) ||
    user?.email ||
    '';

  return (
    <View style={styles.bar}>
      <View style={styles.lead}>
        {title ? (
          <Text variant="title" numberOfLines={1}>
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text variant="caption" muted numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={styles.trailing}>
        {active ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={active.name}
            onPress={() => setSwitcherOpen(true)}
            style={({ pressed }) => [styles.pill, pressed ? styles.pressed : null]}
          >
            <Text variant="button" numberOfLines={1}>
              {`${active.name} · ${active.reporting_currency_code}`}
            </Text>
            <Feather name="chevron-down" size={16} color={palette.textSecondary} />
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('finance.addIncome')}
          onPress={() => router.push('/finance/entry?type=income')}
          style={({ pressed }) => [styles.action, styles.actionIncome, pressed ? styles.pressed : null]}
        >
          <Feather name="plus" size={15} color={palette.positiveStrong} />
          <Text variant="button" style={styles.incomeLabel}>
            {t('finance.income')}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('finance.addExpense')}
          onPress={() => router.push('/finance/entry?type=expense')}
          style={({ pressed }) => [styles.action, styles.actionExpense, pressed ? styles.pressed : null]}
        >
          <Feather name="plus" size={15} color={palette.white} />
          <Text variant="button" style={styles.expenseLabel}>
            {t('finance.expense')}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('finance.addTransfer')}
          onPress={() => router.push('/finance/transfer')}
          style={({ pressed }) => [styles.iconAction, pressed ? styles.pressed : null]}
        >
          <Feather name="repeat" size={17} color={palette.brand} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={avatarName}
          onPress={() => router.push('/account')}
        >
          <Avatar name={avatarName} size={38} variant="self" />
        </Pressable>
      </View>

      <HouseholdSwitcher visible={switcherOpen} onClose={() => setSwitcherOpen(false)} />
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    minHeight: 68,
    backgroundColor: c.background,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  lead: { flex: 1, gap: 2 },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: 38,
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    minHeight: 38,
    borderRadius: radius.control,
  },
  actionIncome: { backgroundColor: c.positiveTint },
  actionExpense: { backgroundColor: c.brand },
  incomeLabel: { color: c.positiveStrong },
  expenseLabel: { color: c.white },
  iconAction: {
    width: 38,
    height: 38,
    borderRadius: radius.control,
    backgroundColor: c.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
});
