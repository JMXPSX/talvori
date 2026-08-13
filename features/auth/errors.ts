/**
 * Pure auth-error mapping — no Supabase import so it stays jest-testable.
 * Raw Supabase error strings never reach the UI; every failure becomes a typed
 * AppError with a localizable messageKey.
 */

import { AppError } from '@/lib/errors';

/** Translate a Supabase auth error into a typed, localizable AppError. */
export function mapAuthError(message: string | undefined): AppError {
  const m = (message ?? '').toLowerCase();
  if (m.includes('invalid login credentials')) {
    return new AppError('unauthorized', { messageKey: 'auth.errors.invalidCredentials' });
  }
  if (m.includes('email not confirmed')) {
    return new AppError('unauthorized', { messageKey: 'auth.errors.emailNotConfirmed' });
  }
  if (m.includes('already registered') || m.includes('already been registered')) {
    return new AppError('validation', { messageKey: 'auth.errors.emailInUse' });
  }
  if (m.includes('password')) {
    return new AppError('validation', { messageKey: 'auth.errors.weakPassword' });
  }
  if (m.includes('rate') || m.includes('too many')) {
    return new AppError('rate_limited', { messageKey: 'errors.rate_limited' });
  }
  return new AppError('unknown', { messageKey: 'auth.errors.generic' });
}
