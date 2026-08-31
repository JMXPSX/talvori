/** Finance section stack (accounts, entry, transfer, categories). */

import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/components/ThemeProvider';

export default function FinanceLayout() {
  const { t } = useTranslation();
  const { palette } = useTheme();
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
      <Stack.Screen
        name="edit/[id]"
        options={{ title: t('finance.edit.title'), presentation: 'modal' }}
      />
      <Stack.Screen name="transfer" options={{ title: t('finance.transfer.title') }} />
      <Stack.Screen name="categories" options={{ title: t('finance.categories.title') }} />
      <Stack.Screen name="budgets" options={{ title: t('planning.budgets.title') }} />
      <Stack.Screen
        name="budget-new"
        options={{ title: t('planning.budgets.addTitle'), presentation: 'modal' }}
      />
      <Stack.Screen name="goals" options={{ title: t('planning.goals.title') }} />
      <Stack.Screen name="debts" options={{ title: t('planning.debts.title') }} />
      <Stack.Screen name="rates" options={{ title: t('fx.title') }} />
      <Stack.Screen name="insights" options={{ title: t('insights.title') }} />
    </Stack>
  );
}
