import crypto from "node:crypto";
import { cookies } from "next/headers";
import { VIEW_MODE_COOKIE, parseViewMode, type ViewMode } from "./view-mode";

export const RESIDENT_COOKIE = "gs_uid";
export const STAFF_COOKIE = "gs_staff";

/** Anonymous resident id. No personal details are stored anywhere. */
export async function getResidentId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(RESIDENT_COOKIE)?.value ?? null;
}

export function newResidentId(): string {
  return `u-${crypto.randomUUID()}`;
}

function staffToken(code: string): string {
  return crypto.createHash("sha256").update(`gs::${code}`).digest("hex").slice(0, 32);
}

export function staffCodeConfigured(): boolean {
  return Boolean(process.env.STAFF_CODE);
}

export function verifyStaffCode(code: string): string | null {
  const expected = process.env.STAFF_CODE;
  if (!expected) return null;
  const a = Buffer.from(code);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return staffToken(expected);
}

export async function isStaff(): Promise<boolean> {
  const expected = process.env.STAFF_CODE;
  if (!expected) return false;
  const jar = await cookies();
  const token = jar.get(STAFF_COOKIE)?.value;
  if (!token) return false;
  const want = staffToken(expected);
  return token.length === want.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(want));
}

/** The layout the visitor chose, if any. */
export async function getViewMode(): Promise<ViewMode> {
  const jar = await cookies();
  return parseViewMode(jar.get(VIEW_MODE_COOKIE)?.value);
}
