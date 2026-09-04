/**
 * Root layout. Initializes localization, hosts the AuthProvider, and enforces
 * the auth gate: unauthenticated users are redirected to /login; authenticated
 * users are kept out of the auth screens.
 */

import '@/lib/i18n';

import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider, useTheme } from '@/components/ThemeProvider';
import { Splash, ToastProvider } from '@/components/ui';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { EntitlementsProvider } from '@/features/billing/EntitlementsProvider';
import { ActiveHouseholdProvider, useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import { clearPendingJoinCode, getPendingJoinCode } from '@/features/household/pendingJoin';
import { fontMap } from '@/lib/fonts';

// Routes reachable without a session. Password recovery must be here: a
// logged-out user reaches forgot-password from login, and the reset-password
// landing runs before its recovery session is fully settled — omitting them
// makes the gate bounce both back to /login. `join` is here so a shared invite
// link opened while signed out can stash its code and offer sign in / sign up.
const AUTH_ROUTES = ['login', 'signup', 'forgot-password', 'reset-password', 'join'];

/** Redirect based on session state once the initial session is known. */
function useAuthGate() {
  const { initializing, session } = useAuth();
  const { loading: householdsLoading, households } = useActiveHousehold();
  const segments = useSegments();
  const router = useRouter();

  // A join code stashed by /join while signed out; re-read on session change so
  // the gate can resume the invite once the user authenticates.
  const [pendingJoin, setPendingJoin] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void getPendingJoinCode().then((c) => {
      if (alive) setPendingJoin(c);
    });
    return () => {
      alive = false;
    };
  }, [session]);

  useEffect(() => {
    if (initializing) return;
    const seg0 = segments[0] ?? '';
    const inAuthRoute = AUTH_ROUTES.includes(seg0);
    // Only the true entry screens kick a signed-in user back to the app. Password
    // recovery must NOT: reset-password runs inside a recovery session, so bouncing
    // it to '/' would prevent setting the new password.
    const inEntryRoute = seg0 === 'login' || seg0 === 'signup';
    const inOnboarding = seg0 === 'onboarding';
    // The design-system gallery under /dev is reachable without a session so the
    // primitives can be reviewed without signing in. __DEV__ only, and the route
    // itself renders null in production builds.
    const inDevRoute = __DEV__ && seg0 === 'dev';

    if (!session && !inAuthRoute && !inDevRoute) {
      router.replace('/login');
    } else if (session && pendingJoin && seg0 !== 'join') {
      // Resume a shared invite the user opened before signing in — takes
      // precedence over the home/onboarding redirects below (joining gives them
      // a household, so onboarding isn't needed).
      void clearPendingJoinCode();
      setPendingJoin(null);
      router.replace(`/join/${pendingJoin}`);
    } else if (session && inEntryRoute) {
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
  }, [initializing, session, householdsLoading, households.length, segments, router, pendingJoin]);
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
