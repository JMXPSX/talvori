/**
 * Notifications data access. Rows are written by DB triggers (migration 19),
 * never the client — this module only reads the feed, counts unread via the
 * watermark RPC, stamps the watermark, and streams inserts over realtime.
 * Household scoping is enforced by RLS.
 */

import type { NotificationRow } from '@/lib/database.types';
import { AppError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';

function fail(messageKey: string, cause?: unknown): never {
  throw new AppError('unknown', { messageKey, cause });
}

/** Most recent notifications for a household (newest first, capped). */
export async function listNotifications(householdId: string): Promise<NotificationRow[]> {
  const { data, error } = await getSupabase()
    .from('notifications')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) fail('notifications.errors.loadFailed', error);
  return (data ?? []) as NotificationRow[];
}

/** Count of feed rows newer than the caller's watermark, excluding their own. */
export async function unreadCount(householdId: string): Promise<number> {
  const { data, error } = await getSupabase().rpc('notifications_unread_count', {
    _household_id: householdId,
  });
  if (error) fail('notifications.errors.loadFailed', error);
  return (data ?? 0) as number;
}

/** Stamp the watermark to now() — call when the list is opened. */
export async function markSeen(householdId: string): Promise<void> {
  const { error } = await getSupabase().rpc('mark_notifications_seen', {
    _household_id: householdId,
  });
  if (error) fail('notifications.errors.saveFailed', error);
}

/** Subscribe to new notifications for a household. Returns an unsubscribe fn. */
export function subscribeToNotifications(
  householdId: string,
  onInsert: (row: NotificationRow) => void,
): () => void {
  const channel = getSupabase()
    .channel(`notifications:${householdId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `household_id=eq.${householdId}` },
      (payload) => onInsert(payload.new as NotificationRow),
    )
    .subscribe();
  return () => {
    void getSupabase().removeChannel(channel);
  };
}
