/**
 * Login screen (4a redesign) — email/password. Brand mark, centred capped card,
 * password visibility eye, right-aligned forgot link, and a create-account
 * footer. On success the auth gate in the root layout redirects into the app.
 * Social / email-code methods land once their providers are configured (spec 03).
 */

import { Feather } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing } from '@/components/theme';
import { Button, FORM_MAX_WIDTH, Text, TextField } from '@/components/ui';
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
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.mark}>
            <Feather name="home" size={26} color={palette.white} />
          </View>
          <Text variant="title" style={styles.center}>
            {t('auth.loginTitle')}
          </Text>
          <Text muted style={styles.center}>
            {t('auth.loginSubtitle')}
          </Text>

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
              secureToggle
              toggleShowLabel={t('auth.showPassword')}
              toggleHideLabel={t('auth.hidePassword')}
              autoComplete="current-password"
              error={fieldErrors.password ? t('errors.validation') : undefined}
            />

            <Link href="/forgot-password" style={styles.forgot}>
              <Text variant="caption" style={{ color: palette.brand }}>
                {t('auth.forgotLink')}
              </Text>
            </Link>

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

          <Link href="/signup" style={styles.footer}>
            <Text variant="caption" style={{ color: palette.brand }}>
              {t('auth.toSignup')}
            </Text>
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  card: {
    width: '100%',
    maxWidth: FORM_MAX_WIDTH,
    alignSelf: 'center',
    gap: spacing.sm,
  },
  mark: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: palette.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  center: { textAlign: 'center' },
  form: { gap: spacing.md, marginTop: spacing.lg },
  forgot: { alignSelf: 'flex-end' },
  footer: { marginTop: spacing.lg, alignSelf: 'center' },
});
