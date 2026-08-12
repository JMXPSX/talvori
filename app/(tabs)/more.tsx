/** More tab (placeholder). Household, goals, security, settings arrive later. */

import { useTranslation } from 'react-i18next';

import { Screen, Text } from '@/components/ui';

export default function MoreScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('screens.moreTitle')}>
      <Text muted>{t('screens.moreBody')}</Text>
    </Screen>
  );
}
