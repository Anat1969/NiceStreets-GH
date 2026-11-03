/**
 * חתך הרחוב: רוחב בין קירות הבניינים, מתוך OpenStreetMap.
 *
 * מה נמדד כאן בקוד, ומה לא:
 *   - הרוחב נמדד: בשבע נקודות לאורך ציר הרחוב נמצא הקיר הקרוב בכל צד, בתוך
 *     רצועה של 30 מ'. הרוחב, מקיר לקיר, הוא החציון של הדגימות. זה אינו רוחב
 *     זכות הדרך (בין קווי המגרש): הוא כולל גם את מרווחי הבניין.
 *   - הגובה כמעט לא נמדד: באשדוד רק לכ-7% מהבניינים ב-OpenStreetMap רשום
 *     מספר קומות (בדיקה מ-03.11.2026: 602 מתוך 8,777). כשאין, הגובה הוא
 *     הערכה שמסומנת ככזו, והמשתמש מתקן אותה.
 *
 * הקובץ טהור: בלי fetch ובלי DOM, כדי שאפשר יהיה לבדוק אותו על נתונים שמורים
 * (`scripts/check-street-section.mjs`).
 */

import { normalizeStreetName } from "./street-name";

export type LonLat = [number, number];

export interface OsmBuilding {
  id: number;
  ring: LonLat[];
  levels: number | null;
  heightM: number | null;
}

export interface OsmRoad {
  line: LonLat[];
  name: string;
}

export interface OsmData {
  roads: OsmRoad[];
  buildings: OsmBuilding[];
}

export interface SideHit {
  distM: number;
  building: OsmBuilding;
}

export interface SectionMeasure {
  /** רוחב בין קירות, חציון הדגימות, במטרים. */
  widthM: number;
  left: SideHit;
  right: SideHit;
  /** כמה דגימות מצאו קיר בשני הצדדים, מתוך כמה. */
  validSamples: number;
  totalSamples: number;
  /** פיזור הדגימות התקינות: הקטנה והגדולה. */
  minWidthM: number;
  maxWidthM: number;
  /**
   * "high" כשרוב הדגימות מצאו קיר בשני הצדדים והן קרובות זו לזו. "low"
   * בצומת, בכיכר או בשטח פתוח: המספר מוצג, אבל כמדידה לא חד־משמעית.
   */
  confidence: "high" | "low";
  /** האם הציר נבחר לפי שם הרחוב, או רק לפי קרבה למרכז. */
  matchedByName: boolean;
}

/** גובה קומה מקובל בבנייה למגורים בישראל, להמרה מקומות לגובה. הנחה, לא מדידה. */
export const FLOOR_HEIGHT_M = 3;
/** קומות כברירת מחדל כשאין נתון. הערכה, ומוצגת ככזו. */
export const DEFAULT_FLOORS = 4;
/** המרחק המרבי מהציר לקיר שעוד נחשב "דופן הרחוב". */
const MAX_REACH_M = 45;
/** חצי רוחב הרצועה שבה מחפשים קיר לכל צד, לאורך הרחוב. */
const BAND_HALF_M = 15;
/** הדגימות לאורך הרחוב, במטרים מהנקודה הקרובה למרכז. */
const SAMPLE_OFFSETS_M = [-60, -40, -20, 0, 20, 40, 60];

const STREET_CLASSES = new Set([
  "trunk",
  "primary",
  "secondary",
  "tertiary",
  "unclassified",
  "residential",
  "living_street",
  "pedestrian",
]);

/** השאילתה לשרת Overpass: בניינים ברדיוס 110 מ', ורחובות ברדיוס 40 מ'. */
export function overpassQuery([lon, lat]: LonLat): string {
  return (
    `[out:json][timeout:25];(` +
    `way(around:110,${lat},${lon})["building"];` +
    `way(around:40,${lat},${lon})["highway"];` +
    `);out tags geom;`
  );
}

interface OverpassElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
}

