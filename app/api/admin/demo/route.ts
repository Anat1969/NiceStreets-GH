import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { isStaff } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await isStaff())) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const action = body?.action as string | undefined;
  const store = getStore();
  try {
    if (action === "seed") {
      return NextResponse.json({ ok: true, count: await store.seedDemo() });
    }
    if (action === "clear") {
      return NextResponse.json({ ok: true, count: await store.clearDemo() });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "שגיאה" },
      { status: 400 },
    );
  }
  return NextResponse.json({ error: "פעולה לא מוכרת" }, { status: 400 });
}
