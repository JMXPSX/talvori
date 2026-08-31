/**
 * Household data access. All calls go through the RLS-protected Supabase client;
 * the database — not this code — enforces who can see/modify what. Errors are
 * normalized to AppError so screens render localized messages.
 *
 * Note on invites: creating an invitation stores a tokened row but does NOT send
 * an email yet (transactional invite email is a later Edge Function). For now the
 * inviter shares the token/link and the invitee accepts it while signed in with
 * the invited email address.
 */

import type {
  HouseholdInvitationRow,
  HouseholdMemberRow,
  HouseholdRole,
  HouseholdRow,
  ProfileRow,
} from '@/lib/database.types';
import { AppError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import type { CreateHouseholdInput, InviteMemberInput } from '@/features/household/schemas';

/** A member row joined (client-side) with the person's profile for display. */
export interface MemberWithProfile extends HouseholdMemberRow {
  profile: Pick<ProfileRow, 'id' | 'email' | 'display_name'> | null;
}

function fail(messageKey: string, cause?: unknown): never {
  throw new AppError('unknown', { messageKey, cause });
}

async function currentUserId(): Promise<string> {
  const { data } = await getSupabase().auth.getUser();
  if (!data.user) throw new AppError('unauthorized', { messageKey: 'errors.unauthorized' });
  return data.user.id;
}

export async function createHousehold(input: CreateHouseholdInput): Promise<HouseholdRow> {
  const { data, error } = await getSupabase().rpc('create_household', {
    _name: input.name,
    _reporting_currency_code: input.reportingCurrencyCode,
    _is_cross_border: input.isCrossBorder,
  });
  if (error) fail('household.errors.createFailed', error);
  return data as HouseholdRow;
}

/**
 * Join a household by its standing code (§5.4). The RPC (migration 15) adds the
 * caller as an active member and returns the household. Two expected failures are
 * mapped to their own message keys so the screen can show the spec copy:
 *   • P0002 — no household has that code
 *   • P0003 — the caller is already a member
 */
export async function joinHouseholdByCode(code: string): Promise<HouseholdRow> {
  const { data, error } = await getSupabase().rpc('join_household_by_code', {
    _code: code.trim().toUpperCase(),
  });
  if (error) {
    if (error.code === 'P0002') fail('household.errors.codeNotFound', error);
    if (error.code === 'P0003') fail('household.errors.alreadyMember', error);
    fail('household.errors.joinFailed', error);
  }
  return data as HouseholdRow;
}

/** Toggle cross-border tracking (§6.11). RLS narrows the update to owner/admin. */
export async function setCrossBorder(householdId: string, value: boolean): Promise<void> {
  const { error } = await getSupabase()
    .from('households')
    .update({ is_cross_border: value })
    .eq('id', householdId);
  if (error) fail('household.errors.saveFailed', error);
}

export async function listMyHouseholds(): Promise<HouseholdRow[]> {
  const { data, error } = await getSupabase()
    .from('households')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) fail('household.errors.loadFailed', error);
  return data ?? [];
}

/** Active-member count per household the caller belongs to (§6.4 switcher rows).
 *  One RLS-scoped query — members_select only returns your households' members. */
export async function listMyMemberCounts(): Promise<Record<string, number>> {
  const { data, error } = await getSupabase()
    .from('household_members')
    .select('household_id')
    .eq('status', 'active');
  if (error) fail('household.errors.loadFailed', error);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) counts[row.household_id] = (counts[row.household_id] ?? 0) + 1;
  return counts;
}

/** The caller's role in each household they belong to (for the manage screen). */
export async function listMyRoles(): Promise<Record<string, HouseholdRole>> {
  const uid = await currentUserId();
  const { data, error } = await getSupabase()
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', uid)
    .eq('status', 'active');
  if (error) fail('household.errors.loadFailed', error);
  return Object.fromEntries((data ?? []).map((r) => [r.household_id, r.role as HouseholdRole]));
}

/** Leave a household (remove own membership). Blocked by the DB for a last owner. */
export async function leaveHousehold(householdId: string): Promise<void> {
  const uid = await currentUserId();
  const { error } = await getSupabase()
    .from('household_members')
    .delete()
    .eq('household_id', householdId)
    .eq('user_id', uid);
  if (error) fail('household.errors.leaveFailed', error);
}

/** Delete a household and (via FK cascade) all its data. RLS narrows to owners. */
export async function deleteHousehold(householdId: string): Promise<void> {
  const { error } = await getSupabase().from('households').delete().eq('id', householdId);
  if (error) fail('household.errors.deleteFailed', error);
}

export async function getHousehold(id: string): Promise<HouseholdRow | null> {
  const { data, error } = await getSupabase()
    .from('households')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) fail('household.errors.loadFailed', error);
  return data ?? null;
}

export async function listMembers(householdId: string): Promise<MemberWithProfile[]> {
  const supabase = getSupabase();
  const { data: members, error } = await supabase
    .from('household_members')
    .select('*')
    .eq('household_id', householdId)
    .eq('status', 'active');
  if (error) fail('household.errors.loadFailed', error);

  const rows = members ?? [];
  const ids = rows.map((m) => m.user_id);
  const profilesById = new Map<string, Pick<ProfileRow, 'id' | 'email' | 'display_name'>>();

  if (ids.length > 0) {
    // No FK between household_members and profiles, so join client-side.
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, display_name')
      .in('id', ids);
    for (const p of profiles ?? []) profilesById.set(p.id, p);
  }

  return rows.map((m) => ({ ...m, profile: profilesById.get(m.user_id) ?? null }));
}

export async function inviteMember(
  householdId: string,
  input: InviteMemberInput,
): Promise<HouseholdInvitationRow> {
  const invitedBy = await currentUserId();
  const { data, error } = await getSupabase()
    .from('household_invitations')
    .insert({
      household_id: householdId,
      email: input.email.toLowerCase(),
      role: input.role,
      invited_by: invitedBy,
    })
    .select('*')
    .single();
  if (error) fail('household.errors.inviteFailed', error);
  return data as HouseholdInvitationRow;
}

export async function listPendingInvitations(
  householdId: string,
): Promise<HouseholdInvitationRow[]> {
  const { data, error } = await getSupabase()
    .from('household_invitations')
    .select('*')
    .eq('household_id', householdId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) fail('household.errors.loadFailed', error);
  return data ?? [];
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('household_invitations')
    .update({ status: 'revoked' })
    .eq('id', invitationId);
  if (error) fail('household.errors.revokeFailed', error);
}

export async function acceptInvitation(token: string): Promise<HouseholdMemberRow> {
  const { data, error } = await getSupabase().rpc('accept_invitation', { _token: token });
  if (error) fail('household.errors.acceptFailed', error);
  return data as HouseholdMemberRow;
}
