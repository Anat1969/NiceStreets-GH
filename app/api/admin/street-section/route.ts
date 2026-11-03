import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { isStaff } from "@/lib/session";
import { FLOOR_HEIGHT_M } from "@/lib/street-section";

export const dynamic = "force-dynamic";

/** מספר בטווח סביר, או null. קלט מהדפדפן אינו נסמך עליו כמו שהוא. */
function within(value: unknown, min: number, max: number): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

/**
 * הצוות מאשר את חתך הרחוב: הרוחב שנמדד והקומות שספר. נשמר ב-`gis.section`,
 * ולא דורס את ערך ה-GIS העירוני.
 */
export async function POST(request: Request) {
  if (!(await isStaff())) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const streetId = typeof body?.streetId === "string" ? body.streetId : "";
  const facadeWidthM = within(body?.facadeWidthM, 3, 150);
  const floorsA = within(body?.floorsA, 1, 40);
  const floorsB = within(body?.floorsB, 1, 40);
  if (!streetId || facadeWidthM === null || floorsA === null || floorsB === null) {
    return NextResponse.json({ error: "חסר רוחב או מספר קומות תקין." }, { status: 400 });
  }
  const heightM = ((floorsA + floorsB) / 2) * FLOOR_HEIGHT_M;
  try {
    const street = await getStore().setStreetSection(streetId, {
      facadeWidthM: Math.round(facadeWidthM * 10) / 10,
      floorsA: Math.round(floorsA),
      floorsB: Math.round(floorsB),
      heightToWidth: Math.round((heightM / facadeWidthM) * 100) / 100,
      measuredAt: new Date().toISOString().slice(0, 10),
    });
    return NextResponse.json({ ok: true, street });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "השמירה נכשלה" },
      { status: 400 },
    );
  }
}
