import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * תמונה שתושב מצלם מכרטיס הרחוב.
 *
 * זה הרגע שבו הוא עומד ברחוב עצמו. לשלוח אותו למסך הדירוג המלא רק כדי
 * להוסיף תמונה פירושו לאבד אותה. התמונה נשמרת כ-pending, בדיוק כמו תמונה
 * שמגיעה עם קול, ואינה מוצגת לציבור עד שהצוות מאשר.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const streetId = body?.streetId as string | undefined;
  const dataUrl = body?.dataUrl as string | undefined;

  if (!streetId || !dataUrl) {
    return NextResponse.json({ error: "חסר רחוב או תמונה" }, { status: 400 });
  }

  const store = getStore();
  const street = await store.getStreet(streetId).catch(() => null);
  if (!street) {
    return NextResponse.json({ error: "הרחוב לא נמצא" }, { status: 400 });
  }

  try {
    const photo = await store.createPhoto({
      streetId,
      dataUrl,
      source: "resident",
      status: "pending",
    });
    return NextResponse.json({ ok: true, photoId: photo.id });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const messages: Record<string, string> = {
      PHOTO_FORMAT: "פורמט התמונה אינו נתמך",
      PHOTO_TOO_LARGE: "התמונה גדולה מדי. נסו שוב עם תמונה קטנה יותר",
    };
    return NextResponse.json(
      { error: messages[code] ?? "השמירה נכשלה" },
      { status: code in messages ? 400 : 500 },
    );
  }
}
