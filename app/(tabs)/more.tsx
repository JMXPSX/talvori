/** More tab. Hosts sign-out now; household, goals, security, settings land later. */

import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { palette, spacing } from '@/components/theme';
import { Button, Screen, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';

export default function MoreScreen() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  async function onSignOut() {
    setBusy(true);
    try {
      await signOut();
      // Auth gate redirects to /login once the session clears.
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title={t('screens.moreTitle')}>
      <Text muted>{t('screens.moreBody')}</Text>
      {user?.email ? (
        <Text variant="caption" muted>
          {user.email}
        </Text>
      ) : null}
      <Link href="/household" style={styles.link}>
        <Text style={{ color: palette.brand }}>{t('household.open')}</Text>
      </Link>

      <View style={styles.actions}>
        <Button
          label={t('auth.signOut')}
          variant="secondary"
          onPress={onSignOut}
          loading={busy}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: {
    marginTop: spacing.md,
  },
  actions: {
    marginTop: spacing.lg,
  },
});
