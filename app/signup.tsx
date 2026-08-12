/**
 * Signup screen (placeholder). Layout + localized copy only — NO account
 * creation yet. Registration/verification flows are built in Phase 2.
 */

import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View } from 'react-native';

import { palette, radius, spacing } from '@/components/theme';
import { Button, Screen, Text } from '@/components/ui';
import { direction } from '@/lib/rtl';

export default function SignupScreen() {
  const { t } = useTranslation();

  return (
    <Screen>
      <Text variant="title">{t('auth.signupTitle')}</Text>
      <Text muted>{t('auth.signupSubtitle')}</Text>

      <View style={styles.form}>
        <Text variant="caption" muted>
          {t('auth.emailLabel')}
        </Text>
        <TextInput
          style={[styles.input, { textAlign: direction.textAlign }]}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={false}
        />

        <Text variant="caption" muted>
          {t('auth.passwordLabel')}
        </Text>
        <TextInput
          style={[styles.input, { textAlign: direction.textAlign }]}
          secureTextEntry
          editable={false}
        />

        <Button label={t('auth.signupCta')} disabled />
      </View>

      <Link href="/login" style={styles.link}>
        <Text variant="caption" style={{ color: palette.brand }}>
          {t('auth.toLogin')}
        </Text>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: palette.surface,
    color: palette.text,
  },
  link: {
    marginTop: spacing.lg,
  },
});
