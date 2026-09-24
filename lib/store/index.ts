import { LocalStore } from "./local";
import { SupabaseStore } from "./supabase";
import type { DataStore } from "./types";

let instance: DataStore | null = null;

/**
 * Picks the backend: Supabase when the project is configured, otherwise a
 * JSON file under .data/ so the app runs with no external services.
 *
 * The key is read on the server only and is never sent to the browser, which
 * is why it is not named NEXT_PUBLIC_*. The service-role key is the intended
 * one; SUPABASE_KEY exists so a narrower key can be used while testing.
 */
export function getStore(): DataStore {
  if (instance) return instance;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY;
  instance = url && key ? new SupabaseStore(url, key) : new LocalStore();
  return instance;
}

/** True when the app is backed by Supabase rather than the local JSON file. */
export function storeIsDurable(): boolean {
  return getStore().kind === "supabase";
}

export type { DataStore };
