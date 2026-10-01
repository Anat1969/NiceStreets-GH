import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * The magic link lands here. The one-time code in the address becomes a
 * session in cookies, and the staff member continues to the dashboard.
 * Redirects are relative, so the cookies stay on the host the link opened.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/admin";

  if (!code) {
    return new NextResponse(null, { status: 303, headers: { Location: "/admin?error=link" } });
  }
  try {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
  } catch {
    return new NextResponse(null, { status: 303, headers: { Location: "/admin?error=link" } });
  }
  return new NextResponse(null, { status: 303, headers: { Location: target } });
}
