/**
 * Root layout. Initializes localization (side-effect import) and hosts the
 * top-level Stack: the tab group plus the auth placeholder screens.
 *
 * Phase 1 has no auth gate yet — every route is reachable so routing itself can
 * be verified. The gate arrives in Phase 2.
 */

import '@/lib/i18n';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { palette } from '@/components/theme';

export default function RootLayout() {
  const { t } = useTranslation();

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: palette.background },
          headerTintColor: palette.text,
          contentStyle: { backgroundColor: palette.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: t('auth.loginTitle') }} />
        <Stack.Screen name="signup" options={{ title: t('auth.signupTitle') }} />
      </Stack>
    </SafeAreaProvider>
  );
}
