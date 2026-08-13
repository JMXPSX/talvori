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
