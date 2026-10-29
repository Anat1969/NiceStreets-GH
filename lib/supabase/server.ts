import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

/**
 * A database client that acts as the person making this request.
 *
 * It carries the visitor's own session from their cookies, so every query
 * runs under their identity and RLS decides what they may read and write:
 * nobody signed in = anon, a resident = their anonymous user, staff = their
 * e-mail user. There is no key on the server that bypasses this.
 *
 * Server components cannot write cookies; a refreshed session is written by
 * the middleware instead, so the failure to set here is expected and ignored.
 */
export async function supabaseServer() {
  const jar = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return jar.getAll();
      },
      setAll(list) {
        try {
          for (const { name, value, options } of list) jar.set(name, value, options);
        } catch {
          // Called from a server component: the middleware refreshes instead.
        }
      },
    },
  });
}
