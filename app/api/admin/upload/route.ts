import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { isAdmin, isStaff } from "@/lib/session";
import type { PhotoSource } from "@/lib/types";

export const dynamic = "force-dynamic";

/** The department's own sources. "resident" is not one of them: that comes with a vote. */
const ADMIN_SOURCES: PhotoSource[] = ["example", "test"];

/**
 * Upload by the department, published without moderation.
 *
 * "example" — the department's photo, also the replacement when a resident's
 * photo was rejected (Anat, 08.11.2026, item 24): any staff member.
 * "test" stays with the admin.
 *
 * The database decides in the end (RLS). Until migration
 * 20261108120000_staff_replacement_photo.sql is applied, only the admin can
 * insert; a staff member then gets the clear message below.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const wanted = body?.source as PhotoSource | undefined;
  const allowed = wanted === "test" ? await isAdmin() : await isStaff();
  if (!allowed) {
    return NextResponse.json(
      { error: wanted === "test" ? "תמונת בדיקה שמורה למנהלת" : "ההעלאה שמורה לצוות" },
      { status: 403 },
    );
  }

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
    if (/row-level security|violates/i.test(code)) {
      return NextResponse.json(
        {
          error:
            "מסד הנתונים עדיין מתיר העלאה כזאת רק למנהלת. היא תיפתח לכל הצוות אחרי עדכון ההרשאות.",
        },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: messages[code] ?? "ההעלאה נכשלה" },
      { status: code in messages ? 400 : 500 },
    );
  }
}
