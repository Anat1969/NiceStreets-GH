/**
 * הגאומטריה של המפה — ומה קורה כשאין אותה.
 *
 * המפה קוראת שתי שכבות GeoJSON מתוך `data/`:
 *   data/quarters.geojson — גבולות הרובעים מה-GIS העירוני
 *   data/streets.geojson  — קווי הרחובות מה-GIS העירוני
 *
 * גבולות הרובעים כבר קיימים, בנפרד: public/geo/ashdod-rovaim.geojson, שמצויר
 * על ידי components/DistrictMap.tsx במסך המפה (תצוגת "לפי רובע").
 *
 * שכבת הרחובות הגיעה מהעירייה ב-03.11.2026 (rehevot.shp, 2,991 קטעים, ITM שהומר ל-WGS84):
 * data/streets.geojson. השדות: code (סמל רחוב), name, quarter, hierarchy (מידרג), type (סוג).
 * מידרג 9 הוא רצועות חניה ("חניות רוגוזין"), ולכן אינו מצויר כרחוב.
 *
 * TODO — שכבת הרובעים (quarters.geojson) עדיין אינה במאגר.
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
    // רצועות חניה וחניונים ("חניות רוגוזין מזרח 1") נושאים את סמל הרחוב, אבל אינם הרחוב.
    if (Number(feature.properties?.hierarchy) === 9) continue;

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

/**
 * שבילי האופניים מה-GIS העירוני (bike_road.shp, 05.11.2026, 139 קטעים):
 * data/bike-paths.geojson. רשימה ריקה כשהשכבה אינה קיימת. לעולם אינה זורקת.
 */
export function loadBikePaths(): [number, number][][] {
  const features = readCollection("bike-paths.geojson");
  if (!features) return [];
  const lines: [number, number][][] = [];
  for (const feature of features) {
    const g = feature.geometry;
    if (g?.type === "LineString") lines.push(g.coordinates as [number, number][]);
    else if (g?.type === "MultiLineString") {
      for (const part of g.coordinates) lines.push(part as [number, number][]);
    }
  }
  return lines;
}

/** האם שכבת ה-GIS של הרחובות קיימת. נאמר לתושב במפורש כשלא. */
export function streetLinesAvailable(): boolean {
  return readCollection("streets.geojson") !== null;
}
