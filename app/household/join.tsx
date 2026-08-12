/**
 * Accept an invitation by token. The RPC validates the token, expiry, and that
 * it was issued to the signed-in user's email — all server-side.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { palette, spacing } from '@/components/theme';
import { Button, Screen, Text, TextField } from '@/components/ui';
import { acceptInvitation } from '@/features/household/api';
import { acceptInvitationSchema } from '@/features/household/schemas';
import { toAppError } from '@/lib/errors';
import { validate } from '@/lib/validation';

export default function JoinHouseholdScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [token, setToken] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [joined, setJoined] = useState(false);

  async function onAccept() {
    setFormError(null);
    const result = validate(acceptInvitationSchema, { token: token.trim() });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await acceptInvitation(result.data.token);
      setJoined(true);
    } catch (err) {
      setFormError(toAppError(err).messageKey);
    } finally {
      setSubmitting(false);
    }
  }

  if (joined) {
    return (
      <Screen>
        <Text variant="title">{t('household.joined')}</Text>
        <Button label={t('household.title')} onPress={() => router.replace('/household')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text muted>{t('household.tokenLabel')}</Text>
      <View style={styles.form}>
        <TextField
          label={t('household.tokenLabel')}
          value={token}
          onChangeText={setToken}
          error={fieldErrors.token ? t('errors.validation') : undefined}
        />
        {formError ? (
          <Text variant="caption" style={{ color: palette.danger }}>
            {t(formError)}
          </Text>
        ) : null}
        <Button
          label={submitting ? t('auth.processing') : t('household.joinCta')}
          onPress={onAccept}
          loading={submitting}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md, marginTop: spacing.lg },
});
