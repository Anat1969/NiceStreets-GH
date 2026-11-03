/**
 * הליכה ברחוב: תוכנית ל-<space-walk> (walk.js המשותף) מתוך אותם נתוני
 * OpenStreetMap שהחתך מודד. בלי המצאה: קירות הבניינים הם התוואים האמיתיים,
 * הגובה הוא הקומות שב-OSM (או הערכה שמסומנת ככזו), והרחובות החוצים הם
 * הקווים מהמפה. אין כאן עצים, מדרכות או חניה, כי הם אינם בנתונים.
 *
 * מערכת הצירים: z לאורך הרחוב. ההולך מתחיל ב-z חיובי ופונה ל-z שלילי
 * (yaw 0 ב-walk.js), ו-x הוא ימין שלו. ארבע תחנות לאורך הדרך, אחת לכל שכבה.
 *
 * הקובץ טהור, כמו street-section.ts: בלי fetch ובלי DOM.
 */

import {
  DEFAULT_FLOORS,
  FLOOR_HEIGHT_M,
  along,
  knownFloors,
  nearestArc,
  projector,
  type LonLat,
  type OsmData,
} from "./street-section";
import { normalizeStreetName } from "./street-name";

export type LayerKey = "skeleton" | "section" | "frontage" | "texture";

/** סדר השכבות לאורך ההליכה: מהרשת, לחלל, לקיר, לגרעין. */
export const WALK_LAYERS: { key: LayerKey; title: string; color: string }[] = [
  { key: "skeleton", title: "שלד", color: "#3b4148" },
  { key: "section", title: "חתך", color: "#d8c49a" },
  { key: "frontage", title: "דופן", color: "#c9a36a" },
  { key: "texture", title: "מרקם", color: "#3f7f4f" },
];

/** חצי אורך ההליכה, במטרים. זה טווח הדגימות של מדידת החתך (±60 מ'). */
export const HALF_LENGTH_M = 60;
/** מרכז כל תחנה על ציר z: מתחילים ב-+40 ומסיימים ב-‎-40. */
export const STATION_Z = [40, 13, -13, -40];
/** נקודת ההתחלה, 6 מ' לפני קצה הדרך. */
export const SPAWN_Z = HALF_LENGTH_M - 6;
/** רוחב הרצועה סביב הציר שבה הבניינים נכנסים לסצנה. */
const SIDE_REACH_M = 48;

type XY = [number, number];

export interface WalkPlanItem {
  id: string;
  type: "prism" | "surface";
  points?: XY[];
  x?: number;
  z?: number;
  w?: number;
  d?: number;
  h?: number;
  rot?: number;
  layer?: number;
  color?: string;
  solid?: boolean;
  count?: boolean;
}

export interface WalkScene {
  /** הבניינים: תוואי, גובה, והאם הגובה ידוע מ-OSM. */
  buildings: { id: string; points: XY[]; h: number; known: boolean }[];
  /** קווי הרחובות (כולל הרחוב עצמו), כקטעים ישרים. */
  roads: { id: string; x: number; z: number; len: number; rot: number; own: boolean }[];
  /** כמה בניינים נכנסו, וכמה מהם עם קומות רשומות. */
  knownCount: number;
  spawnX: number;
  /** נקודה פנויה על כל תחנה, למעבר ישיר אליה. */
  stationX: number[];
  matchedByName: boolean;
}

/**
 * מעביר את נתוני OSM למערכת הצירים של ההליכה. מחזיר null כשאין רחוב קרוב.
 */
