/**
 * אייקון לכל רובע, ואייקון לעיר — נגזרים מהנתונים, לא מצוירים ביד.
 *
 *   node scripts/build-quarter-icons.mjs
 *
 * לכל רובע: קו המתאר מקובץ הרובעים (public/geo/ashdod-rovaim.geojson),
 * והרחובות שבתוכו משכבת הרחובות העירונית (data/streets.geojson):
 * מידרג 1–2 בקו עבה (הצירים), מידרג 3 בקו דק (המשניים). רחוב נכנס לרובע
 * לפי הנקודות שלו שנמצאות בתוך הפוליגון, כך שגם ציר חוצה רובעים נחתך לקטע
 * שלו. הכול מנורמל ל-viewBox של 48x48 ומפושט (Douglas–Peucker), כדי שיישאר
 * קריא גם ב-24 פיקסלים.
 *
 * לרובעים שאין להם פוליגון בקובץ (ז', וכן האזורים שאינם רובעים — עורף הנמל,
 * אזורי התעשייה) קו המתאר הוא המעטפת הקמורה של קטעי הרחובות שהשכבה העירונית
 * משייכת להם בשדה "רובע". זה קירוב, ומסומן `approximate: true`.
 * לרובע י"ד אין לא פוליגון ולא רחובות בשכבה, ולכן אין לו אייקון.
 *
 * העיר: כל קווי המתאר של הרובעים, והצירים (מידרג 1) מעליהם.
 */
import { readFileSync, writeFileSync } from "node:fs";

const SIZE = 48;
const PAD = 3;

const rovaim = JSON.parse(readFileSync("public/geo/ashdod-rovaim.geojson", "utf8"));
const streets = JSON.parse(readFileSync("data/streets.geojson", "utf8"));

// מקור: ROVA_CODE_TO_QUARTER ב-lib/city.ts. רובע 19 (מע"ר צפון) אינו אזור באפליקציה.
const ROVA_CODE_TO_QUARTER = {
  1: "q-a", 2: "q-b", 3: "q-c", 4: "q-d", 5: "q-e", 6: "q-f", 7: "q-g", 8: "q-h",
  9: "q-i", 10: "q-j", 11: "q-k", 12: "q-l", 13: "q-m", 14: "q-n", 15: "q-o",
  16: "q-p", 17: "q-q", 20: "q-city", 23: "q-marina", 32: "q-cbd-south",
};

// אזורים בלי פוליגון: שמות השדה "רובע" בשכבת הרחובות שמתאימים להם.
const BY_STREET_QUARTER_NAME = {
  "q-g": ["רובע ז"],
  "q-port": ["עורף הנמל"],
  "q-ind-north": ["תעשייה הצפוני", "תעשייה צפון חדש"],
  "q-ind-light": ["תעשייה קלה", "אזור תעשיה קלה"],
};

// הטלה מקומית: מטרים בקירוב, צפון למעלה.
const LAT0 = 31.8;
const KX = Math.cos((LAT0 * Math.PI) / 180);
const proj = ([lon, lat]) => [lon * KX, -lat];

function lines(geom) {
  if (!geom) return [];
  if (geom.type === "LineString") return [geom.coordinates];
  if (geom.type === "MultiLineString") return geom.coordinates;
  return [];
}

function outerRing(geom) {
  if (geom.type === "Polygon") return geom.coordinates[0];
  // MultiPolygon: הטבעת הגדולה ביותר.
  return geom.coordinates.map((p) => p[0]).sort((a, b) => b.length - a.length)[0];
}

function inside([x, y], ring) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const pt of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pt) <= 0) lower.pop();
    lower.push(pt);
  }
  const upper = [];
  for (const pt of p.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pt) <= 0) upper.pop();
    upper.push(pt);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1), lower[0]];
}

function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let max = 0;
  let idx = 0;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1e-12;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / len;
    if (d > max) {
      max = d;
      idx = i;
    }
  }
  if (max <= tol) return [a, b];
  return [...simplify(pts.slice(0, idx + 1), tol).slice(0, -1), ...simplify(pts.slice(idx), tol)];
}

/** טבעת סגורה: מפצלים בנקודה הרחוקה מההתחלה, אחרת שני הקצוות זהים והכול קורס. */
function simplifyRing(ring, tol) {
  const a = ring[0];
  let far = 1;
  let best = -1;
  ring.forEach((p, i) => {
    const d = Math.hypot(p[0] - a[0], p[1] - a[1]);
    if (d > best) {
      best = d;
      far = i;
    }
  });
  return [...simplify(ring.slice(0, far + 1), tol).slice(0, -1), ...simplify(ring.slice(far), tol)];
}

/** רצפים של נקודות שבתוך הטבעת — הקטע של הרחוב שבתוך הרובע. */
function clip(line, ring) {
  const runs = [];
  let run = [];
  for (const pt of line) {
    if (inside(pt, ring)) run.push(pt);
    else {
      if (run.length >= 2) runs.push(run);
      run = [];
    }
  }
  if (run.length >= 2) runs.push(run);
  return runs;
}

