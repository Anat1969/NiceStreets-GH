import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { isStaff } from "@/lib/session";

export const dynamic = "force-dynamic";

function isCoordinate(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

/**
 * מיקום ידני של רחוב על המפה, על ידי הצוות.
 *
 * החיפוש האוטומטי ב-OpenStreetMap לא מוצא הכול: שם שאינו קיים שם, רחוב
 * חדש, או שם שכתוב אחרת במרשם הארצי. עד עכשיו רחוב כזה פשוט לא הופיע
 * במפה ולא הייתה דרך לתקן זאת מהאפליקציה. כאן הצוות לוחץ על המפה במקום
 * הנכון, והמיקום נשמר כ-"staff" — כלומר עדיף על ניחוש, ונבדל ממדידה.
 */
export async function POST(request: Request) {
  if (!(await isStaff())) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const streetId = body?.streetId as string | undefined;
  const center = body?.center;

  if (!streetId) {
    return NextResponse.json({ error: "לא נבחר רחוב" }, { status: 400 });
  }
  if (!isCoordinate(center)) {
    return NextResponse.json({ error: "נקודה לא תקינה" }, { status: 400 });
  }

  const store = getStore();
  const street = await store.getStreet(streetId).catch(() => null);
  if (!street) {
    return NextResponse.json({ error: "הרחוב לא נמצא" }, { status: 400 });
  }

  try {
    await store.setStreetCenter(streetId, center, "staff");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "השמירה נכשלה" },
      { status: 500 },
    );
  }
}
