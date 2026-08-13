/**
 * Login screen — email/password (Phase 2 slice 1). On success the auth gate in
 * the root layout redirects into the app. Other methods (OTP/OAuth/MFA) land in
 * later slices once their providers are configured.
 */

import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { palette, spacing } from '@/components/theme';
import { Button, Screen, Text, TextField } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { loginSchema } from '@/features/auth/schemas';
import { toAppError } from '@/lib/errors';
import { validate } from '@/lib/validation';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setFormError(null);
    const result = validate(loginSchema, { email, password });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await signIn(result.data.email, result.data.password);
      // Redirect handled by the auth gate.
    } catch (err) {
      setFormError(toAppError(err).messageKey);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <Text variant="title">{t('auth.loginTitle')}</Text>
      <Text muted>{t('auth.loginSubtitle')}</Text>

      <View style={styles.form}>
        <TextField
          label={t('auth.emailLabel')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoComplete="email"
          error={fieldErrors.email ? t('errors.validation') : undefined}
        />
        <TextField
          label={t('auth.passwordLabel')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          error={fieldErrors.password ? t('errors.validation') : undefined}
        />

        {formError ? (
          <Text variant="caption" style={{ color: palette.danger }}>
            {t(formError)}
          </Text>
        ) : null}

        <Button
          label={submitting ? t('auth.processing') : t('auth.loginCta')}
          onPress={onSubmit}
          loading={submitting}
        />
      </View>

      <Link href="/forgot-password" style={styles.link}>
        <Text variant="caption" style={{ color: palette.brand }}>
          {t('auth.forgotLink')}
        </Text>
      </Link>
      <Link href="/signup" style={styles.link}>
        <Text variant="caption" style={{ color: palette.brand }}>
          {t('auth.toSignup')}
        </Text>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  link: {
    marginTop: spacing.lg,
  },
});
