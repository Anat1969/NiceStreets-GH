import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";

/**
 * Keeps the visitor's session fresh. A session token expires after an hour;
 * this is the one place that can both read the old one and write the new one
 * before the page renders. A visitor with no session passes straight through.
 */
export async function middleware(request: NextRequest) {
  // A sign-in link that landed on another page (Supabase falls back to the
  // Site URL when the return address does not match) still carries its
  // one-time code: hand it to the callback instead of dropping it.
  const code = request.nextUrl.searchParams.get("code");
  if (code && request.nextUrl.pathname !== "/auth/callback") {
    const target = request.nextUrl.clone();
    target.pathname = "/auth/callback";
    target.search = `?code=${encodeURIComponent(code)}`;
    return NextResponse.redirect(target);
  }

  let response = NextResponse.next({ request });
  const hasSession = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
  if (!hasSession) return response;

  try {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(list) {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of list) response.cookies.set(name, value, options);
        },
      },
    });
    await supabase.auth.getUser();
  } catch {
    // A failed refresh must never block the page; the visitor is simply anon.
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|manifest.webmanifest|api/photos/).*)"],
};
