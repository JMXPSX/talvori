/**
 * Environment strategy (see 09_PHASE_1_CLAUDE_BUILD_PROMPT.md §F).
 *
 * Only client-safe, publishable values are read here — all exposed through the
 * `EXPO_PUBLIC_` prefix which Expo inlines into the client bundle. Server
 * secrets NEVER appear in this file (see 02_NON_NEGOTIABLE_ARCHITECTURE_RULES).
 *
 * Phase 1 must boot even when Supabase is not yet configured, so missing/
 * placeholder credentials degrade gracefully (`isSupabaseConfigured === false`)
 * instead of crashing the app.
 */

import { z } from 'zod';

import { logger } from '@/lib/logger';

export type AppEnvironment = 'development' | 'staging' | 'production';

const rawSchema = z.object({
  EXPO_PUBLIC_APP_ENV: z
    .enum(['development', 'staging', 'production'])
    .default('development'),
  EXPO_PUBLIC_SUPABASE_URL: z.string().default(''),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().default(''),
});

const parsed = rawSchema.safeParse({
  EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
});

const raw = parsed.success
  ? parsed.data
  : rawSchema.parse({});

if (!parsed.success) {
  logger.warn('Environment failed validation; using safe defaults.', {
    issues: parsed.error.issues.map((i) => i.path.join('.')),
  });
}

const supabaseUrl = raw.EXPO_PUBLIC_SUPABASE_URL.trim();
const supabaseAnonKey = raw.EXPO_PUBLIC_SUPABASE_ANON_KEY.trim();

const placeholderPattern = /YOUR-PROJECT|your-anon|example\.com/i;
const isSupabaseConfigured =
  supabaseUrl.length > 0 &&
  supabaseAnonKey.length > 0 &&
  !placeholderPattern.test(supabaseUrl) &&
  !placeholderPattern.test(supabaseAnonKey);

if (!isSupabaseConfigured) {
  logger.warn(
    'Supabase is not configured. Copy .env.example to .env and set ' +
      'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'The app will run, but backend calls are disabled.',
  );
}

export const env = {
  appEnv: raw.EXPO_PUBLIC_APP_ENV as AppEnvironment,
  isProduction: raw.EXPO_PUBLIC_APP_ENV === 'production',
  isDevelopment: raw.EXPO_PUBLIC_APP_ENV === 'development',
  supabaseUrl,
  supabaseAnonKey,
  isSupabaseConfigured,
} as const;
