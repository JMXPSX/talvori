/** Reset-password: set a new password using the recovery session established
 *  by the emailed link (AuthProvider routes here on PASSWORD_RECOVERY). */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { palette, spacing } from '@/components/theme';
import { Button, Screen, Text, TextField } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { resetPasswordSchema } from '@/features/auth/schemas';
import { toAppError } from '@/lib/errors';
import { validate } from '@/lib/validation';

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, updatePassword } = useAuth();

  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setFormError(null);
    const result = validate(resetPasswordSchema, { password });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await updatePassword(result.data.password);
      router.replace('/');
    } catch (err) {
      setFormError(toAppError(err).messageKey);
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <Text variant="title">{t('auth.resetTitle')}</Text>
      {user?.email ? (
        <Text variant="caption" muted>
          {user.email}
        </Text>
      ) : (
        // No recovery session: the user landed here without a valid link.
        <Text muted>{t('auth.resetNeedsLink')}</Text>
      )}

      <View style={styles.form}>
        <TextField
          label={t('auth.newPasswordLabel')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          hint={t('auth.passwordHint')}
          error={fieldErrors.password ? t('errors.validation') : undefined}
        />
        {formError ? (
          <Text variant="caption" style={{ color: palette.danger }}>
            {t(formError)}
          </Text>
        ) : null}
        <Button
          label={submitting ? t('auth.processing') : t('auth.resetCta')}
          onPress={onSubmit}
          loading={submitting}
          disabled={!user}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md, marginTop: spacing.lg },
});
