import crypto from "node:crypto";
import { cookies } from "next/headers";
import { VIEW_MODE_COOKIE, parseViewMode, type ViewMode } from "./view-mode";
import { PALETTE_COOKIE, parsePalette, type Palette } from "./palette";

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

/**
 * Three roles. A resident is anyone without a code. Staff is the department's
 * working login. Admin is the city architect, and has every staff right plus
 * the ones reserved for her — publishing a photo without moderation, above all.
 *
 * There are no user accounts: a role is proven by knowing its code, and the
 * cookie holds a token derived from it rather than the code itself.
 */
export type Role = "resident" | "staff" | "admin";

function roleToken(code: string): string {
  return crypto.createHash("sha256").update(`gs::${code}`).digest("hex").slice(0, 32);
}

/** Constant-time comparison that does not leak the length of the secret. */
function sameSecret(given: string, expected: string): boolean {
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export function staffCodeConfigured(): boolean {
  return Boolean(process.env.STAFF_CODE || process.env.ADMIN_CODE);
}

export function adminCodeConfigured(): boolean {
  return Boolean(process.env.ADMIN_CODE);
}

/**
 * Checks a typed code against both roles and returns the token to store.
 * Admin is checked first, so setting the same value for both codes grants the
 * stronger role rather than the weaker one.
 */
export function verifyCode(code: string): { role: Role; token: string } | null {
  if (!code) return null;
  const admin = process.env.ADMIN_CODE;
  if (admin && sameSecret(code, admin)) {
    return { role: "admin", token: roleToken(admin) };
  }
  const staff = process.env.STAFF_CODE;
  if (staff && sameSecret(code, staff)) {
    return { role: "staff", token: roleToken(staff) };
  }
  return null;
}

export async function getRole(): Promise<Role> {
  const jar = await cookies();
  const token = jar.get(STAFF_COOKIE)?.value;
  if (!token) return "resident";

  const admin = process.env.ADMIN_CODE;
  if (admin && sameSecret(token, roleToken(admin))) return "admin";

  const staff = process.env.STAFF_CODE;
  if (staff && sameSecret(token, roleToken(staff))) return "staff";

  return "resident";
}

/** True for staff and for admin: the city architect has every staff right. */
export async function isStaff(): Promise<boolean> {
  return (await getRole()) !== "resident";
}

export async function isAdmin(): Promise<boolean> {
  return (await getRole()) === "admin";
}

/** The layout the visitor chose, if any. */
export async function getViewMode(): Promise<ViewMode> {
  const jar = await cookies();
  return parseViewMode(jar.get(VIEW_MODE_COOKIE)?.value);
}

/** The colour scheme the visitor chose, if any. */
export async function getPalette(): Promise<Palette> {
  const jar = await cookies();
  return parsePalette(jar.get(PALETTE_COOKIE)?.value);
}