function fitter(ring) {
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const span = Math.max(maxX - minX, maxY - minY) || 1e-9;
  const scale = (SIZE - 2 * PAD) / span;
  const ox = PAD + (SIZE - 2 * PAD - (maxX - minX) * scale) / 2;
  const oy = PAD + (SIZE - 2 * PAD - (maxY - minY) * scale) / 2;
  return {
    // RTL אינו משפיע על גאוגרפיה: מזרח נשאר מימין, כמו במפה.
    tf: ([x, y]) => [ox + (x - minX) * scale, oy + (y - minY) * scale],
    tol: span / 60,
    tolLine: span / 45,
  };
}

const r1 = (n) => Math.round(n * 10) / 10;
const path = (pts, close = false) =>
  pts.map((p, i) => `${i ? "L" : "M"}${r1(p[0])} ${r1(p[1])}`).join("") + (close ? "Z" : "");

// קטעי הרחובות, מוטלים.
const segs = [];
for (const f of streets.features) {
  const h = Number(f.properties.hierarchy);
  if (!(h >= 1 && h <= 3)) continue;
  for (const l of lines(f.geometry)) {
    segs.push({ h, q: String(f.properties.quarter ?? "").trim(), pts: l.map(proj) });
  }
}

function iconFor(ring, members, approximate) {
  const { tf, tol, tolLine } = fitter(ring);
  const outline = path(simplifyRing(ring, tol).map(tf), true);
  const main = [];
  const minor = [];
  for (const s of members) {
    const runs = approximate ? [s.pts] : clip(s.pts, ring);
    for (const run of runs) {
      const simp = simplify(run, tolLine).map(tf);
      const d = path(simp);
      const len = simp.reduce((acc, p, i) => (i ? acc + Math.hypot(p[0] - simp[i - 1][0], p[1] - simp[i - 1][1]) : 0), 0);
      if (s.h <= 2 && len > 2) main.push(d);
      else if (s.h === 3 && len > 4) minor.push(d);
    }
  }
  return { outline, main: main.join(""), minor: minor.join(""), ...(approximate ? { approximate: true } : {}) };
}

const icons = {};
const rings = [];
for (const f of rovaim.features) {
  const id = ROVA_CODE_TO_QUARTER[f.properties.rova_code];
  const ring = outerRing(f.geometry).map(proj);
  rings.push(ring);
  if (!id) continue;
  // רחוב שייך לרובע לפי הגאומטריה, לא לפי השם.
  const members = segs.filter((s) => s.pts.some((p) => inside(p, ring)));
  icons[id] = iconFor(ring, members, false);
}

for (const [id, names] of Object.entries(BY_STREET_QUARTER_NAME)) {
  if (icons[id]) continue;
  const members = segs.filter((s) => names.includes(s.q));
  if (members.length === 0) continue;
  const ring = hull(members.flatMap((s) => s.pts));
  icons[id] = iconFor(ring, members, true);
}

// העיר: כל הרובעים, והצירים הראשיים מעליהם.
const all = rings.flat();
const cityRing = hull(all);
const { tf, tol, tolLine } = fitter(cityRing);
const city = {
  outline: rings.map((r) => path(simplifyRing(r, tol / 2).map(tf), true)).join(""),
  // הצירים נחתכים לגבול העיר, אחרת כבישי הגישה מהצפון יוצאים מהמסגרת.
  main: segs
    .filter((s) => s.h === 1)
    .flatMap((s) => clip(s.pts, cityRing))
    .map((run) => path(simplify(run, tolLine / 2).map(tf)))
    .join(""),
  minor: "",
  // בגודל קטן: רק קו המתאר של העיר כולה, בלי 19 הרובעים.
  hull: path(simplifyRing(cityRing, tol).map(tf), true),
};

const body =
  `// נוצר ב-scripts/build-quarter-icons.mjs מקובץ הרובעים ומשכבת הרחובות העירונית. לא לערוך ידנית.\n` +
  `export interface QuarterIconPaths {\n  outline: string;\n  main: string;\n  minor: string;\n  /** קו המתאר הוא מעטפת קמורה של הרחובות, לא גבול רשמי. */\n  approximate?: boolean;\n  /** לעיר בלבד: קו מתאר אחד, לגדלים קטנים. */\n  hull?: string;\n}\n\n` +
  `export const QUARTER_ICONS: Record<string, QuarterIconPaths> = ${JSON.stringify(icons, null, 1)};\n\n` +
  `export const CITY_ICON: QuarterIconPaths = ${JSON.stringify(city, null, 1)};\n`;
writeFileSync("lib/quarter-icons.generated.ts", body);
console.log(Object.keys(icons).length, "icons:", Object.keys(icons).join(" "), "| bytes", body.length);
