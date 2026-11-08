import { GIS_QUARTER } from "@/lib/gis-quarter.generated";
import { CROSSING_AREA_ID } from "@/lib/city";

/**
 * כל הרובעים שרחוב עובר בהם, לאייקונים שליד השם (ענת, 09.11.2026: "כל רחוב
 * נמצא ברובע, ואם הוא בכמה רובעים — להראות את האייקון של כולם").
 *
 * מקור ראשון: שכבת הרחובות העירונית (כל הרובעים מ-5% מהאורך ומעלה).
 * בלעדיה: הרובע שהצוות שייך. "ציר חוצה עיר" אינו רובע ואין לו אייקון משלו.
 */
export function streetQuarterIds(code: string | null, quarterId: string | null): string[] {
  const gis = code ? GIS_QUARTER[code] : undefined;
  if (gis?.all?.length) return gis.all;
  if (gis?.q && gis.q !== CROSSING_AREA_ID) return [gis.q];
  if (quarterId && quarterId !== CROSSING_AREA_ID) return [quarterId];
  return [];
}
