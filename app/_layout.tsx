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
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider, useTheme } from '@/components/ThemeProvider';
import { Splash, ToastProvider } from '@/components/ui';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { EntitlementsProvider } from '@/features/billing/EntitlementsProvider';
import { ActiveHouseholdProvider, useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import { fontMap } from '@/lib/fonts';

const AUTH_ROUTES = ['login', 'signup'];

/** Redirect based on session state once the initial session is known. */
function useAuthGate() {
  const { initializing, session } = useAuth();
  const { loading: householdsLoading, households } = useActiveHousehold();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (initializing) return;
    const seg0 = segments[0] ?? '';
    const inAuthRoute = AUTH_ROUTES.includes(seg0);
    const inOnboarding = seg0 === 'onboarding';
    // The design-system gallery under /dev is reachable without a session so the
    // primitives can be reviewed without signing in. __DEV__ only, and the route
    // itself renders null in production builds.
    const inDevRoute = __DEV__ && seg0 === 'dev';

    if (!session && !inAuthRoute && !inDevRoute) {
      router.replace('/login');
    } else if (session && inAuthRoute) {
      router.replace('/');
    } else if (
      // New user / no household → Onboarding (§6.3, navigation map §4).
      session &&
      !householdsLoading &&
      households.length === 0 &&
      !inOnboarding &&
      !inDevRoute
    ) {
      router.replace('/onboarding');
    }
  }, [initializing, session, householdsLoading, households.length, segments, router]);
}

function RootNavigator() {
  const { t } = useTranslation();
  const { initializing } = useAuth();
  const { palette: c, isDark } = useTheme();
  useAuthGate();

  if (initializing) {
    return <Splash />;
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
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="household" options={{ headerShown: false }} />
      <Stack.Screen name="finance" options={{ headerShown: false }} />
      {/* Auth screens draw their own in-screen titles; a native header doubles them. */}
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="signup" options={{ headerShown: false }} />
      <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
      <Stack.Screen name="reset-password" options={{ headerShown: false }} />
      <Stack.Screen name="subscription" options={{ title: t('billing.title') }} />
      <Stack.Screen name="account" options={{ title: t('account.title') }} />
      <Stack.Screen name="settings" options={{ title: t('settings.title') }} />
      <Stack.Screen name="help" options={{ title: t('help.title') }} />
      <Stack.Screen name="bills" options={{ title: t('bills.title') }} />
    </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts(fontMap);

  if (!fontsLoaded) {
    return (
      <SafeAreaProvider>
        <Splash />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ActiveHouseholdProvider>
            <EntitlementsProvider>
              <ToastProvider>
                <RootNavigator />
              </ToastProvider>
            </EntitlementsProvider>
          </ActiveHouseholdProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
