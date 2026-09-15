// TAVI assistant — Supabase Edge Function (Deno), OpenAI backend.
//
// The OpenAI API key is a SERVER secret and must NEVER reach the client. It lives
// in the function's environment (`supabase secrets set OPENAI_API_KEY=…`), not in
// any EXPO_PUBLIC_* var and not in source. The client calls this via
// `supabase.functions.invoke('assistant-chat', …)`, which forwards the signed-in
// user's JWT; with verify_jwt on (the default) only authenticated households reach it.
//
// Deploy: `supabase functions deploy assistant-chat`
// Model:  gpt-4o-mini (Chat Completions, non-streaming, short replies).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';
const MAX_HISTORY = 20; // last N turns kept — bounds tokens/cost
const MAX_CHARS = 4000; // per-message clamp
const TXN_LIMIT = 15; // recent transactions injected into context

// TAVI's persona. Sent as the system message.
const SYSTEM = [
  "You are TAVI, the calm, warm, and helpful assistant inside Talvori — a household",
  "budgeting and shared-money app. Help people budget, track bills and spending,",
  "plan shared shopping, and understand how to use Talvori. Meal planning is part of",
  "shopping: you may answer recipe and ingredient questions, and when a user asks for",
  "a recipe, meal, or grocery list, use the create_grocery_list tool to build it for",
  "them rather than only replying in text. Be concise and practical;",
  "reply in the user's language. You are given a DATA snapshot of the user's accounts,",
  "balances, and recent transactions — answer questions about their money from it and",
  "never invent figures. If the DATA block is missing or doesn't contain what they ask,",
  "say so plainly and point them to the relevant screen (it shows the last",
  `${TXN_LIMIT} transactions and current balances only, not full history).`,
].join(' ');

// Currencies whose minor-unit exponent isn't the default 2 (mirror of lib/money.ts).
const MINOR_EXPONENTS: Record<string, number> = {
  JPY: 0, KRW: 0, VND: 0, CLP: 0, ISK: 0, BHD: 3, KWD: 3, OMR: 3, TND: 3,
};
function fmtMoney(minor: number, code: string): string {
  const e = MINOR_EXPONENTS[code?.toUpperCase()] ?? 2;
  return `${(minor / 10 ** e).toFixed(e)} ${code}`;
}

// deno-lint-ignore no-explicit-any
type Db = any;

/**
 * Supabase client scoped to the CALLER: their JWT is forwarded as-is, so every
 * query/insert runs under their RLS policies — the function grants no new access.
 * Returns null when we lack the header or env to build one (chat still works).
 */
function callerDb(authHeader: string | null): Db {
  if (!authHeader) return null;
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anon) return null;
  return createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
}

/**
 * Build a compact text snapshot of the household's money for TAVI's context.
 * Returns '' on any failure or missing input so chat still works without data.
 */
async function financeSnapshot(db: Db, householdId: string): Promise<string> {
  try {
    const [accounts, balances, txns] = await Promise.all([
      db.from('accounts').select('id,name,type').eq('household_id', householdId).eq('is_archived', false),
      db.from('account_balances').select('account_id,balance_minor,currency_code').eq('household_id', householdId),
      db.from('transactions')
        .select('occurred_at,type,amount_minor,currency_code,description,category:categories(name)')
        .eq('household_id', householdId)
        .order('occurred_at', { ascending: false })
        .limit(TXN_LIMIT),
    ]);
    const bal = new Map((balances.data ?? []).map((b) => [b.account_id, b]));
    const acctLines = (accounts.data ?? []).map((a) => {
      const b = bal.get(a.id);
      const amount = b ? fmtMoney(b.balance_minor, b.currency_code) : '—';
      return `- ${a.name} (${a.type}): ${amount}`;
    });
    const txnLines = (txns.data ?? []).map((t) => {
      const cat = (t.category as { name?: string } | null)?.name ?? 'uncategorised';
      const date = String(t.occurred_at).slice(0, 10);
      const desc = t.description ? ` — ${t.description}` : '';
      return `- ${date} ${t.type} ${fmtMoney(t.amount_minor, t.currency_code)} [${cat}]${desc}`;
    });
    if (acctLines.length === 0 && txnLines.length === 0) return '';
    return [
      'DATA (the user\'s current household finances):',
      acctLines.length ? `Accounts & balances:\n${acctLines.join('\n')}` : 'No accounts yet.',
      txnLines.length ? `Recent transactions (newest first):\n${txnLines.join('\n')}` : 'No transactions yet.',
    ].join('\n\n');
  } catch (e) {
    console.error(`snapshot failed: ${e}`);
    return '';
  }
}

