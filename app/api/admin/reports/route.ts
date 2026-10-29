import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { isStaff } from "@/lib/session";

export const dynamic = "force-dynamic";

/** סימון דיווח כטופל, או החזרתו לפתוחים. */
export async function POST(request: Request) {
  if (!(await isStaff())) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const reportId = body?.reportId as string | undefined;
  const handled = body?.handled;
  if (!reportId || typeof handled !== "boolean") {
    return NextResponse.json({ error: "נתונים חסרים" }, { status: 400 });
  }
  await getStore().setReportHandled(reportId, handled);
  return NextResponse.json({ ok: true });
}
