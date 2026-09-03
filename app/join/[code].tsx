/**
 * Deep-link join: /join/<code>. The shared invite link lands here with the
 * standing invite code prefilled from the path; the user confirms to join via
 * the existing join_household_by_code RPC (same flow as the Household switcher).
 * The root auth gate sends signed-out visitors to /login first, so this renders
 * for signed-in users — full signed-out code-preservation is deferred.
 */

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/components/ThemeProvider';
import { Button, Screen, Text, TextField } from '@/components/ui';
import { joinHouseholdByCode } from '@/features/household/api';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import { toAppError } from '@/lib/errors';

export default function JoinByCodeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { palette } = useTheme();
  const { code: raw } = useLocalSearchParams<{ code?: string }>();
  const { refresh, setActiveId } = useActiveHousehold();

  const [code, setCode] = useState((raw ?? '').toUpperCase());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorArg, setErrorArg] = useState<Record<string, string> | undefined>(undefined);

  async function onJoin() {
    setError(null);
    setErrorArg(undefined);
    if (!code.trim()) return;
    setBusy(true);
    try {
      const joined = await joinHouseholdByCode(code);
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
