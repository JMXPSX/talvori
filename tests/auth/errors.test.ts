/** Auth error mapping: raw Supabase messages -> typed, localizable AppErrors.
 *  Phase 8 QA item 1 (the pure slice; live sign-in/out runs in test:rls land). */

import { mapAuthError } from '@/features/auth/errors';

describe('mapAuthError', () => {
  it.each([
    ['Invalid login credentials', 'unauthorized', 'auth.errors.invalidCredentials'],
    ['Email not confirmed', 'unauthorized', 'auth.errors.emailNotConfirmed'],
    ['User already registered', 'validation', 'auth.errors.emailInUse'],
    ['A user with this email address has already been registered', 'validation', 'auth.errors.emailInUse'],
    ['Password should be at least 8 characters', 'validation', 'auth.errors.weakPassword'],
    ['Email rate limit exceeded', 'rate_limited', 'errors.rate_limited'],
    ['Too many requests', 'rate_limited', 'errors.rate_limited'],
  ])('maps %j', (raw, code, messageKey) => {
    const err = mapAuthError(raw);
    expect(err.code).toBe(code);
    expect(err.messageKey).toBe(messageKey);
  });

  it('is case-insensitive', () => {
    expect(mapAuthError('INVALID LOGIN CREDENTIALS').messageKey).toBe(
      'auth.errors.invalidCredentials',
    );
  });

  it('falls back to a generic auth error and never leaks the raw message key', () => {
    for (const raw of [undefined, '', 'Database error saving new user']) {
      const err = mapAuthError(raw);
      expect(err.code).toBe('unknown');
      expect(err.messageKey).toBe('auth.errors.generic');
    }
  });

  it('every mapped messageKey resolves in all locales', () => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const en = require('../../locales/en.json');
    const fil = require('../../locales/fil.json');
    const ar = require('../../locales/ar.json');
    /* eslint-enable @typescript-eslint/no-require-imports */
    const keys = [
      'auth.errors.invalidCredentials',
      'auth.errors.emailNotConfirmed',
      'auth.errors.emailInUse',
      'auth.errors.weakPassword',
      'errors.rate_limited',
      'auth.errors.generic',
    ];
    const resolve = (obj: Record<string, unknown>, path: string): unknown =>
      path.split('.').reduce<unknown>((acc, part) => (acc as Record<string, unknown>)?.[part], obj);
    for (const locale of [en, fil, ar]) {
      for (const key of keys) {
        expect(typeof resolve(locale, key)).toBe('string');
      }
    }
  });
});
