/** Account data access: the self-service deletion RPC. */

import { AppError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';

/**
 * Permanently delete the signed-in user's account via delete_my_account().
 * Refused (forbidden) while the user owns a household other members still use.
 */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await getSupabase().rpc('delete_my_account');
  if (!error) return;
  if ((error.message ?? '').includes('owner_handoff_required')) {
    throw new AppError('forbidden', {
      messageKey: 'account.errors.ownerHandoff',
      cause: error,
    });
  }
  throw new AppError('unknown', { messageKey: 'account.errors.deleteFailed', cause: error });
}

/**
 * Upload the user's profile photo to the public `avatars` bucket under their own
 * {uid}/ folder (RLS-enforced) and return its public URL. A stable path + upsert
 * replaces any prior photo; a cache-busting query param forces surfaces to refetch.
 * ArrayBuffer upload is the portable path across web + native (avoids RN's
 * empty-Blob pitfall).
 */
export async function uploadAvatar(
  userId: string,
  asset: { uri: string; mimeType?: string | null },
): Promise<string> {
  const sb = getSupabase();
  const bytes = await (await fetch(asset.uri)).arrayBuffer();
  const path = `${userId}/avatar`;
  const { error } = await sb.storage
    .from('avatars')
    .upload(path, bytes, { contentType: asset.mimeType ?? 'image/jpeg', upsert: true });
  if (error) throw new AppError('unknown', { messageKey: 'account.errors.photoFailed', cause: error });
  const { data } = sb.storage.from('avatars').getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}