export function buildWalkScene(center: LonLat, data: OsmData, streetName = ""): WalkScene | null {
  const project = projector(center);
  const key = normalizeStreetName(streetName);
  const named = key ? data.roads.filter((r) => r.name && normalizeStreetName(r.name) === key) : [];
  const matchedByName = named.length > 0;
  const candidates = (matchedByName ? named : data.roads).map((r) => r.line.map(project));
  if (candidates.length === 0) return null;

  let road = candidates[0];
  let arc = nearestArc(road);
  for (const r of candidates.slice(1)) {
    const a = nearestArc(r);
    if (a.d < arc.d) {
      road = r;
      arc = a;
    }
  }

  /* כיוון הרחוב: מהנקודה 30 מ' אחורה ל-30 מ' קדימה, ולא מקטע אחד שעשוי להתעקם. */
  const a = along(road, Math.max(0, arc.s - 30)).p;
  const b = along(road, Math.min(arc.total, arc.s + 30)).p;
  let dir: XY = [b[0] - a[0], b[1] - a[1]];
  const l = Math.hypot(dir[0], dir[1]);
  dir = l > 1 ? [dir[0] / l, dir[1] / l] : along(road, arc.s).dir;
  const origin = along(road, arc.s).p;
  const right: XY = [dir[1], -dir[0]];
  const toLocal = (q: XY): XY => {
    const w: XY = [q[0] - origin[0], q[1] - origin[1]];
    const x = w[0] * right[0] + w[1] * right[1];
    const z = -(w[0] * dir[0] + w[1] * dir[1]);
    return [round(x), round(z)];
  };

  const buildings: WalkScene["buildings"] = [];
  let knownCount = 0;
  for (const bld of data.buildings) {
    const pts = bld.ring.map((p) => toLocal(project(p)));
    /* הטבעת סגורה ב-OSM: הנקודה האחרונה חוזרת על הראשונה. */
    if (pts.length > 3 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) {
      pts.pop();
    }
    if (pts.length < 3) continue;
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    if (Math.abs(cx) > SIDE_REACH_M || Math.abs(cz) > HALF_LENGTH_M + 20) continue;
    const floors = knownFloors(bld);
    if (floors !== null) knownCount++;
    buildings.push({
      id: `b${bld.id}`,
      points: pts,
      h: (floors ?? DEFAULT_FLOORS) * FLOOR_HEIGHT_M,
      known: floors !== null,
    });
  }

  const roads: WalkScene["roads"] = [];
  const ownLines = new Set((matchedByName ? named : []).map((r) => r.line));
  data.roads.forEach((r, ri) => {
    const pts = r.line.map((p) => toLocal(project(p)));
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, z1] = pts[i];
      const [x2, z2] = pts[i + 1];
      const len = Math.hypot(x2 - x1, z2 - z1);
      const mx = (x1 + x2) / 2;
      const mz = (z1 + z2) / 2;
      if (len < 0.5 || Math.abs(mx) > SIDE_REACH_M + 10 || Math.abs(mz) > HALF_LENGTH_M + 20) continue;
      /* rotation.y של θ מעביר את ציר x ל-(cosθ, -sinθ). */
      const rot = (Math.atan2(-(z2 - z1) / len, (x2 - x1) / len) * 180) / Math.PI;
      roads.push({ id: `r${ri}-${i}`, x: round(mx), z: round(mz), len: round(len), rot: round(rot), own: ownLines.has(r.line) });
    }
  });

  /* נקודת ההתחלה: על הציר, ואם בניין יושב שם (רחוב שמתעקם), זזים הצידה. */
  const freeX = (z: number) => {
    for (const dx of [0, 2, -2, 4, -4, 6, -6, 8, -8, 10, -10]) {
      if (!buildings.some((bd) => inPoly(dx, z, bd.points))) return dx;
    }
    return 0;
  };
  const spawnX = freeX(SPAWN_Z);
  const stationX = STATION_Z.map(freeX);

  return { buildings, roads, knownCount, spawnX, stationX, matchedByName };
}

/** השכבה שההולך נמצא בה, לפי z: כל שכבה מחזיקה רבע מהדרך. */
export function layerAt(z: number): number {
  const t = (HALF_LENGTH_M - z) / (2 * HALF_LENGTH_M);
  return Math.max(0, Math.min(3, Math.floor(t * 4)));
}

/** כמה מהדרך עברה, 0 עד 1. */
export function progressAt(z: number): number {
  return Math.max(0, Math.min(1, (HALF_LENGTH_M - z) / (2 * HALF_LENGTH_M)));
}

