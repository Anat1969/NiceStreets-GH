import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { isStaff } from "@/lib/session";
import type { PhotoStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await isStaff())) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const photoId = body?.photoId as string | undefined;
  const status = body?.status as PhotoStatus | undefined;
  if (!photoId || !status || !["pending", "approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "נתונים חסרים" }, { status: 400 });
  }
  await getStore().setPhotoStatus(photoId, status);
  return NextResponse.json({ ok: true });
}