function num(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseOverpass(json: unknown): OsmData {
  const elements = (json as { elements?: OverpassElement[] })?.elements ?? [];
  const roads: OsmRoad[] = [];
  const buildings: OsmBuilding[] = [];
  for (const el of elements) {
    if (el.type !== "way" || !el.geometry || el.geometry.length < 2) continue;
    const line = el.geometry.map((p) => [p.lon, p.lat] as LonLat);
    const tags = el.tags ?? {};
    if (tags.building) {
      if (line.length < 4) continue;
      buildings.push({
        id: el.id,
        ring: line,
        levels: num(tags["building:levels"]),
        heightM: num(tags.height),
      });
    } else if (tags.highway && STREET_CLASSES.has(tags.highway)) {
      roads.push({ line, name: tags.name ?? "" });
    }
  }
  return { roads, buildings };
}

type XY = [number, number];

/** הטלה מקומית למטרים סביב נקודת המרכז. מדויקת לטווח של מאות מטרים. */
function projector([lon0, lat0]: LonLat) {
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const ky = 110540;
  return ([lon, lat]: LonLat): XY => [(lon - lon0) * kx, (lat - lat0) * ky];
}

const sub = (a: XY, b: XY): XY => [a[0] - b[0], a[1] - b[1]];
const len = (a: XY) => Math.hypot(a[0], a[1]);

/** נקודות לאורך היקף הבניין, כל מטר אחד, כדי שגם קיר ארוך ייתפס ברצועה. */
function densify(ring: XY[]): XY[] {
  const out: XY[] = [];
  for (let i = 0; i < ring.length - 1; i++) {
    const seg = sub(ring[i + 1], ring[i]);
    const n = Math.max(1, Math.ceil(len(seg)));
    for (let k = 0; k < n; k++) {
      out.push([ring[i][0] + (seg[0] * k) / n, ring[i][1] + (seg[1] * k) / n]);
    }
  }
  return out;
}

function inside(p: XY, ring: XY[]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) {
      hit = !hit;
    }
  }
  return hit;
}

/** נקודה וכיוון במרחק נתון לאורך קו, לפי אורך קשת. */
function along(line: XY[], s: number): { p: XY; dir: XY } {
  let acc = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const seg = sub(line[i + 1], line[i]);
    const l = len(seg);
    if (l === 0) continue;
    if (s <= acc + l || i === line.length - 2) {
      const t = Math.max(0, Math.min(1, (s - acc) / l));
      return {
        p: [line[i][0] + seg[0] * t, line[i][1] + seg[1] * t],
        dir: [seg[0] / l, seg[1] / l],
      };
    }
    acc += l;
  }
  return { p: line[0], dir: [1, 0] };
}

/** אורך הקשת של הנקודה הקרובה ביותר לראשית, והמרחק אליה. */
function nearestArc(line: XY[]): { s: number; d: number; total: number } {
  let best = { s: 0, d: Infinity };
  let acc = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const seg = sub(line[i + 1], a);
    const l2 = seg[0] ** 2 + seg[1] ** 2;
    const l = Math.sqrt(l2);
    if (l === 0) continue;
    const t = Math.max(0, Math.min(1, -(a[0] * seg[0] + a[1] * seg[1]) / l2));
    const d = Math.hypot(a[0] + seg[0] * t, a[1] + seg[1] * t);
    if (d < best.d) best = { s: acc + l * t, d };
    acc += l;
  }
  return { ...best, total: acc };
}

