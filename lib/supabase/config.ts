/**
 * Where the database is and the key that identifies the app to it.
 *
 * Neither is a secret. The publishable key only says "this is the Good Streets
 * app"; what a request may do is decided by the database (RLS) from the
 * signed-in user's session, never from the key. That is why both have a
 * default here and nothing has to be configured in Vercel for them.
 */
const DEFAULT_URL = "https://cbhexpybdggwzyakgagd.supabase.co";
const DEFAULT_PUBLISHABLE_KEY = "sb_publishable_1KSwG6rqTzBSHmI2RxX6Fw_EEcuKzk3";

function clean(value: string | undefined): string {
  return (value ?? "").trim().replace(/^["']|["']$/g, "").trim();
}

export const SUPABASE_URL = clean(process.env.NEXT_PUBLIC_SUPABASE_URL) || DEFAULT_URL;
export const SUPABASE_PUBLISHABLE_KEY =
  clean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) || DEFAULT_PUBLISHABLE_KEY;
