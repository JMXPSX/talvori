/** Data access for FX rate snapshots + the latest-rate view. */

import type { FxRateSnapshotRow, LatestFxRateRow } from '@/lib/database.types';
import { AppError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';

function fail(messageKey: string, cause?: unknown): never {
  throw new AppError('unknown', { messageKey, cause });
}

async function currentUserId(): Promise<string> {
  const { data } = await getSupabase().auth.getUser();
  if (!data.user) throw new AppError('unauthorized', { messageKey: 'errors.unauthorized' });
  return data.user.id;
}

export async function listLatestRates(householdId: string): Promise<LatestFxRateRow[]> {
  const { data, error } = await getSupabase()
    .from('latest_fx_rates')
    .select('*')
    .eq('household_id', householdId);
  if (error) fail('fx.errors.loadFailed', error);
  return (data ?? []) as LatestFxRateRow[];
}

export async function listRateHistory(householdId: string): Promise<FxRateSnapshotRow[]> {
  const { data, error } = await getSupabase()
    .from('fx_rate_snapshots')
    .select('*')
    .eq('household_id', householdId)
    .order('as_of', { ascending: false })
    .limit(50);
  if (error) fail('fx.errors.loadFailed', error);
  return (data ?? []) as FxRateSnapshotRow[];
}

export async function createRate(
  householdId: string,
  input: { baseCurrency: string; quoteCurrency: string; rate: number; asOf?: string },
): Promise<FxRateSnapshotRow> {
  const createdBy = await currentUserId();
  const { data, error } = await getSupabase()
    .from('fx_rate_snapshots')
    .insert({
      household_id: householdId,
      base_currency: input.baseCurrency,
      quote_currency: input.quoteCurrency,
      rate: input.rate,
      as_of: input.asOf ?? new Date().toISOString(),
      source: 'manual',
      created_by: createdBy,
    })
    .select('*')
    .single();
  if (error) fail('fx.errors.rateFailed', error);
  return data as FxRateSnapshotRow;
}

/**
 * Build a lookup from latest rates. Supports the inverse pair automatically
 * (if we have USD->PHP we can convert PHP->USD as 1/rate).
 */
export function makeRateLookup(
  rates: ReadonlyArray<LatestFxRateRow>,
): (from: string, to: string) => number | null {
  const direct = new Map<string, number>();
  for (const r of rates) {
    direct.set(`${r.base_currency}>${r.quote_currency}`, r.rate);
  }
  return (from, to) => {
    const f = from.toUpperCase();
    const tt = to.toUpperCase();
    if (f === tt) return 1;
    const forward = direct.get(`${f}>${tt}`);
    if (forward != null) return forward;
    const inverse = direct.get(`${tt}>${f}`);
    if (inverse != null && inverse !== 0) return 1 / inverse;
    return null;
  };
}
