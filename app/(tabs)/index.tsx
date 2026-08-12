/**
 * Home tab (placeholder dashboard). Now behind the auth gate, so it greets the
 * signed-in user. Real financial dashboard content arrives in Phase 3.
 */

import { useTranslation } from 'react-i18next';

import { Screen, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <Screen title={t('screens.homeTitle')}>
      {user?.email ? <Text>{user.email}</Text> : null}
      <Text muted>{t('screens.homeBody')}</Text>
    </Screen>
  );
}
