/**
 * Login screen (4a redesign) — email/password. Brand mark, centred capped card,
 * password visibility eye, right-aligned forgot link, primary sign-in CTA, then
 * the spec'd alternate methods (Google / Apple / email code) below an "or" rule,
 * and a create-account footer. On success the auth gate in the root layout
 * redirects into the app.
 *
 * The alternate methods are laid out now but not yet wired: Google/Apple OAuth and
 * email-OTP land once their providers are configured (spec 03). Pressing one shows
 * a "coming soon" notice rather than silently doing nothing.
 */

import { FontAwesome } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  type PressableStateCallbackType,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radius, spacing, webFocusRing } from '@/components/theme';
import { useThemedStyles, useTheme, type Palette } from '@/components/ThemeProvider';
import { BrandLockup, Button, FORM_MAX_WIDTH, Text, TextField } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { loginSchema } from '@/features/auth/schemas';
import { toAppError } from '@/lib/errors';
import { validate } from '@/lib/validation';

/** react-native-web adds `hovered`/`focused` to the Pressable state callback. */
type WebPressableState = PressableStateCallbackType & { hovered?: boolean; focused?: boolean };

export default function LoginScreen() {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const styles = useThemedStyles(makeStyles);
  const methodStyles = useThemedStyles(makeMethodStyles);
  const { palette } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);

  async function onSubmit() {
    setFormError(null);
    setNotice(null);
    // §6.2 zero-state + validation banners, checked before the schema so the exact
    // spec copy surfaces (empty fields / a missing @) rather than a generic message.
    if (!email.trim() || !password) {
      setFormError('auth.requireBoth');
      return;
    }
    if (!email.includes('@')) {
      setFormError('auth.emailInvalidBanner');
      return;
    }
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

  // Alternate methods aren't wired yet (spec 03) — acknowledge the tap honestly.
  function onMethodPress() {
    setFormError(null);
    setNotice('auth.methodComingSoon');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <BrandLockup markSize={52} showTagline />
          <Text variant="title" style={styles.title}>
            {t('auth.loginTitle')}
          </Text>
          <Text muted>{t('auth.loginSubtitle')}</Text>

          <View style={styles.form}>
            <TextField
              label={t('auth.emailLabel')}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoComplete="email"
              error={fieldErrors.email ? t('errors.validation') : undefined}
            />
            <TextField
              label={t('auth.passwordLabel')}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry={!showPw}
              autoComplete="current-password"
              error={fieldErrors.password ? t('errors.validation') : undefined}
            />

            {/* §6.2 — Show/Hide password (left) · Forgot password? (right), one row. */}
            <View style={styles.pwRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowPw((s) => !s)}
                hitSlop={8}
              >
                <Text variant="caption" muted>
                  {showPw ? t('auth.hidePassword') : t('auth.showPassword')}
                </Text>
              </Pressable>
              <Link href="/forgot-password">
                <Text variant="caption" style={{ color: palette.primary }}>
                  {t('auth.forgotLink')}
                </Text>
              </Link>
            </View>

            {formError ? (
              <View style={styles.banner}>
                <Text variant="caption" style={{ color: palette.danger }}>
                  {t(formError)}
                </Text>
              </View>
            ) : null}

            <Button
              label={submitting ? t('auth.signingIn') : t('auth.loginCta')}
              onPress={onSubmit}
              loading={submitting}
            />

            <View style={styles.divider}>
              <View style={styles.rule} />
              <Text variant="caption" muted>
                {t('auth.authOr')}
              </Text>
              <View style={styles.rule} />
            </View>

            <View style={styles.methods}>
              <MethodButton
                label={t('auth.continueGoogle')}
                icon={<FontAwesome name="google" size={17} color={palette.text} />}
                bg={palette.surface}
                fg={palette.text}
                bordered
                onPress={onMethodPress}
                methodStyles={methodStyles}
              />
              <MethodButton
                label={t('auth.continueApple')}
                icon={<FontAwesome name="apple" size={19} color={palette.white} />}
                bg={palette.ink}
                fg={palette.white}
                onPress={onMethodPress}
                methodStyles={methodStyles}
              />
            </View>

            {notice ? (
              <Text variant="caption" muted style={styles.noticeCenter}>
                {t(notice)}
              </Text>
            ) : null}
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

/** A social / alternate sign-in button: full-width row of leading icon + label. */
function MethodButton({
  label,
  icon,
  bg,
  fg,
  bordered = false,
  onPress,
  methodStyles,
}: {
  label: string;
  icon: React.ReactNode;
  bg: string;
  fg: string;
  bordered?: boolean;
  onPress: () => void;
  methodStyles: ReturnType<typeof makeMethodStyles>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={(state) => {
        const { pressed, hovered, focused } = state as WebPressableState;
        return [
          methodStyles.base,
          { backgroundColor: bg },
          bordered ? methodStyles.bordered : null,
          hovered ? methodStyles.hovered : null,
          pressed ? methodStyles.pressed : null,
          focused ? webFocusRing : null,
        ];
      }}
    >
      {icon}
      <Text variant="button" style={{ color: fg }}>
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  card: {
    width: '100%',
    maxWidth: FORM_MAX_WIDTH,
    alignSelf: 'center',
    gap: spacing.sm,
  },
  title: { marginTop: spacing.lg },
  form: { gap: spacing.md, marginTop: spacing.lg },
  pwRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  noticeCenter: { textAlign: 'center' },
  banner: {
    backgroundColor: c.dangerTint,
    borderRadius: radius.control,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rule: { flex: 1, height: 1, backgroundColor: c.border },
  methods: { gap: spacing.sm },
  footer: { marginTop: spacing.lg, alignSelf: 'center' },
});

const makeMethodStyles = (c: Palette) => StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.control,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  bordered: { borderWidth: 1, borderColor: c.border },
  hovered: { opacity: 0.92 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
});
