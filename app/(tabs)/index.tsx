/**
 * Home tab (placeholder). Demonstrates routing to the auth screens and shows a
 * dev-only configuration hint. Real dashboard content arrives in Phase 3.
 */

import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/components/theme';
import { Button, Screen, Text } from '@/components/ui';
import { env } from '@/lib/env';

export default function HomeScreen() {
  const { t } = useTranslation();

  return (
    <Screen title={t('screens.homeTitle')}>
      <Text muted>{t('screens.homeBody')}</Text>

      <View style={styles.actions}>
        <Link href="/login" asChild>
          <Button label={t('auth.loginCta')} variant="primary" />
        </Link>
        <Link href="/signup" asChild>
          <Button label={t('auth.signupCta')} variant="secondary" />
        </Link>
      </View>

      {env.isDevelopment && !env.isSupabaseConfigured ? (
        <Text variant="caption" muted style={styles.devHint}>
          {t('errors.config')}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  devHint: {
    marginTop: spacing.lg,
  },
});
