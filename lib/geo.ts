/**
 * הגאומטריה של המפה — ומה קורה כשאין אותה.
 *
 * המפה קוראת שתי שכבות GeoJSON מתוך `data/`:
 *   data/quarters.geojson — גבולות הרובעים מה-GIS העירוני
 *   data/streets.geojson  — קווי הרחובות מה-GIS העירוני
 *
 * TODO — שתי השכבות עדיין אינן במאגר.
 * עד שיגיעו, המפה אינה מציירת גבולות כלל. הריבועים הסכמטיים שהיו כאן קודם
 * הוסרו: ריבוע שמצויר במקום שאינו המקום האמיתי של הרובע הוא מידע שגוי
 * שנראה כמו מידע נכון, וזה גרוע מלא להציג דבר.
 *
 * רובע מצויר על המפה רק כשיש לו מיקום אמיתי — כלומר אחרי שהצוות מיקם אותו
 * ממסך הכיול, או אחרי שנטענה שכבת ה-GIS. רובע שטרם מוקם מופיע ברשימה מתחת
 * למפה, לא עליה.
 *
 * להטענת השכבות כשיגיעו:
 *   node scripts/import-gis.mjs data/quarters.geojson data/streets.geojson
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface StreetLine {
  /** קוד המרשם של הרחוב, כדי לחבר את הקו לנתונים שלו. */
  code: string;
  name: string;
  /** [lon, lat][] — קו אחד. רחוב מפוצל מיוצג בכמה רשומות. */
  line: [number, number][];
}

const DATA_DIR = join(process.cwd(), "data");

function readCollection(file: string): GeoJSON.Feature[] | null {
  try {
    const raw = readFileSync(join(DATA_DIR, file), "utf8");
    const parsed = JSON.parse(raw) as GeoJSON.FeatureCollection;
    if (parsed?.type !== "FeatureCollection" || !Array.isArray(parsed.features)) {
      return null;
    }
    return parsed.features;
  } catch {
    // The layer simply is not here yet. That is a state, not a failure.
    return null;
  }
}

/**
 * קווי הרחובות מה-GIS, או רשימה ריקה כשהשכבה אינה קיימת.
 * לעולם אינה זורקת: מפה בלי שכבה עדיין צריכה להיטען.
 */
export function loadStreetLines(): StreetLine[] {
  const features = readCollection("streets.geojson");
  if (!features) return [];

  const lines: StreetLine[] = [];
  for (const feature of features) {
    const code = String(feature.properties?.code ?? "").trim();
    const name = String(feature.properties?.name ?? "").trim();
    if (!code || !name) continue;

    const geometry = feature.geometry;
    if (geometry?.type === "LineString") {
      lines.push({ code, name, line: geometry.coordinates as [number, number][] });
    } else if (geometry?.type === "MultiLineString") {
      for (const part of geometry.coordinates) {
        lines.push({ code, name, line: part as [number, number][] });
      }
    }
  }
  return lines;
}

/** האם שכבת ה-GIS של הרחובות קיימת. נאמר לתושב במפורש כשלא. */
export function streetLinesAvailable(): boolean {
  return readCollection("streets.geojson") !== null;
}
