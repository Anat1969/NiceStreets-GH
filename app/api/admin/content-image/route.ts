import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { isAdmin } from "@/lib/session";
import { parseImageSlot } from "@/lib/content-images";

export const dynamic = "force-dynamic";

/**
 * העלאה למסגרת. שמור למנהלת: אלה תמונות התוכן של האגף, לא תמונות שתושבים
 * שולחים — ולכן אין כאן תור אישור, והבדיקה היא isAdmin ולא isStaff.
 */
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "שמור למנהלת" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const slot = parseImageSlot(String(body?.slot ?? ""));
  const dataUrl = body?.dataUrl as string | undefined;
  const alt = typeof body?.alt === "string" ? body.alt.slice(0, 200) : "";

  if (!slot) return NextResponse.json({ error: "מקום לא מוכר" }, { status: 400 });

  const store = getStore();
  try {
    if (!dataUrl) {
      await store.deleteContentImage(slot);
      return NextResponse.json({ ok: true, removed: true });
    }
    await store.setContentImage({ slot, dataUrl, alt });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const messages: Record<string, string> = {
      PHOTO_FORMAT: "פורמט התמונה אינו נתמך",
      PHOTO_TOO_LARGE: "התמונה גדולה מדי",
    };
    return NextResponse.json(
      { error: messages[code] ?? "ההעלאה נכשלה" },
      { status: code in messages ? 400 : 500 },
    );
  }
}
