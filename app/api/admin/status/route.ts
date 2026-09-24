import { NextResponse } from "next/server";
import { STATUS_MAP } from "@/lib/city";
import type { StatusKey } from "@/lib/city";
import { getStore } from "@/lib/store";
import { isStaff } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await isStaff())) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const streetId = body?.streetId as string | undefined;
  const status = body?.status as StatusKey | undefined;
  if (!streetId || !status || !STATUS_MAP[status]) {
    return NextResponse.json({ error: "נתונים חסרים" }, { status: 400 });
  }
  const record = await getStore().setStreetStatus({
    streetId,
    status,
    publicNote: String(body?.publicNote ?? "").slice(0, 400),
    updatedBy: "staff",
  });
  return NextResponse.json({ ok: true, status: record });
}
