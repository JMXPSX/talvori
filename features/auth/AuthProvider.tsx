/**
 * Auth session provider. Owns the Supabase session lifecycle and exposes typed
 * sign-in / sign-up / sign-out actions plus the current session/user.
 *
 * Design:
 *   - `initializing` is true until the first session is restored, so the route
 *     guard doesn't flicker to /login before we know if a session exists.
 *   - Actions throw a typed `AppError` (messageKey) on failure; screens catch
 *     and render a localized message. Raw Supabase errors never reach the UI.
 */

import type { Session, User } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { mapAuthError } from '@/features/auth/errors';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export interface SignUpResult {
  /** True when the project requires email confirmation before a session exists. */
  needsEmailVerification: boolean;
}

interface AuthContextValue {
  initializing: boolean;
  configured: boolean;
  session: Session | null;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  /** Email a recovery link. Succeeds silently for unknown emails (no leaking). */
  requestPasswordReset: (email: string) => Promise<void>;
  /** Set a new password for the signed-in (or recovery) session. */
  updatePassword: (newPassword: string) => Promise<void>;
  /**
   * Update the signed-in user's display name, avatar URL and/or email. An email
   * change is confirmed via a link sent to the new address (nothing changes until
   * then) — `emailChangePending` reports that case so the UI can say so.
   */
  updateProfile: (changes: {
    displayName?: string;
    avatarUrl?: string;
    email?: string;
  }) => Promise<{ emailChangePending: boolean }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Unconfigured client (null supabase) never initializes, so start settled.
  const [initializing, setInitializing] = useState(() => Boolean(supabase));
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch((err) => logger.error('Failed to restore session', { error: String(err) }))
      .finally(() => setInitializing(false));

    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      // Recovery links land wherever the project's Site URL points; the event
      // fires regardless, so routing here catches every landing page.
      if (event === 'PASSWORD_RECOVERY') {
        router.push('/reset-password');
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    async function signIn(email: string, password: string): Promise<void> {
      if (!supabase) throw new AppError('config', { messageKey: 'errors.config' });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw mapAuthError(error.message);
    }

    async function signUp(
      email: string,
      password: string,
      displayName?: string,
    ): Promise<SignUpResult> {
      if (!supabase) throw new AppError('config', { messageKey: 'errors.config' });
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: displayName ? { data: { display_name: displayName } } : undefined,
      });
      if (error) throw mapAuthError(error.message);
      // No session => project requires email confirmation first.
      return { needsEmailVerification: data.session === null };
    }

    async function signOut(): Promise<void> {
      if (!supabase) return;
      const { error } = await supabase.auth.signOut();
      if (error) logger.warn('Sign out returned an error', { error: error.message });
    }

    async function requestPasswordReset(email: string): Promise<void> {
      if (!supabase) throw new AppError('config', { messageKey: 'errors.config' });
      // Web can name its landing page (must be in the project's redirect
      // allow-list; otherwise Supabase falls back to the Site URL and the
      // PASSWORD_RECOVERY handler above routes to /reset-password anyway).
      // Native waits on deep-link config (later slice) and uses the same fallback.
      const redirectTo =
        Platform.OS === 'web' ? `${window.location.origin}/reset-password` : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw mapAuthError(error.message);
    }

    async function updatePassword(newPassword: string): Promise<void> {
      if (!supabase) throw new AppError('config', { messageKey: 'errors.config' });
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw mapAuthError(error.message);
    }

    async function updateProfile(changes: {
      displayName?: string;
      avatarUrl?: string;
      email?: string;
    }): Promise<{ emailChangePending: boolean }> {
      if (!supabase) throw new AppError('config', { messageKey: 'errors.config' });
      const meta: Record<string, unknown> = {};
      if (changes.displayName !== undefined) meta.display_name = changes.displayName;
      if (changes.avatarUrl !== undefined) meta.avatar_url = changes.avatarUrl;
      const payload: { email?: string; data?: Record<string, unknown> } = {};
      if (Object.keys(meta).length > 0) payload.data = meta;
      if (changes.email) payload.email = changes.email;
      const { data, error } = await supabase.auth.updateUser(payload);
      if (error) throw mapAuthError(error.message);
      // With email confirmations on, the address only changes after the link is
      // clicked, so the returned user still shows the old email.
      const emailChangePending =
        Boolean(changes.email) && data.user?.email?.toLowerCase() !== changes.email?.toLowerCase();
      return { emailChangePending };
    }

    return {
      initializing,
      configured: isSupabaseConfigured,
      session,
      user: session?.user ?? null,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      updateProfile,
    };
  }, [initializing, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
