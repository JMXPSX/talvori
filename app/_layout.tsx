/**
 * Root layout. Initializes localization, hosts the AuthProvider, and enforces
 * the auth gate: unauthenticated users are redirected to /login; authenticated
 * users are kept out of the auth screens.
 */

import '@/lib/i18n';

import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { palette } from '@/components/theme';
import { ThemeProvider, useTheme } from '@/components/ThemeProvider';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { EntitlementsProvider } from '@/features/billing/EntitlementsProvider';
import { ActiveHouseholdProvider } from '@/features/household/ActiveHouseholdProvider';
import { fontMap } from '@/lib/fonts';

const AUTH_ROUTES = ['login', 'signup'];

/** Redirect based on session state once the initial session is known. */
function useAuthGate() {
  const { initializing, session } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (initializing) return;
    const inAuthRoute = AUTH_ROUTES.includes(segments[0] ?? '');
    // The design-system gallery under /dev is reachable without a session so the
    // primitives can be reviewed without signing in. __DEV__ only, and the route
    // itself renders null in production builds.
    const inDevRoute = __DEV__ && segments[0] === 'dev';

    if (!session && !inAuthRoute && !inDevRoute) {
      router.replace('/login');
    } else if (session && inAuthRoute) {
      router.replace('/');
    }
  }, [initializing, session, segments, router]);
}

function RootNavigator() {
  const { t } = useTranslation();
  const { initializing } = useAuth();
  const { palette: c, isDark } = useTheme();
  useAuthGate();

  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background }}>
        <ActivityIndicator color={c.brand} />
      </View>
    );
  }

  return (
    <>
    <StatusBar style={isDark ? 'light' : 'dark'} />
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.background },
        headerTintColor: c.text,
        contentStyle: { backgroundColor: c.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="household" options={{ headerShown: false }} />
      <Stack.Screen name="finance" options={{ headerShown: false }} />
      {/* Auth screens draw their own in-screen titles; a native header doubles them. */}
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="signup" options={{ headerShown: false }} />
      <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
      <Stack.Screen name="reset-password" options={{ headerShown: false }} />
      <Stack.Screen name="subscription" options={{ title: t('billing.title') }} />
      <Stack.Screen name="account" options={{ title: t('account.title') }} />
    </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts(fontMap);

  if (!fontsLoaded) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background }}>
          <ActivityIndicator color={palette.brand} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ActiveHouseholdProvider>
            <EntitlementsProvider>
              <RootNavigator />
            </EntitlementsProvider>
          </ActiveHouseholdProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
