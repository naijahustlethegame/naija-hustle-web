import { createClient } from "@supabase/supabase-js";

/** Used only for sign-in (anonymous). All game data goes through the game server. */
export const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: true, autoRefreshToken: true },
});

let inflight: Promise<string> | null = null;
/** Current access token. getSession() is local and refreshes when needed, so no per-request round trip. */
export function token(): Promise<string> {
  return (inflight ??= (async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) return data.session.access_token;
    const r = await supabase.auth.signInAnonymously();
    if (r.error || !r.data.session) throw new Error("auth");
    return r.data.session.access_token;
  })().finally(() => { inflight = null; }));
}