/**
 * התוכנית ל-walk.js. השכבה הפעילה צובעת את מה ששייך לה:
 * שלד = קווי הרחובות, חתך = הרצועה בין הקירות, דופן = הבניינים, מרקם = גרעין הבניינים לסירוגין.
 */
export function walkPlan(
  scene: WalkScene,
  opts: {
    id: string;
    title: string;
    widthM: number | null;
    active: number;
    spawn: { x: number; z: number; yaw: number };
    summaries: { insight: string; explain: string }[];
    source: string;
  },
) {
  const active = WALK_LAYERS[opts.active].key;
  const tint = (k: LayerKey, on: string, off: string) => (active === k ? on : off);
  const items: WalkPlanItem[] = [];

  /* חתך: הרצועה מקיר לקיר, ברוחב שנמדד. בלי חלוקה למדרכה ולכביש: היא אינה בנתונים. */
  if (opts.widthM) {
    items.push({
      id: "corridor",
      type: "surface",
      x: 0,
      z: 0,
      w: round(opts.widthM),
      d: HALF_LENGTH_M * 2 + 20,
      layer: 0,
      color: tint("section", "#e8d6a8", "#cdc8bd"),
      count: false,
    });
  }

  /* שלד: קווי הרחובות מהמפה. הרחוב עצמו כהה, החוצים בהירים יותר. */
  for (const r of scene.roads) {
    items.push({
      id: r.id,
      type: "surface",
      x: r.x,
      z: r.z,
      w: r.len + 0.4,
      d: r.own ? 0.9 : 0.6,
      rot: r.rot,
      layer: 2,
      color: active === "skeleton" ? (r.own ? "#1f2428" : "#3b4148") : r.own ? "#9a968d" : "#b3aea4",
      count: false,
    });
  }

  /* ארבע תחנות: פס רוחבי בצבע השכבה, הפעילה מלאה והשאר דהויות. */
  WALK_LAYERS.forEach((L, i) => {
    items.push({
      id: `station-${L.key}`,
      type: "surface",
      x: 0,
      z: STATION_Z[i],
      w: Math.max(6, (opts.widthM ?? 14) - 1),
      d: i === opts.active ? 1.6 : 0.8,
      layer: 3,
      color: i <= opts.active ? L.color : "#e2ddd2",
      count: false,
    });
  });

  scene.buildings.forEach((b, i) => {
    let color = "#e4e0d8";
    if (active === "frontage") color = b.known ? "#c9a36a" : "#d9bf93";
    if (active === "texture") color = i % 2 ? "#cfe0cf" : "#9cc29f";
    items.push({ id: b.id, type: "prism", points: b.points, h: b.h, color, count: false });
  });

  return {
    id: opts.id,
    title: opts.title,
    bounds: [-SIDE_REACH_M, -HALF_LENGTH_M - 4, SIDE_REACH_M, HALF_LENGTH_M + 4],
    spawn: opts.spawn,
    speed: 4,
    sky: "#e3e8ea",
    ground: "#efe6d4",
    heights: [
      { cm: 110, label: "ילד בן 6" },
      { cm: 125, label: "בכיסא גלגלים" },
      { cm: 160, label: "מבוגר עומד" },
    ],
    items,
    variants: WALK_LAYERS.map((L, i) => ({
      id: L.key,
      label: `${i + 1} ${L.title}`,
      items: [],
      summary: opts.summaries[i],
    })),
    rule:
      "**כלל התחנות:** כל שכבה מחזיקה **רבע** מ-**120 מ'** של הליכה. הבניינים הם התוואים מ-OpenStreetMap; " +
      "גובה = קומות × **3 מ'**, ובלי קומות רשומות **4 קומות** כהערכה (צבע בהיר יותר בשכבת הדופן). " +
      "מגבלה: אין בנתונים עצים, מדרכות וחניה, ולכן הם לא מצוירים.",
    source: opts.source,
  };
}

function inPoly(x: number, z: number, pts: XY[]): boolean {
  let ins = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i];
    const [xj, zj] = pts[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
}

const round = (n: number) => Math.round(n * 100) / 100;
