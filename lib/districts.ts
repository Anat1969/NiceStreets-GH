/**
 * מפת רובעים — הלוגיקה, בלי מפה ובלי React.
 *
 * הרכיב (components/DistrictMap.tsx) אינו יודע מה נמדד ומאיפה. הוא מקבל
 * גבולות (GeoJSON שבו כל פוליגון מזוהה בשדה אחד, למשל `rova_code`) ונתונים
 * לפי אותו מזהה. כאן: הטיפוסים, החלוקה לרבעונים, ומקורות הנתונים.
 *
 * כל הטיפוסים כאן הם נתונים פשוטים, בלי פונקציות, כדי שאפשר יהיה להעביר
 * אותם מעמוד שרת אל רכיב הלקוח.
 */

/** מדד שאפשר לצבוע לפיו. */
export interface MetricDef {
  key: string;
  label: string;
  /** ספרות אחרי הנקודה. ברירת מחדל: 1. */
  decimals?: number;
  /** נכתב אחרי המספר, למשל "מתוך 10". */
  unit?: string;
  /** קובע את סדר הדירוג. הצבע תמיד כהה יותר לערך גבוה יותר. */
  higherIsBetter?: boolean;
}

/** שורה ברשימה שבלוח הפרטים, למשל רחוב מוביל ברובע. */
export interface DistrictItem {
  label: string;
  detail?: string;
  href?: string;
}

/** כל מה שידוע על רובע אחד. המפתח הוא המזהה שבקובץ הגבולות. */
export interface DistrictRecord {
  /** השם לתצוגה. אם חסר — השם מקובץ הגבולות. */
  name?: string;
  /** ערך לכל מדד, לפי `MetricDef.key`. null = אין עדיין נתון. */
  values: Record<string, number | null>;
  /** שדות נוספים ללוח הפרטים, בסדר התצוגה. */
  fields?: { label: string; value: string }[];
  /** כותרת לרשימת הפריטים (למשל "הרחובות המובילים"). */
  itemsTitle?: string;
  items?: DistrictItem[];
  /** קישור להמשך, למשל לטבלת הרחובות של הרובע. */
  link?: { href: string; label: string };
}

export type DistrictData = Record<string, DistrictRecord>;

/* ------------------------------------------------------------ מקורות נתונים
 *
 * הרכיב מקבל או `data` (אובייקט מוכן) או `source` (משהו שיודע לטעון).
 * היום הנתונים מחושבים בשרת ומגיעים כאובייקט. מחר הם יכולים להגיע מקובץ
 * JSON או מטבלה ב-Supabase — עם אותו ממשק, בלי לגעת ברכיב.
 *
 * `source` נוצר בצד הלקוח בלבד: פונקציה אינה עוברת מעמוד שרת לרכיב לקוח.
 */
export interface DistrictDataSource {
  load(): Promise<DistrictData>;
}

/** נתונים שכבר בידינו. */
export function staticSource(data: DistrictData): DistrictDataSource {
  return { load: async () => data };
}

/** קובץ JSON סטטי, באותו מבנה: { [מזהה]: DistrictRecord }. */
export function jsonSource(url: string): DistrictDataSource {
  return {
    async load() {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`קובץ הנתונים לא נטען (${response.status})`);
      const parsed: unknown = await response.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("קובץ הנתונים אינו במבנה הצפוי");
      }
      return parsed as DistrictData;
    },
  };
}

/* ------------------------------------------------------------ רבעונים */

/** אחוזון בשיטת האינטרפולציה הליניארית, על מערך ממוין. */
function quantile(sorted: number[], p: number): number {
  const position = (sorted.length - 1) * p;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
}

/**
 * גבולות הרבעונים: עד שלושה ספים שמחלקים את הערכים לעד ארבע מדרגות.
 *
 * ערכים ריקים אינם נספרים. כשיש פחות מארבעה ערכים שונים, יש פחות מדרגות —
 * שני רובעים עם אותו ציון לא ייצבעו בשני צבעים שונים.
 */
export function quartileBreaks(values: (number | null | undefined)[]): number[] {
  const sorted = values
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
    .sort((a, b) => a - b);
  const distinct = new Set(sorted).size;
  if (distinct <= 1) return [];

  const classes = Math.min(4, distinct);
  const breaks: number[] = [];
  for (let i = 1; i < classes; i++) {
    const cut = quantile(sorted, i / classes);
    // סף שווה למקסימום היה משאיר את המדרגה העליונה ריקה.
    if (cut < sorted[sorted.length - 1] && !breaks.includes(cut)) breaks.push(cut);
  }
  return breaks;
}

