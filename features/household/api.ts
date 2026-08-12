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

export async function listMyHouseholds(): Promise<HouseholdRow[]> {
  const { data, error } = await getSupabase()
    .from('households')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) fail('household.errors.loadFailed', error);
  return data ?? [];
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
