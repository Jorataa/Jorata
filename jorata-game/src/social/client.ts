import { createClient } from '@supabase/supabase-js';
const env = import.meta.env;
export const configured = Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY);
export const supabase = configured && env.VITE_ENABLE_ACCOUNTS === 'true' ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;
export function db() { if (!supabase) throw new Error('Account service is not configured.'); return supabase; }
type ResultData<R> = R extends { data: infer D } ? D : undefined;
export function check<R extends { error: { message: string } | null }>(result: R): ResultData<R> {
  if (result.error) throw new Error(friendlyError(result.error.message));
  return ('data' in result ? result.data : undefined) as ResultData<R>;
}
export function friendlyError(message: string) {
  if (/duplicate key|Database error saving new user/i.test(message)) return 'That username is unavailable or not allowed. Please choose another.';
  if (/Failed to fetch|NetworkError/i.test(message)) return 'Connection interrupted. Please try again.';
  return message;
}
export async function action(name: string, payload: Record<string, unknown> = {}): Promise<{ id?: string; room_id?: string }> {
  return check(await db().rpc('jr_action', { action: name, payload }));
}
