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
import { DesktopShell } from '@/components/ui/DesktopShell';
import { TaviLauncher } from '@/features/assistant/TaviLauncher';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { EntitlementsProvider } from '@/features/billing/EntitlementsProvider';
import { ActiveHouseholdProvider, useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import { clearPendingJoinCode, getPendingJoinCode } from '@/features/household/pendingJoin';
import { NotificationsProvider } from '@/features/notifications/NotificationsProvider';
import { useIsWideLayout } from '@/lib/breakpoints';
import { fontMap } from '@/lib/fonts';

// Guarantees the tab group is the base of the root stack even when the app is
// deep-linked or reloaded (Fast Refresh / web refresh) straight onto a detail
// screen like /notifications — otherwise that screen is the only entry and its
// header back button fires an unhandled GO_BACK.
export const unstable_settings = { initialRouteName: '(tabs)' };

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

  // A join code stashed by /join while signed out; re-read on session or route
  // change so the gate resumes the invite after auth, and clears once consumed
  // (the redirect below empties storage, so the next read here returns null).
  const [pendingJoin, setPendingJoin] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void getPendingJoinCode().then((c) => {
      if (alive) setPendingJoin(c);
    });
    return () => {
      alive = false;
    };
  }, [session, segments]);

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
      // a household, so onboarding isn't needed). Clearing storage here means the
      // loader effect re-reads null on the resulting navigation, so no bounce-back.
      void clearPendingJoinCode();
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
  const { initializing, session } = useAuth();
  const { palette: c, isDark } = useTheme();
  const isWide = useIsWideLayout();
  const segments = useSegments();
  const { households } = useActiveHousehold();
  useAuthGate();

  if (initializing) {
    return <Splash />;
  }

  const seg0 = segments[0] ?? '';
  const inAuthRoute = AUTH_ROUTES.includes(seg0);
  const inOnboarding = seg0 === 'onboarding';
  const inDevRoute = __DEV__ && seg0 === 'dev';
  // The persistent desktop shell (sidebar + top bar) wraps the WHOLE stack on wide
  // in-app routes, so every destination keeps the same chrome — not just the tabs.
  // Auth/onboarding routes and all mobile viewports render the bare stack.
  const showShell =
    isWide && !!session && households.length > 0 && !inAuthRoute && !inOnboarding && !inDevRoute;
  // The floating TAVI launcher rides above the WHOLE stack (every in-app page),
  // mounted once here rather than per screen. Hidden on the auth/onboarding/dev
  // routes and on the assistant screen itself (you're already talking to TAVI).
  const showTavi =
    !!session &&
    households.length > 0 &&
    !inAuthRoute &&
    !inOnboarding &&
    !inDevRoute &&
    seg0 !== 'assistant';

  // Leaf routes hand their title to the shell's top bar on wide (native header off,
  // else it doubles); on mobile they keep the native header + back button. Nested
  // stacks (finance/*, household/*) keep their own headers, so the shell shows no
  // title for them (see DesktopShell.usePageTitle).
  const stack = (
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
      <Stack.Screen name="subscription" options={{ title: t('billing.title'), headerShown: !isWide }} />
      <Stack.Screen name="account" options={{ title: t('account.title'), headerShown: !isWide }} />
      <Stack.Screen name="settings" options={{ title: t('settings.title'), headerShown: !isWide }} />
      <Stack.Screen name="notifications" options={{ title: t('notifications.title'), headerShown: !isWide }} />
      <Stack.Screen name="help" options={{ title: t('help.title'), headerShown: !isWide }} />
      <Stack.Screen name="assistant" options={{ title: t('assistant.title'), headerShown: !isWide }} />
      <Stack.Screen name="bills" options={{ title: t('bills.title'), headerShown: !isWide }} />
    </Stack>
  );

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {showShell ? <DesktopShell>{stack}</DesktopShell> : stack}
      {showTavi ? <TaviLauncher /> : null}
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
                <NotificationsProvider>
                  <RootNavigator />
                </NotificationsProvider>
              </ToastProvider>
            </EntitlementsProvider>
          </ActiveHouseholdProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
