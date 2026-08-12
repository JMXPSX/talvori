/**
 * Signup screen — email/password (Phase 2 slice 1). The project requires email
 * verification (mailer_autoconfirm off), so on success we show a "check your
 * email" state rather than logging straight in.
 */

import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { palette, spacing } from '@/components/theme';
import { Button, Screen, Text, TextField } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { signupSchema } from '@/features/auth/schemas';
import { toAppError } from '@/lib/errors';
import { validate } from '@/lib/validation';

export default function SignupScreen() {
  const { t } = useTranslation();
  const { signUp } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  async function onSubmit() {
    setFormError(null);
    const result = validate(signupSchema, {
      displayName: displayName.trim() || undefined,
      email,
      password,
    });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      const { needsEmailVerification } = await signUp(
        result.data.email,
        result.data.password,
        result.data.displayName,
      );
      if (needsEmailVerification) {
        setVerificationSent(true);
      }
      // If a session was returned, the auth gate redirects into the app.
    } catch (err) {
      setFormError(toAppError(err).messageKey);
    } finally {
      setSubmitting(false);
    }
  }

  if (verificationSent) {
    return (
      <Screen>
        <Text variant="title">{t('auth.verifyEmailTitle')}</Text>
        <Text muted>{t('auth.verifyEmailBody', { email })}</Text>
        <Link href="/login" style={styles.link}>
          <Text variant="caption" style={{ color: palette.brand }}>
            {t('auth.toLogin')}
          </Text>
        </Link>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text variant="title">{t('auth.signupTitle')}</Text>
      <Text muted>{t('auth.signupSubtitle')}</Text>

      <View style={styles.form}>
        <TextField
          label={t('auth.displayNameLabel')}
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          autoComplete="name"
        />
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
          autoComplete="new-password"
          hint={t('auth.passwordHint')}
          error={
            fieldErrors.password ? t('auth.errors.weakPassword') : undefined
          }
        />

        {formError ? (
          <Text variant="caption" style={{ color: palette.danger }}>
            {t(formError)}
          </Text>
        ) : null}

        <Button
          label={submitting ? t('auth.processing') : t('auth.signupCta')}
          onPress={onSubmit}
          loading={submitting}
        />
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
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  link: {
    marginTop: spacing.lg,
  },
});
