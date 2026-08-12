/** Budget tab — a hub linking to Budgets, Savings goals, and Debts. */

import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { palette, radius, spacing } from '@/components/theme';
import { Screen, Text } from '@/components/ui';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';

export default function BudgetHubScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { active } = useActiveHousehold();

  const links: { label: string; href: string }[] = [
    { label: t('planning.budgets.hub'), href: '/finance/budgets' },
    { label: t('planning.goals.hub'), href: '/finance/goals' },
    { label: t('planning.debts.hub'), href: '/finance/debts' },
  ];

  return (
    <Screen title={t('planning.hubTitle')}>
      {!active ? (
        <Text muted>{t('finance.noHousehold')}</Text>
      ) : (
        <View style={styles.list}>
          {links.map((l) => (
            <Pressable key={l.href} style={styles.card} onPress={() => router.push(l.href)}>
              <Text variant="heading">{l.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, marginTop: spacing.md },
  card: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
  },
});
