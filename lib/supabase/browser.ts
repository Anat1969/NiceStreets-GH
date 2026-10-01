"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

let client: SupabaseClient | null = null;

/** The browser's client. The session it keeps lives in cookies the server reads too. */
export function supabaseBrowser(): SupabaseClient {
  if (!client) client = createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  return client;
}

/**
 * Makes sure the resident has an identity before they write anything.
 *
 * A resident never registers: the first time they rate a street or send a
 * photo, the browser signs them in anonymously. The sign-in happens here, in
 * the browser, and not on the server, so the provider's per-address limit
 * applies to each resident and not to the one server all residents share.
 */
export async function ensureResidentSession(): Promise<void> {
  const supabase = supabaseBrowser();
  const { data } = await supabase.auth.getSession();
  if (data.session) return;
  const { error } = await supabase.auth.signInAnonymously();
  if (error) {
    throw new Error("לא הצלחנו לפתוח זהות אנונימית לשמירה. נסו שוב בעוד רגע.");
  }
}
