import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { isAdmin } from "@/lib/session";
import type { PhotoSource } from "@/lib/types";

export const dynamic = "force-dynamic";

/** The admin's own sources. "resident" is not one of them: that comes with a vote. */
const ADMIN_SOURCES: PhotoSource[] = ["example", "test"];

/**
 * Upload by the admin, published without moderation.
 *
 * Only the admin: staff moderate what residents send, the admin also publishes
 * directly. The check is `isAdmin`, not `isStaff`, on purpose.
 */
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { error: "העלאה ישירה שמורה למנהלת" },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  const streetId = body?.streetId as string | undefined;
  const dataUrl = body?.dataUrl as string | undefined;
  const source = body?.source as PhotoSource | undefined;

  if (!streetId || !dataUrl) {
    return NextResponse.json({ error: "חסר רחוב או תמונה" }, { status: 400 });
  }
  if (!source || !ADMIN_SOURCES.includes(source)) {
    return NextResponse.json(
      { error: "יש לבחור אם זו דוגמה או בדיקה" },
      { status: 400 },
    );
  }

  const store = getStore();
  const street = await store.getStreet(streetId).catch(() => null);
  if (!street) {
    return NextResponse.json({ error: "הרחוב לא נמצא" }, { status: 400 });
  }

  try {
    const photo = await store.createPhoto({ streetId, dataUrl, source });
    return NextResponse.json({ ok: true, photoId: photo.id });
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
