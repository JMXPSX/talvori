/** Grocery tab (placeholder). Shared realtime lists arrive in Phase 4. */

import { useTranslation } from 'react-i18next';

import { Screen, Text } from '@/components/ui';

export default function GroceryScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('screens.groceryTitle')}>
      <Text muted>{t('screens.groceryBody')}</Text>
    </Screen>
  );
}