const MAX_ITEMS = 50; // bound how many rows one request can insert

// The one tool TAVI can call: create a shopping list and populate it. Offered to
// the model only when we have a caller DB + household to write into.
const GROCERY_TOOL = {
  type: 'function',
  function: {
    name: 'create_grocery_list',
    description:
      'Create a new shopping/grocery list in the household and add items to it. ' +
      'Call this whenever the user asks to generate, build, or make a grocery/shopping list.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Short list title, e.g. "Weekly groceries".' },
        items: {
          type: 'array',
          description: 'The items to add.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Item name, e.g. "Milk".' },
              quantity: { type: 'number', description: 'How many; defaults to 1.' },
              unit: { type: 'string', description: 'Optional unit, e.g. "kg", "loaf".' },
            },
            required: ['name'],
          },
        },
      },
      required: ['name', 'items'],
    },
  },
};

interface GroceryArgs {
  name?: unknown;
  items?: unknown;
}

/**
 * Insert a grocery list + its items as the caller (RLS-checked). Items beyond
 * MAX_ITEMS are dropped; blank names skipped; non-positive quantities become 1
 * (the DB CHECK requires quantity > 0). Returns a small result for the model.
 */
async function createGroceryList(
  db: Db,
  householdId: string,
  args: GroceryArgs,
): Promise<{ ok: boolean; list?: string; items_added?: number; dropped?: number; error?: string }> {
  const name = typeof args?.name === 'string' && args.name.trim() ? args.name.trim() : 'Shopping list';
  const rawItems = Array.isArray(args?.items) ? args.items : [];
  const clean = rawItems
    .map((it) => {
      const n = typeof (it as { name?: unknown })?.name === 'string' ? (it as { name: string }).name.trim() : '';
      const qRaw = Number((it as { quantity?: unknown })?.quantity);
      const q = Number.isFinite(qRaw) && qRaw > 0 ? qRaw : 1;
      const u = typeof (it as { unit?: unknown })?.unit === 'string' ? (it as { unit: string }).unit.trim() : null;
      return n ? { name: n, quantity: q, unit: u || null } : null;
    })
    .filter((x): x is { name: string; quantity: number; unit: string | null } => x !== null);

  if (clean.length === 0) return { ok: false, error: 'no valid items provided' };
  const dropped = Math.max(0, clean.length - MAX_ITEMS);
  const items = clean.slice(0, MAX_ITEMS);

  const { data: user } = await db.auth.getUser();
  const uid = user?.user?.id;
  if (!uid) return { ok: false, error: 'not authenticated' };

  const { data: hh } = await db
    .from('households')
    .select('reporting_currency_code')
    .eq('id', householdId)
    .maybeSingle();
  const currency = hh?.reporting_currency_code ?? 'USD';

  const { data: list, error: listErr } = await db
    .from('grocery_lists')
    .insert({ household_id: householdId, name, currency_code: currency, created_by: uid })
    .select('id')
    .single();
  if (listErr || !list) {
    console.error(`grocery list insert failed: ${listErr?.message}`);
    return { ok: false, error: 'could not create the list' };
  }

  // household_id is set by the grocery_items_enforce_list trigger from the list.
  const rows = items.map((it, i) => ({
    list_id: list.id,
    household_id: '00000000-0000-0000-0000-000000000000',
    name: it.name,
    quantity: it.quantity,
    unit: it.unit,
    sort_order: i,
    added_by: uid,
  }));
  const { error: itemErr } = await db.from('grocery_items').insert(rows);
  if (itemErr) {
    console.error(`grocery items insert failed: ${itemErr.message}`);
    return { ok: false, list: name, error: 'the list was created but items failed to save' };
  }
  return { ok: true, list: name, items_added: items.length, ...(dropped ? { dropped } : {}) };
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Role = 'user' | 'assistant';
interface Msg {
  role: Role;
  content: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

/** Keep only well-formed {role,content} turns, clamp length, cap history. */
function clean(input: unknown): Msg[] {
  if (!Array.isArray(input)) return [];
  const out: Msg[] = [];
  for (const m of input) {
    const role = (m as Msg)?.role;
    const content = (m as Msg)?.content;
    if ((role === 'user' || role === 'assistant') && typeof content === 'string' && content.trim()) {
      out.push({ role, content: content.slice(0, MAX_CHARS) });
    }
  }
  return out.slice(-MAX_HISTORY);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return json({ error: 'not_configured' }, 500);

  let history: Msg[];
  let householdId: unknown;
  try {
    const body = await req.json();
    history = clean(body?.messages);
    householdId = body?.householdId;
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (history.length === 0 || history[0].role !== 'user') {
    return json({ error: 'bad_request' }, 400);
  }

  // Caller-scoped DB + a usable household id gate both the finance snapshot and
  // the grocery tool: without them TAVI is a plain chat with no data access.
  const db = callerDb(req.headers.get('Authorization'));
  const hid = typeof householdId === 'string' && householdId ? householdId : null;
  const canWrite = Boolean(db && hid);

  console.log(`chat: canWrite=${canWrite} household=${hid ? 'yes' : 'no'}`);

  const snapshot = canWrite ? await financeSnapshot(db, hid as string) : '';
  const system = snapshot ? `${SYSTEM}\n\n${snapshot}` : SYSTEM;

  // OpenAI takes the system persona as the first message in the same array.
  // deno-lint-ignore no-explicit-any
  const messages: any[] = [{ role: 'system', content: system }, ...history];

  const call = (extra: Record<string, unknown>) =>
    fetch(OPENAI_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 1024, temperature: 0.4, messages, ...extra }),
    });
  const upstreamError = (res: Response) =>
    json({ error: res.status === 429 ? 'rate_limited' : 'upstream_error' }, res.status === 429 ? 429 : 502);

  try {
    // First turn: offer the grocery tool only when we can actually write.
    let res = await call(canWrite ? { tools: [GROCERY_TOOL], tool_choice: 'auto' } : {});
    if (!res.ok) {
      console.error(`OpenAI ${res.status}: ${await res.text()}`);
      return upstreamError(res);
    }
    let msg = (await res.json())?.choices?.[0]?.message;

    // If the model asked to build a list, run it, feed results back, ask for the reply.
    const toolCalls = Array.isArray(msg?.tool_calls) ? msg.tool_calls : [];
    console.log(`chat: toolCalls=${toolCalls.length}`);
    if (canWrite && toolCalls.length > 0) {
      messages.push(msg);
      for (const tc of toolCalls) {
        let result: unknown = { ok: false, error: 'unknown tool' };
        if (tc?.function?.name === 'create_grocery_list') {
          let parsed: GroceryArgs = {};
          try { parsed = JSON.parse(tc.function.arguments ?? '{}'); } catch { /* bad args */ }
          result = await createGroceryList(db, hid as string, parsed);
        }
        console.log(`tool ${tc?.function?.name} -> ${JSON.stringify(result)}`);
        messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
      }
      // Second turn: force a natural-language reply. tools must still be present
      // when tool_choice is set (OpenAI 400s otherwise); 'none' forbids re-calling.
      res = await call({ tools: [GROCERY_TOOL], tool_choice: 'none' });
      if (!res.ok) {
        console.error(`OpenAI ${res.status}: ${await res.text()}`);
        return upstreamError(res);
      }
      msg = (await res.json())?.choices?.[0]?.message;
    }

    const text = typeof msg?.content === 'string' ? msg.content.trim() : '';
    if (!text) return json({ error: 'empty_response' }, 502);
    return json({ text });
  } catch {
    return json({ error: 'upstream_unreachable' }, 502);
  }
});
