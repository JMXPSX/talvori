/** Budget tab — a hub linking to Budgets, Savings goals, and Debts. */

import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { palette, spacing } from '@/components/theme';
import { ListRow, Screen, Text } from '@/components/ui';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';

const GOAL_ICON = '#8A6414';
const DEBT_TILE = '#F3DBD8';

export default function BudgetHubScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { active } = useActiveHousehold();

  return (
    <Screen title={t('planning.hubTitle')}>
      {!active ? (
        <Text muted>{t('finance.noHousehold')}</Text>
      ) : (
        <View style={styles.list}>
          <ListRow
            icon="pie-chart"
            label={t('planning.budgets.hub')}
            onPress={() => router.push('/finance/budgets')}
          />
          <ListRow
            icon="target"
            label={t('planning.goals.hub')}
            iconColor={GOAL_ICON}
            iconBg={palette.accentMuted}
            onPress={() => router.push('/finance/goals')}
          />
          <ListRow
            icon="trending-down"
            label={t('planning.debts.hub')}
            iconColor={palette.danger}
            iconBg={DEBT_TILE}
            onPress={() => router.push('/finance/debts')}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, marginTop: spacing.md },
});
