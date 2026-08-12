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

  // --- finance: A sets up an account and records an expense ------------------
  const { data: acc, error: accErr } = await a
    .from('accounts')
    .insert({ household_id: hid, name: 'Cash', currency_code: 'PHP', created_by: idA })
    .select('*')
    .single();
  ok('A can create an account', !accErr && Boolean(acc?.id));
  const accId = acc?.id;

  const { error: exErr } = await a.from('transactions').insert({
    household_id: hid,
    account_id: accId,
    type: 'expense',
    direction: 'out',
    amount_minor: 10000, // 100.00 PHP
    currency_code: 'PHP',
    created_by: idA,
  });
  ok('A can record an expense', !exErr);

  const { data: bal } = await a
    .from('account_balances')
    .select('balance_minor')
    .eq('account_id', accId)
    .single();
  ok('account_balances reflects the expense (-10000)', bal?.balance_minor === -10000);

  // A creates a second account and transfers 40.00 PHP into it (two legs).
  const { data: acc2 } = await a
    .from('accounts')
    .insert({ household_id: hid, name: 'Wallet', currency_code: 'PHP', created_by: idA })
    .select('*')
    .single();
  const { error: trErr } = await a.rpc('create_transfer', {
    _from_account: accId,
    _to_account: acc2?.id,
    _from_amount_minor: 4000,
    _to_amount_minor: 4000,
  });
  ok('A can transfer between own accounts', !trErr);
  const { data: legs } = await a
    .from('transactions')
    .select('id')
    .eq('type', 'transfer');
  ok('transfer created two legs', (legs ?? []).length === 2);

  // A sets up a savings goal (+contribution) and a debt (+payment).
  const { data: goal } = await a
    .from('savings_goals')
    .insert({ household_id: hid, name: 'Emergency', currency_code: 'PHP', target_minor: 100000, created_by: idA })
    .select('*')
    .single();
  await a
    .from('goal_contributions')
    .insert({ goal_id: goal?.id, household_id: hid, amount_minor: 25000, created_by: idA });
  const { data: gs } = await a
    .from('savings_goal_status')
    .select('saved_minor')
    .eq('goal_id', goal?.id)
    .single();
  ok('goal status reflects contribution (25000)', gs?.saved_minor === 25000);

  const { data: debt } = await a
    .from('debts')
    .insert({ household_id: hid, name: 'Loan', currency_code: 'PHP', principal_minor: 500000, created_by: idA })
    .select('*')
    .single();
  await a
    .from('debt_payments')
    .insert({ debt_id: debt?.id, household_id: hid, amount_minor: 100000, created_by: idA });
  const { data: ds } = await a
    .from('debt_status')
    .select('balance_minor')
    .eq('debt_id', debt?.id)
    .single();
  ok('debt status reflects payment (balance 400000)', ds?.balance_minor === 400000);

  // A records an FX rate snapshot; latest_fx_rates surfaces it.
  await a.from('fx_rate_snapshots').insert({
    household_id: hid,
    base_currency: 'USD',
    quote_currency: 'PHP',
    rate: 56.5,
    created_by: idA,
  });
  const { data: lr } = await a
    .from('latest_fx_rates')
    .select('rate')
    .eq('household_id', hid)
    .eq('base_currency', 'USD')
    .eq('quote_currency', 'PHP')
    .single();
  ok('latest_fx_rates returns the rate (56.5)', Number(lr?.rate) === 56.5);

  // --- grocery: A creates a list + item -------------------------------------
  const { data: gl, error: glErr } = await a
    .from('grocery_lists')
    .insert({ household_id: hid, name: 'Weekly', currency_code: 'PHP', created_by: idA })
    .select('id')
    .single();
  ok('A can create a grocery list', !glErr && Boolean(gl?.id));
  const listId = gl?.id;

  const { data: gi, error: giErr } = await a
    .from('grocery_items')
    .insert({
      list_id: listId,
      household_id: '00000000-0000-0000-0000-000000000000', // overwritten by trigger
      name: 'Rice',
      quantity: 2,
      estimated_price_minor: 30000,
      added_by: idA,
    })
    .select('id, household_id')
    .single();
  ok('A can add an item; trigger sets household_id', !giErr && gi?.household_id === hid);

  // Mark purchased with an actual price, then complete the trip.
  await a
    .from('grocery_items')
    .update({ is_purchased: true, purchased_by: idA, actual_price_minor: 28500 })
    .eq('id', gi?.id);
  const { data: txId, error: coErr } = await a.rpc('complete_grocery_list', {
    _list_id: listId,
    _account_id: accId,
    _category_id: null,
  });
  ok('A can complete the trip (checkout RPC)', !coErr && Boolean(txId));

  const { data: coTx } = await a
    .from('transactions')
    .select('amount_minor, type')
    .eq('id', txId)
    .single();
  ok(
    'checkout created one expense equal to purchased sum (28500)',
    coTx?.type === 'expense' && coTx?.amount_minor === 28500,
  );

  // A second list in a different currency cannot check out against a PHP account.
  const { data: gl2 } = await a
    .from('grocery_lists')
    .insert({ household_id: hid, name: 'USD trip', currency_code: 'USD', created_by: idA })
    .select('id')
    .single();
  await a.from('grocery_items').insert({
    list_id: gl2?.id,
    household_id: '00000000-0000-0000-0000-000000000000',
    name: 'Item',
    quantity: 1,
    is_purchased: true,
    purchased_by: idA,
    actual_price_minor: 500,
    added_by: idA,
  });
  const { error: mismatchErr } = await a.rpc('complete_grocery_list', {
    _list_id: gl2?.id,
    _account_id: accId, // PHP account
    _category_id: null,
  });
  ok('checkout rejects account/list currency mismatch', Boolean(mismatchErr));

  // --- retail: A builds a small catalog -------------------------------------
  const { data: ret, error: retErr } = await a
    .from('retailers')
    .insert({ household_id: hid, name: 'MegaMart', country_code: 'PH', created_by: idA })
    .select('id').single();
  ok('A can create a retailer', !retErr && Boolean(ret?.id));

  const { data: store, error: stErr } = await a
    .from('retailer_stores')
    .insert({ household_id: hid, retailer_id: ret?.id, name: 'MegaMart Makati',
      currency_code: 'PHP', latitude: 14.55, longitude: 121.02, created_by: idA })
    .select('id, currency_code').single();
  ok('A can create a store', !stErr && Boolean(store?.id));

  const { data: prod } = await a
    .from('products')
    .insert({ household_id: hid, name: 'Rice 5kg', size_value: 5, size_unit: 'kg', pack_count: 1, created_by: idA })
    .select('id').single();
  const { data: rp } = await a
    .from('retailer_products')
    .insert({ household_id: hid, product_id: prod?.id, retailer_id: ret?.id, created_by: idA })
    .select('id').single();
  ok('A can link a product to a retailer', Boolean(rp?.id));

  // Price with a USD currency but a PHP store — trigger must force PHP.
  const { data: price } = await a
    .from('price_snapshots')
    .insert({ household_id: hid, retailer_product_id: rp?.id, store_id: store?.id,
      regular_price_minor: 25000, currency_code: 'USD', created_by: idA })
    .select('currency_code').single();
  ok('price currency follows the store (PHP, not USD)', price?.currency_code === 'PHP');

  // Saved location + set-active RPC.
  const { data: loc } = await a
    .from('saved_locations')
    .insert({ household_id: hid, label: 'Home', store_id: store?.id, created_by: idA })
    .select('id').single();
  const { error: activeErr } = await a.rpc('set_active_saved_location', { _id: loc?.id });
  ok('A can set a saved location active (RPC)', !activeErr);
  const { data: activeLoc } = await a
    .from('saved_locations').select('is_active').eq('id', loc?.id).single();
  ok('saved location is now active', activeLoc?.is_active === true);

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

  // B CANNOT read A's accounts or transactions (not a member yet).
  const { data: bAccs } = await b.from('accounts').select('id').eq('household_id', hid);
  ok('B cannot read A\'s accounts (RLS)', (bAccs ?? []).length === 0);
  const { data: bTx } = await b.from('transactions').select('id').eq('household_id', hid);
  ok('B cannot read A\'s transactions (RLS)', (bTx ?? []).length === 0);

  // B CANNOT record a transaction against A's account.
  const { error: bTxErr } = await b.from('transactions').insert({
    household_id: hid,
    account_id: accId,
    type: 'expense',
    direction: 'out',
    amount_minor: 1,
    currency_code: 'PHP',
    created_by: idB,
  });
  ok('B cannot write a transaction into A\'s household', Boolean(bTxErr));

  // B CANNOT read A's savings goals or debts (not a member yet).
  const { data: bGoals } = await b.from('savings_goals').select('id').eq('household_id', hid);
  ok('B cannot read A\'s savings goals (RLS)', (bGoals ?? []).length === 0);
  const { data: bDebts } = await b.from('debts').select('id').eq('household_id', hid);
  ok('B cannot read A\'s debts (RLS)', (bDebts ?? []).length === 0);
  const { data: bFx } = await b.from('fx_rate_snapshots').select('id').eq('household_id', hid);
  ok('B cannot read A\'s FX rates (RLS)', (bFx ?? []).length === 0);

  // B CANNOT read or write A's grocery lists/items (not a member yet).
  const { data: bLists } = await b.from('grocery_lists').select('id').eq('household_id', hid);
  ok("B cannot read A's grocery lists (RLS)", (bLists ?? []).length === 0);
  const { data: bItems } = await b.from('grocery_items').select('id').eq('household_id', hid);
  ok("B cannot read A's grocery items (RLS)", (bItems ?? []).length === 0);
  const { error: bListErr } = await b
    .from('grocery_lists')
    .insert({ household_id: hid, name: 'X', currency_code: 'PHP', created_by: idB });
  ok("B cannot create a list in A's household", Boolean(bListErr));
  const { error: bCoErr } = await b.rpc('complete_grocery_list', {
    _list_id: listId,
    _account_id: accId,
    _category_id: null,
  });
  ok("B cannot complete A's list via RPC", Boolean(bCoErr));

  // B CANNOT read or write A's retail catalog (not a member yet).
  const { data: bRet } = await b.from('retailers').select('id').eq('household_id', hid);
  ok("B cannot read A's retailers (RLS)", (bRet ?? []).length === 0);
  const { data: bPrices } = await b.from('price_snapshots').select('id').eq('household_id', hid);
  ok("B cannot read A's prices (RLS)", (bPrices ?? []).length === 0);
  const { error: bRetErr } = await b
    .from('retailers')
    .insert({ household_id: hid, name: 'X', created_by: idB });
  ok("B cannot create a retailer in A's household", Boolean(bRetErr));
  const { error: bActErr } = await b.rpc('set_active_saved_location', { _id: loc?.id });
  ok("B cannot set-active A's location via RPC", Boolean(bActErr));

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

  // After joining, B can read the shared accounts too.
  const { data: bAccsAfter } = await b.from('accounts').select('id').eq('household_id', hid);
  ok('B can read accounts after joining', (bAccsAfter ?? []).length === 2);

  // After joining, B can also read the shared grocery lists.
  const { data: bListsAfter } = await b.from('grocery_lists').select('id').eq('household_id', hid);
  ok('B can read grocery lists after joining', (bListsAfter ?? []).length >= 1);

  const { data: bRetAfter } = await b.from('retailers').select('id').eq('household_id', hid);
  ok('B can read retailers after joining', (bRetAfter ?? []).length >= 1);

  // --- realtime: B (now a member) receives A's item insert live -------------
  // Resolves the instant the change arrives; the timeout is only a failsafe
  // ceiling for the initial WebSocket handshake (cold connect in Node is slow).
  const received = await new Promise((resolve) => {
    let done = false;
    const finish = (v) => {
      if (!done) {
        done = true;
        resolve(v);
      }
    };
    b.channel(`test_items:${listId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'grocery_items', filter: `list_id=eq.${listId}` },
        () => finish(true),
      )
      .subscribe(async (status, err) => {
        if (err) console.log(`    [realtime] channel status ${status}: ${err.message}`);
        if (status === 'SUBSCRIBED') {
          const { error: insErr } = await a.from('grocery_items').insert({
            list_id: listId,
            household_id: '00000000-0000-0000-0000-000000000000',
            name: 'Live item',
            quantity: 1,
            added_by: idA,
          });
          if (insErr) console.log(`    [realtime] A insert failed: ${insErr.message}`);
        }
      });
    setTimeout(() => finish(false), 15000);
  });
  ok("realtime delivers A's insert to member B within 15s", received === true);
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
