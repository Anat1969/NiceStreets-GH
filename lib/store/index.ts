import { LocalStore } from "./local";
import { SupabaseStore } from "./supabase";
import type { DataStore } from "./types";

let instance: DataStore | null = null;
let configError: string | null = null;

/**
 * The project's API URL. It is not a secret — it identifies the project the
 * same way a domain name does — so it has a default and only the key has to
 * be configured. SUPABASE_URL overrides it for another project.
 */
const DEFAULT_SUPABASE_URL = "https://cbhexpybdggwzyakgagd.supabase.co";

function clean(value: string | undefined): string {
  // Values pasted into a hosting dashboard often carry stray whitespace,
  // quotes, or a trailing newline.
  return (value ?? "").trim().replace(/^["']|["']$/g, "");
}

/**
 * Picks the backend: Supabase when the project is configured, otherwise a
 * JSON file under .data/ so the app runs with no external services.
 *
 * Misconfiguration must never crash the app. A bad URL or a missing key falls
 * back to the local store and records why, which /api/health reports.
 *
 * The key is read on the server only and is never sent to the browser, which
 * is why it is not named NEXT_PUBLIC_*.
 */
export function getStore(): DataStore {
  if (instance) return instance;

  const url =
    clean(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL) || DEFAULT_SUPABASE_URL;
  const key = clean(process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY);

  if (!key) {
    configError = "חסר מפתח: יש להגדיר את SUPABASE_SERVICE_ROLE_KEY";
    instance = new LocalStore();
    return instance;
  }

  // A key copied from a masked display carries bullet characters instead of
  // the real ones. Those cannot go into an HTTP header, and the failure that
  // follows is unreadable, so name the cause here.
  if (!/^[\x21-\x7e]+$/.test(key)) {
    const masked = /[\u2022\u00b7\u2219\u25cf]/.test(key);
    configError = masked
      ? "המפתח הועתק מתצוגה מוסתרת: הוא מכיל נקודות (●) במקום התווים האמיתיים. " +
        "יש להעתיק אותו מלוח הבקרה של Supabase, מתוך Project Settings ← API Keys."
      : "המפתח מכיל תווים שאינם חוקיים. יש להעתיק אותו מחדש, בלי רווחים או ירידות שורה.";
    instance = new LocalStore();
    return instance;
  }

  let origin: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") throw new Error("protocol");
    origin = parsed.origin;
  } catch {
    configError =
      "כתובת SUPABASE_URL אינה תקינה. הערך צריך להיות הכתובת בלבד, " +
      "למשל https://xxxx.supabase.co, בלי שם המשתנה ובלי רווחים או שורות נוספות.";
    instance = new LocalStore();
    return instance;
  }

  try {
    instance = new SupabaseStore(origin, key);
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
