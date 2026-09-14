/**
 * TAVI assistant — data access (see the strict data-boundary rule in CLAUDE.md:
 * only feature api.ts touches the Supabase client). The Claude call itself runs
 * in the `assistant-chat` Edge Function so the API key stays server-side; here we
 * just invoke it with the conversation so far and return the reply text.
 */

import { AppError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** Send the conversation to TAVI and return its reply. Throws a typed AppError. */
export async function sendChat(history: ChatMessage[]): Promise<string> {
  const { data, error } = await getSupabase().functions.invoke('assistant-chat', {
    body: { messages: history },
  });
  if (error) {
    throw new AppError('network', { messageKey: 'assistant.error', cause: error });
  }
  const text = (data as { text?: unknown } | null)?.text;
  if (typeof text !== 'string' || !text) {
    throw new AppError('unknown', { messageKey: 'assistant.error', context: { reason: 'bad_response' } });
  }
  return text;
}