/** מספר המדרגה (0 = הנמוכה), או null כשאין ערך. */
export function classify(value: number | null | undefined, breaks: number[]): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const index = breaks.findIndex((cut) => value <= cut);
  return index === -1 ? breaks.length : index;
}

/** טווח הערכים של כל מדרגה, למקרא. */
export function classRanges(
  values: (number | null | undefined)[],
  breaks: number[],
): { cls: number; min: number; max: number }[] {
  const present = values.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
  if (present.length === 0) return [];
  const ranges: { cls: number; min: number; max: number }[] = [];
  for (let i = 0; i <= breaks.length; i++) {
    const inClass = present.filter((v) => classify(v, breaks) === i);
    if (inClass.length === 0) continue;
    ranges.push({ cls: i, min: Math.min(...inClass), max: Math.max(...inClass) });
  }
  return ranges;
}

/**
 * סולם רציף בגוון אחד, מבהיר לכהה.
 *
 * לא אדום-ירוק: רבעון הוא מיקום יחסי בין הרובעים, לא שיפוט. רובע בציון 7.8
 * יכול להיות ברבעון התחתון, ובסולם אדום-ירוק הוא היה נצבע "רע".
 */
const RAMP = ["#d7ebe3", "#9ccbb8", "#4f9a80", "#1f6f5c"];
const RAMP_BY_CLASSES: Record<number, number[]> = {
  1: [3],
  2: [1, 3],
  3: [0, 2, 3],
  4: [0, 1, 2, 3],
};

export const NO_DATA_COLOR = "#e3e5e8";

/** הצבע של כל מדרגה, לפי מספר המדרגות בפועל. */
export function classColors(classes: number): string[] {
  return (RAMP_BY_CLASSES[classes] ?? RAMP_BY_CLASSES[4]).map((i) => RAMP[i]);
}

/**
 * צבע הטקסט על כל צבע בסולם. רק הכהה ביותר מקבל לבן: על המדרגה השלישית
 * לבן נותן ניגודיות 3.3 בלבד, ודיו נותן 4.9.
 */
export function textOnClass(color: string): string {
  return color === RAMP[3] ? "#ffffff" : "#16202b";
}

export function formatMetric(value: number | null | undefined, metric: MetricDef): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "אין נתונים";
  const text = value.toFixed(metric.decimals ?? 1);
  return metric.unit ? `${text} ${metric.unit}` : text;
}

/* ------------------------------------------------------------ גאומטריה */

type Position = number[];

/** גבולות [[מערב, דרום], [מזרח, צפון]] של פוליגון או מולטי-פוליגון. */
export function featureBounds(
  geometry: GeoJSON.Geometry | null | undefined,
): [[number, number], [number, number]] | null {
  if (!geometry) return null;
  let rings: Position[][] = [];
  if (geometry.type === "Polygon") rings = geometry.coordinates;
  else if (geometry.type === "MultiPolygon") rings = geometry.coordinates.flat();
  else return null;

  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      if (lon < west) west = lon;
      if (lon > east) east = lon;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
    }
  }
  return Number.isFinite(west) ? [[west, south], [east, north]] : null;
}

/** איחוד גבולות. */
export function unionBounds(
  all: ([[number, number], [number, number]] | null)[],
): [[number, number], [number, number]] | null {
  const present = all.filter((b): b is [[number, number], [number, number]] => b !== null);
  if (present.length === 0) return null;
  return [
    [Math.min(...present.map((b) => b[0][0])), Math.min(...present.map((b) => b[0][1]))],
    [Math.max(...present.map((b) => b[1][0])), Math.max(...present.map((b) => b[1][1]))],
  ];
}

/**
 * מרכז לתווית: מהשדות שבקובץ אם יש, אחרת מרכז הגבולות.
 * מרכז הגבולות של רובע בצורת L יכול ליפול מחוצה לו, ולכן הקובץ עדיף.
 */
export function featureCentroid(
  feature: GeoJSON.Feature,
  latProperty: string,
  lonProperty: string,
): [number, number] | null {
  const lat = Number(feature.properties?.[latProperty]);
  const lon = Number(feature.properties?.[lonProperty]);
  if (Number.isFinite(lat) && Number.isFinite(lon) && lat !== 0 && lon !== 0) {
    return [lon, lat];
  }
  const bounds = featureBounds(feature.geometry);
  if (!bounds) return null;
  return [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2];
}
