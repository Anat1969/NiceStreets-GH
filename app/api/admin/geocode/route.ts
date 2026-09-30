import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { isStaff } from "@/lib/session";
import { CITY } from "@/lib/city";
import { geocodeStreet } from "@/lib/geocode";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * ממקם על המפה רחובות שאין להם עדיין מיקום.
 *
 * המיקום נשלף מ-OpenStreetMap דרך Nominatim — שירות חופשי, בלי מפתח
 * ובלי חשבון. הקריאה נעשית מהשרת של האפליקציה ולא מהדפדפן, כי לתנאי
 * השימוש של Nominatim יש מגבלת קצב, וכאן אפשר לכבד אותה: בקשה אחת
 * לשנייה, ו-User-Agent שמזהה את האפליקציה.
 *
 * זה אינו תחליף לשכבת ה-GIS העירונית. `centerSource` שומר "osm", והמפה
 * אומרת זאת במפורש במקרא.
 */
export async function POST() {
  if (!(await isStaff())) {
    return NextResponse.json({ error: "פעולה של הצוות בלבד" }, { status: 403 });
  }

  const store = getStore();
  const streets = await store.listStreets().catch(() => []);
  const missing = streets.filter((s) => !s.center);

  const placed: string[] = [];
  const failed: string[] = [];

  for (const street of missing) {
    const point = await geocodeStreet(street.name, CITY.name);
    if (point) {
      await store.setStreetCenter(street.id, point, "osm");
      placed.push(street.name);
    } else {
      failed.push(street.name);
    }
    // מגבלת הקצב של Nominatim: בקשה אחת לשנייה, לא יותר.
    await new Promise((resolve) => setTimeout(resolve, 1100));
  }

  return NextResponse.json({
    ok: true,
    checked: missing.length,
    placed,
    failed,
  });
}
