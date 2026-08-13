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
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

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

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
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

    return {
      initializing,
      configured: isSupabaseConfigured,
      session,
      user: session?.user ?? null,
      signIn,
      signUp,
      signOut,
    };
  }, [initializing, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
