import { NextResponse } from "next/server";
import { STAFF_COOKIE, staffCodeConfigured, verifyStaffCode } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!staffCodeConfigured()) {
    return NextResponse.json(
      { error: "לא הוגדר קוד צוות בשרת (STAFF_CODE)" },
      { status: 503 },
    );
  }
  const form = await request.formData();
  const token = verifyStaffCode(String(form.get("code") ?? ""));
  if (!token) {
    return NextResponse.redirect(new URL("/admin?error=1", request.url), 303);
  }
  const response = NextResponse.redirect(new URL("/admin", request.url), 303);
  response.cookies.set(STAFF_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

export async function DELETE(request: Request) {
  const response = NextResponse.json({ ok: true });
  void request;
  response.cookies.set(STAFF_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
