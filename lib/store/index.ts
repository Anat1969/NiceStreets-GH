import { LocalStore } from "./local";
import { SupabaseStore } from "./supabase";
import type { DataStore } from "./types";

let instance: DataStore | null = null;
let configError: string | null = null;

/**
 * Picks the backend: Supabase always, unless LOCAL_STORE=1 asks for the JSON
 * file under .data/ (offline development only).
 *
 * No key has to be configured. The client carries the publishable key and the
 * visitor's own session (lib/supabase), and the database decides from that
 * session what the request may do. A server key that bypasses those rules is
 * deliberately not used anywhere in the app.
 */
export function getStore(): DataStore {
  if (instance) return instance;
  if ((process.env.LOCAL_STORE ?? "").trim() === "1") {
    configError = null;
    instance = new LocalStore();
    return instance;
  }
  try {
    instance = new SupabaseStore();
    configError = null;
  } catch (error) {
    configError = `יצירת החיבור ל-Supabase נכשלה: ${
      error instanceof Error ? error.message : String(error)
    }`;
    instance = new LocalStore();
  }
  return instance;
}

/** True when the app is backed by Supabase rather than the local JSON file. */
export function storeIsDurable(): boolean {
  return getStore().kind === "supabase";
}

/** Why Supabase was configured but not used, if that happened. */
export function getStoreConfigError(): string | null {
  getStore();
  return configError;
}

export type { DataStore };
