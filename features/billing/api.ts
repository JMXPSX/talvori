/**
 * Entitlement data access. Reads the household subscription (RLS: members read);
 * setHouseholdPlan calls the owner-checked RPC (6a manual grant). 6b billing
 * writes the same row server-side.
 */

import type { HouseholdSubscriptionRow } from '@/lib/database.types';
import type { PlanCode } from '@/features/billing/plans';
import { AppError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';

function fail(messageKey: string, cause?: unknown): never {
  throw new AppError('unknown', { messageKey, cause });
}

export async function getHouseholdSubscription(
  householdId: string,
): Promise<HouseholdSubscriptionRow | null> {
  const { data, error } = await getSupabase()
    .from('household_subscriptions')
    .select('*')
    .eq('household_id', householdId)
    .maybeSingle();
  if (error) fail('billing.errors.loadFailed', error);
  return (data ?? null) as HouseholdSubscriptionRow | null;
}

export async function setHouseholdPlan(householdId: string, planCode: PlanCode): Promise<void> {
  const { error } = await getSupabase().rpc('set_household_plan', {
    _household_id: householdId,
    _plan_code: planCode,
  });
  if (error) fail('billing.errors.saveFailed', error);
}
