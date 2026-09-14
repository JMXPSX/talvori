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

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';
const MAX_HISTORY = 20; // last N turns kept — bounds tokens/cost
const MAX_CHARS = 4000; // per-message clamp

// TAVI's persona. Sent as the system message.
const SYSTEM = [
  "You are TAVI, the calm, warm, and helpful assistant inside Talvori — a household",
  "budgeting and shared-money app. Help people budget, track bills and spending,",
  "plan shared shopping, and understand how to use Talvori. Be concise and practical;",
  "reply in the user's language. You cannot see the user's accounts, balances, or",
  "transactions, so never invent their numbers — if asked about their specific data,",
  "say you can't see it yet and guide them to the relevant screen. You are not a",
  "licensed financial advisor; for major decisions suggest professional advice.",
].join(' ');

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
  try {
    const body = await req.json();
    history = clean(body?.messages);
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (history.length === 0 || history[0].role !== 'user') {
    return json({ error: 'bad_request' }, 400);
  }

  // OpenAI takes the system persona as the first message in the same array.
  const messages = [{ role: 'system', content: SYSTEM }, ...history];

  let res: Response;
  try {
    res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 1024, temperature: 0.4, messages }),
    });
  } catch {
    return json({ error: 'upstream_unreachable' }, 502);
  }

  if (!res.ok) {
    // Surface the status class only — never the raw provider error to the client.
    return json(
      { error: res.status === 429 ? 'rate_limited' : 'upstream_error' },
      res.status === 429 ? 429 : 502,
    );
  }

  const data = await res.json();
  const text = typeof data?.choices?.[0]?.message?.content === 'string'
    ? data.choices[0].message.content.trim()
    : '';
  if (!text) return json({ error: 'empty_response' }, 502);

  return json({ text });
});
