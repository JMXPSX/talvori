/** Transactions tab (placeholder). Income/expense/transfer arrive in Phase 3. */

import { useTranslation } from 'react-i18next';

import { Screen, Text } from '@/components/ui';

export default function TransactionsScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('screens.transactionsTitle')}>
      <Text muted>{t('screens.transactionsBody')}</Text>
    </Screen>
  );
}
