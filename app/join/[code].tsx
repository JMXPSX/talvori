/**
 * Deep-link join: /join/<code>. The shared invite link lands here with the
 * standing invite code prefilled from the path.
 *  - Signed in: confirm to join via the join_household_by_code RPC (same flow
 *    as the Household switcher).
 *  - Signed out: stash the code and offer sign in / create account; the auth
 *    gate resumes the join here once a session exists (see app/_layout.tsx).
 */

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/components/ThemeProvider';
import { Button, Screen, Text, TextField } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { joinHouseholdByCode } from '@/features/household/api';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import { clearPendingJoinCode, setPendingJoinCode } from '@/features/household/pendingJoin';
import { toAppError } from '@/lib/errors';

export default function JoinByCodeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { palette } = useTheme();
  const { session } = useAuth();
  const { code: raw } = useLocalSearchParams<{ code?: string }>();
  const { refresh, setActiveId } = useActiveHousehold();

  const [code, setCode] = useState((raw ?? '').toUpperCase());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorArg, setErrorArg] = useState<Record<string, string> | undefined>(undefined);

  const signedOut = !session;

  // Signed out: remember the code so the gate can resume the join after auth.
  useEffect(() => {
    const c = (raw ?? '').trim().toUpperCase();
    if (signedOut && c) void setPendingJoinCode(c);
  }, [signedOut, raw]);

  async function onJoin() {
    setError(null);
    setErrorArg(undefined);
    if (!code.trim()) return;
    setBusy(true);
    try {
      const joined = await joinHouseholdByCode(code);
      await clearPendingJoinCode();
      await refresh();
      setActiveId(joined.id);
      router.replace('/');
    } catch (err) {
      const key = toAppError(err).messageKey;
      setError(key);
      if (key === 'household.errors.codeNotFound') setErrorArg({ code: code.trim().toUpperCase() });
    } finally {
      setBusy(false);
    }
  }

  if (signedOut) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('household.joinTitle') }} />
        <Text variant="title">{t('household.joinTitle')}</Text>
        <Text muted>{t('household.joinInvitePrompt', { code })}</Text>
        <Button label={t('auth.loginCta')} onPress={() => router.push('/login')} />
        <Button label={t('auth.signupCta')} variant="secondary" onPress={() => router.push('/signup')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: t('household.joinTitle') }} />
      <Text variant="title">{t('household.joinTitle')}</Text>
      <Text muted>{t('home.joinWithCode')}</Text>
      <TextField
        label={t('home.joinWithCode')}
        value={code}
        onChangeText={(v) => setCode(v.toUpperCase())}
        placeholder={t('home.joinPlaceholder')}
        autoCapitalize="characters"
      />
      {error ? (
        <Text variant="caption" style={{ color: palette.danger }}>
          {t(error, errorArg)}
        </Text>
      ) : null}
      <Button label={busy ? t('auth.processing') : t('home.join')} onPress={onJoin} loading={busy} />
    </Screen>
  );
}
