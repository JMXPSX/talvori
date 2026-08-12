/**
 * Supabase client foundation (see 09_PHASE_1_CLAUDE_BUILD_PROMPT.md §E).
 *
 * Uses ONLY the publishable anon key (RLS-protected). No service-role key ever
 * reaches the client. On native, sessions persist via AsyncStorage; on web the
 * default storage is used and the session is detected from the URL for OAuth.
 *
 * Phase 1 has no business tables yet — this only proves the client initializes
 * safely. When Supabase is not configured, `supabase` is `null` and callers
 * must check `isSupabaseConfigured` / use `getSupabase()`.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { env } from '@/lib/env';
import { AppError } from '@/lib/errors';

// The client is left schema-agnostic; the data layer (features/*/api.ts) casts
// query results to the domain types in lib/database.types.ts at the boundary.
export type AppSupabaseClient = SupabaseClient;

function createSupabaseClient(): AppSupabaseClient | null {
  if (!env.isSupabaseConfigured) return null;

  const isWeb = Platform.OS === 'web';

  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      // Native has no browser storage; persist the session in AsyncStorage.
      storage: isWeb ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Only the web build can read a session back from an OAuth redirect URL.
      detectSessionInUrl: isWeb,
    },
  });
}

/** May be null in Phase 1 / before `.env` is filled in. Prefer `getSupabase()`. */
export const supabase = createSupabaseClient();

export const isSupabaseConfigured = env.isSupabaseConfigured;

/**
 * Returns the client or throws a typed config error. Use this in feature code
 * (Phase 2+) so a missing backend fails loudly and consistently.
 */
export function getSupabase(): AppSupabaseClient {
  if (!supabase) {
    throw new AppError('config', {
      messageKey: 'errors.config',
      context: { reason: 'supabase_not_configured' },
    });
  }
  return supabase;
}
