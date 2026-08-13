/** Forgot-password: request a recovery email. Always reports success for a
 *  valid email shape — Supabase stays silent about unknown addresses. */

import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { palette, spacing } from '@/components/theme';
import { Button, Screen, Text, TextField } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { forgotPasswordSchema } from '@/features/auth/schemas';
import { toAppError } from '@/lib/errors';
import { validate } from '@/lib/validation';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const { requestPasswordReset } = useAuth();

  const [email, setEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit() {
    setFormError(null);
    const result = validate(forgotPasswordSchema, { email });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await requestPasswordReset(result.data.email);
      setSent(true);
    } catch (err) {
      setFormError(toAppError(err).messageKey);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <Text variant="title">{t('auth.forgotTitle')}</Text>
      <Text muted>{t('auth.forgotBody')}</Text>

      {sent ? (
        <Text style={styles.sent}>{t('auth.resetSent')}</Text>
      ) : (
        <View style={styles.form}>
          <TextField
            label={t('auth.emailLabel')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
            error={fieldErrors.email ? t('errors.validation') : undefined}
          />
          {formError ? (
            <Text variant="caption" style={{ color: palette.danger }}>
              {t(formError)}
            </Text>
          ) : null}
          <Button
            label={submitting ? t('auth.processing') : t('auth.sendResetCta')}
            onPress={onSubmit}
            loading={submitting}
          />
        </View>
      )}

      <Link href="/login" style={styles.link}>
        <Text variant="caption" style={{ color: palette.brand }}>
          {t('auth.toLogin')}
        </Text>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md, marginTop: spacing.lg },
  sent: { marginTop: spacing.lg, color: palette.success },
  link: { marginTop: spacing.lg },
});
