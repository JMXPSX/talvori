/** Budget tab (placeholder). Real budgets/allocations arrive in Phase 3. */

import { useTranslation } from 'react-i18next';

import { Screen, Text } from '@/components/ui';

export default function BudgetScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('screens.budgetTitle')}>
      <Text muted>{t('screens.budgetBody')}</Text>
    </Screen>
  );
}
