/** Finance section stack (accounts, entry, transfer, categories). */

import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { palette } from '@/components/theme';

export default function FinanceLayout() {
  const { t } = useTranslation();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: palette.background },
        headerTintColor: palette.text,
        contentStyle: { backgroundColor: palette.background },
      }}
    >
      <Stack.Screen name="accounts" options={{ title: t('finance.accounts.title') }} />
      <Stack.Screen name="entry" options={{ title: t('finance.entry.saveCta') }} />
      <Stack.Screen name="transfer" options={{ title: t('finance.transfer.title') }} />
      <Stack.Screen name="categories" options={{ title: t('finance.categories.title') }} />
      <Stack.Screen name="budgets" options={{ title: t('planning.budgets.title') }} />
      <Stack.Screen name="goals" options={{ title: t('planning.goals.title') }} />
      <Stack.Screen name="debts" options={{ title: t('planning.debts.title') }} />
      <Stack.Screen name="rates" options={{ title: t('fx.title') }} />
    </Stack>
  );
}
