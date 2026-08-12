// ============================================================================
// RLS isolation integration test — Phase 2 exit criteria.
// Proves: "Household A cannot be read or written by a user who isn't a member."
//
// This is NOT a unit test (it hits the live project + needs elevated setup), so
// it runs standalone, not under jest:
//
//   node tests/integration/rls-isolation.mjs
//
// Requirements in .env (git-ignored):
//   EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
//   SUPABASE_SERVICE_ROLE_KEY   <- add temporarily to create/confirm test users
//
// The service-role key is used ONLY here to create two confirmed users and to
// clean them up afterwards. It must NEVER appear in client code or EXPO_PUBLIC_*.
// ============================================================================

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// --- tiny .env loader (no dependency) ---------------------------------------
function loadEnv() {
  const env = { ...process.env };
  try {
    const text = readFileSync(new URL('../../.env', import.meta.url), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
    }
  } catch {
    /* .env optional if vars already in process.env */
  }
  return env;
}

const env = loadEnv();
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_ || !ANON) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  process.exit(1);
}
if (!SERVICE) {
  console.error(
    'Missing SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Add it to .env temporarily (Dashboard → Project Settings → API → service_role).\n' +
      'It is only used to create/delete the two test users. Remove it when done.',
  );
  process.exit(1);
}

// --- assertion helpers ------------------------------------------------------
let passed = 0;
let failed = 0;
function ok(name, condition) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}`);
  }
}

const admin = createClient(URL_, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function userClient() {
  return createClient(URL_, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const stamp = Date.now();
const userA = { email: `rls-a-${stamp}@example.com`, password: 'Password123!' };
const userB = { email: `rls-b-${stamp}@example.com`, password: 'Password123!' };
let idA;
let idB;

async function createConfirmedUser(u) {
  const { data, error } = await admin.auth.admin.createUser({
    email: u.email,
    password: u.password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser failed: ${error.message}`);
  return data.user.id;
}

async function signedInClient(u) {
  const client = userClient();
  const { error } = await client.auth.signInWithPassword(u);
  if (error) throw new Error(`sign-in failed for ${u.email}: ${error.message}`);
  return client;
}

async function main() {
  console.log('RLS isolation test\n------------------');

  idA = await createConfirmedUser(userA);
  idB = await createConfirmedUser(userB);

  const a = await signedInClient(userA);
  const b = await signedInClient(userB);

  // A creates a household (becomes owner via RPC).
  const { data: household, error: createErr } = await a.rpc('create_household', {
    _name: 'A Household',
    _reporting_currency_code: 'PHP',
  });
  ok('A can create a household', !createErr && household?.id);
  const hid = household?.id;

  // Trigger created A's profile.
  const { data: profA } = await a.from('profiles').select('id').eq('id', idA).maybeSingle();
  ok('signup auto-created profile for A', profA?.id === idA);

  // A can read own household + membership.
  const { data: aHouseholds } = await a.from('households').select('id');
  ok('A can read own household', (aHouseholds ?? []).some((h) => h.id === hid));

  // B CANNOT read A's household.
  const { data: bSeesHousehold } = await b.from('households').select('id').eq('id', hid);
  ok('B cannot read A\'s household (RLS)', (bSeesHousehold ?? []).length === 0);

  // B CANNOT read A's members.
  const { data: bSeesMembers } = await b
    .from('household_members')
    .select('user_id')
    .eq('household_id', hid);
  ok('B cannot read A\'s members (RLS)', (bSeesMembers ?? []).length === 0);

  // B CANNOT add itself to A's household.
  const { error: bInsertErr } = await b
    .from('household_members')
    .insert({ household_id: hid, user_id: idB, role: 'owner' });
  ok('B cannot insert a member into A\'s household', Boolean(bInsertErr));

  // B CANNOT update A's household (0 rows affected under RLS, so re-read unchanged).
  await b.from('households').update({ name: 'HACKED' }).eq('id', hid);
  const { data: afterUpdate } = await a.from('households').select('name').eq('id', hid).single();
  ok('B cannot rename A\'s household', afterUpdate?.name === 'A Household');

  // B CANNOT create an invitation into A's household.
  const { error: bInviteErr } = await b.from('household_invitations').insert({
    household_id: hid,
    email: 'someone@example.com',
    invited_by: idB,
  });
  ok('B cannot invite into A\'s household', Boolean(bInviteErr));

  // Positive path: A invites B, B accepts, B becomes a member.
  const { error: inviteErr } = await a.from('household_invitations').insert({
    household_id: hid,
    email: userB.email,
    invited_by: idA,
    role: 'member',
  });
  ok('A can invite B', !inviteErr);

  const { data: inv } = await a
    .from('household_invitations')
    .select('token')
    .eq('household_id', hid)
    .eq('email', userB.email)
    .single();
  const { error: acceptErr } = await b.rpc('accept_invitation', { _token: inv?.token });
  ok('B can accept the invitation', !acceptErr);

  const { data: bNowSees } = await b.from('households').select('id').eq('id', hid);
  ok('B can read the household after joining', (bNowSees ?? []).length === 1);
}

async function cleanup() {
  if (idA) await admin.auth.admin.deleteUser(idA);
  if (idB) await admin.auth.admin.deleteUser(idB);
}

main()
  .catch((err) => {
    failed++;
    console.error('\nUnexpected error:', err.message);
  })
  .finally(async () => {
    await cleanup();
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed === 0 ? 0 : 1);
  });
