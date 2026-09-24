import { LocalStore } from "./local";
import { SupabaseStore } from "./supabase";
import type { DataStore } from "./types";

let instance: DataStore | null = null;

/**
 * Picks the backend: Supabase when the project is configured, otherwise a
 * JSON file under .data/ so the app runs with no external services.
 */
export function getStore(): DataStore {
  if (instance) return instance;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  instance = url && serviceKey ? new SupabaseStore(url, serviceKey) : new LocalStore();
  return instance;
}

export type { DataStore };