function median(values: number[]): number {
  const v = [...values].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/**
 * מודד את החתך סביב מרכז הרחוב. מחזיר null כשאין רחוב קרוב או כשפחות
 * משתי דגימות מצאו קיר בשני הצדדים: עדיף "אין מדידה" על מספר מקרי.
 */
export function measureSection(
  center: LonLat,
  data: OsmData,
  streetName = "",
): SectionMeasure | null {
  const project = projector(center);
  /*
   * מרכז הרחוב יושב לפעמים בצומת. אם יש רחוב באותו שם, מודדים לאורכו ולא
   * לאורך הרחוב החוצה, שאולי קרוב יותר.
   */
  const key = normalizeStreetName(streetName);
  const named = key
    ? data.roads.filter((r) => r.name && normalizeStreetName(r.name) === key)
    : [];
  const matchedByName = named.length > 0;
  const roads = (matchedByName ? named : data.roads).map((r) => r.line.map(project));
  if (roads.length === 0) return null;

  let road = roads[0];
  let arc = nearestArc(road);
  for (const r of roads.slice(1)) {
    const a = nearestArc(r);
    if (a.d < arc.d) {
      road = r;
      arc = a;
    }
  }

  const rings = data.buildings.map((b) => ({ b, ring: b.ring.map(project) }));
  const samples: { width: number; left: SideHit; right: SideHit }[] = [];

  for (const offset of SAMPLE_OFFSETS_M) {
    const s = arc.s + offset;
    if (s < 0 || s > arc.total) continue;
    const { p, dir } = along(road, s);
    if (rings.some((r) => inside(p, r.ring))) continue;
    /*
     * ימין ושמאל ביחס לכיוון הציר. לא קרן אחת: באשדוד רוב הבינוי הוא בלוקים
     * פתוחים, וקרן בודדת עוברת ברווח שבין שני בניינים. לכן לכל צד נבדקת
     * רצועה ברוחב 30 מ' סביב נקודת הדגימה, והקיר הקרוב בה הוא דופן הרחוב.
     */
    const normal: XY = [-dir[1], dir[0]];
    const hits: Partial<Record<"left" | "right", SideHit>> = {};
    for (const { b, ring } of rings) {
      for (const q of densify(ring)) {
        const w = sub(q, p);
        const u = w[0] * dir[0] + w[1] * dir[1];
        const v = w[0] * normal[0] + w[1] * normal[1];
        if (Math.abs(u) > BAND_HALF_M) continue;
        const side = v > 0 ? "left" : "right";
        const d = Math.abs(v);
        if (d < 1 || d > MAX_REACH_M) continue;
        const cur = hits[side];
        if (!cur || d < cur.distM) hits[side] = { distM: d, building: b };
      }
    }
    if (hits.left && hits.right) {
      samples.push({
        width: hits.left.distM + hits.right.distM,
        left: hits.left,
        right: hits.right,
      });
    }
  }

  if (samples.length < 2) return null;
  const widths = samples.map((x) => x.width);
  const widthM = median(widths);
  const rep = samples.reduce((a, b) =>
    Math.abs(b.width - widthM) < Math.abs(a.width - widthM) ? b : a,
  );
  const spread = Math.max(...widths) / Math.min(...widths);
  return {
    widthM,
    left: rep.left,
    right: rep.right,
    validSamples: samples.length,
    totalSamples: SAMPLE_OFFSETS_M.length,
    minWidthM: Math.min(...widths),
    maxWidthM: Math.max(...widths),
    confidence: samples.length >= 4 && spread <= 1.5 ? "high" : "low",
    matchedByName,
  };
}

/** קומות לבניין: מ-OpenStreetMap כשיש, אחרת null. */
export function knownFloors(b: OsmBuilding): number | null {
  if (b.levels) return Math.round(b.levels);
  if (b.heightM) return Math.max(1, Math.round(b.heightM / FLOOR_HEIGHT_M));
  return null;
}

/**
 * ערך הייחוס של סוג הרחוב, למשל "1:1.2 עד 1:1.5", כטווח של מספר הרוחב
 * ביחס לגובה 1. "משתנה" ומחרוזת שאינה נקראת מחזירים null.
 */
export function parseRatioRange(text: string): [number, number] | null {
  const xs = [...text.matchAll(/1\s*:\s*(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
  if (xs.length === 0) return null;
  return [Math.min(...xs), Math.max(...xs)];
}

export type RatioVerdict = "narrow" | "within" | "wide";

export function ratioVerdict(widthPerHeight: number, range: [number, number]): RatioVerdict {
  /* סובלנות של 10% לכל כיוון: המדידה עצמה אינה מדויקת יותר מזה. */
  if (widthPerHeight < range[0] * 0.9) return "narrow";
  if (widthPerHeight > range[1] * 1.1) return "wide";
  return "within";
}
