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

  // A relative Location keeps the visitor on the host they came from. An
  // absolute URL built from request.url can carry the server's own hostname,
  // and the cookie set here would then belong to a different origin.
  if (!token) {
    return new NextResponse(null, {
      status: 303,
      headers: { Location: "/admin?error=1" },
    });
  }

  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: "/admin" },
  });
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
