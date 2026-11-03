import { cache } from "react";
import { cookies } from "next/headers";
import { VIEW_MODE_COOKIE, parseViewMode, type ViewMode } from "./view-mode";
import { PALETTE_COOKIE, parsePalette, type Palette } from "./palette";
import { supabaseServer } from "./supabase/server";

/**
 * Three roles, all proven by Supabase Auth and enforced by the database:
 *
 * resident — anyone. Signed in anonymously the first time they write.
 * staff    — an e-mail user with a row in public.staff (magic-link sign-in).
 * admin    — staff with role 'admin': the city architect.
 *
 * The app reads the role only to decide what to show. What a request may
 * actually do is decided by RLS from the same session, so a forged cookie
 * or a skipped check here cannot write anything.
 */
export type Role = "resident" | "staff" | "admin";

interface Identity {
  userId: string | null;
  email: string | null;
  role: Role;
}

/** Once per request, however many components ask. */
const identity = cache(async (): Promise<Identity> => {
  try {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return { userId: null, email: null, role: "resident" };
    if (user.is_anonymous) return { userId: user.id, email: null, role: "resident" };
    const { data: row } = await supabase
      .from("staff")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    const role: Role = row?.role === "admin" ? "admin" : row ? "staff" : "resident";
    return { userId: user.id, email: user.email ?? null, role };
  } catch {
    return { userId: null, email: null, role: "resident" };
  }
});

/** The signed-in user's id (anonymous resident or staff), or null. */
export async function getResidentId(): Promise<string | null> {
  return (await identity()).userId;
}

export async function getRole(): Promise<Role> {
  return (await identity()).role;
}

/** The address of an e-mail user (staff or not); null for residents and guests. */
export async function getSignedInEmail(): Promise<string | null> {
  return (await identity()).email;
}

/** The staff member's address, for "signed in as". */
export async function getStaffEmail(): Promise<string | null> {
  const who = await identity();
  return who.role === "resident" ? null : who.email;
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
