/**
 * הערכת סוג רחוב משכבת הרחובות העירונית (data/streets.geojson, מ-rehevot.shp).
 *
 *   node scripts/build-gis-typology.mjs
 *
 * משמעות הקודים של "מידרג" ו"סוג" לא נמסרה מהעירייה. הכלל כאן הוא פענוח
 * מתוך הנתונים עצמם (בדיקה מ-08.11.2026): מידרג 1 = הצירים הראשיים (ז'בוטינסקי,
 * בגין, רבין), סוג 1 = שדרות (שד' בן גוריון, שד' הרצל), סוג 3 = רחובות
 * מסחר מקומיים (רוגוזין, העצמאות, העבודה), מידרג 10 / סוג 6 = מדרחובות,
 * מידרג 2-4 = רחובות מגורים, 5 = אזור תעשייה, 8 = כבישים בין־עירוניים,
 * 9 = חניות. לכן זו **הערכה**, שמוצגת כך, וסיווג הצוות תמיד גובר עליה.
 *
 * לכל סמל רחוב נבחר הסוג שמכסה את רוב האורך של הקטעים שלו.
 */
import { readFileSync, writeFileSync } from "node:fs";

const geo = JSON.parse(readFileSync("data/streets.geojson", "utf8"));

function typeOf(p) {
  const name = String(p.name ?? "");
  const h = Number(p.hierarchy);
  const t = Number(p.type);
  if (h === 9 || h === 8 || h === 0) return null;
  if (name.startsWith("מדרחוב") || h === 10 || t === 6) return "pedestrian_mall";
  if (name.includes("טיילת")) return "linear_park";
  if (t === 1 || name.startsWith("שד ")) return "boulevard";
  if (h === 1) return "main_commercial";
  if (t === 3) return "neighborhood_commercial";
  if (h >= 2 && h <= 4) return "residential";
  return null;
}

function length(geom) {
  const lines = geom.type === "LineString" ? [geom.coordinates] : geom.coordinates;
  let sum = 0;
  for (const line of lines)
    for (let i = 1; i < line.length; i++) {
      const [x1, y1] = line[i - 1];
      const [x2, y2] = line[i];
      const dx = (x2 - x1) * 94_800; // מטרים למעלה אורך בקו הרוחב של אשדוד
      const dy = (y2 - y1) * 111_000;
      sum += Math.hypot(dx, dy);
    }
  return sum;
}

const byCode = new Map();
for (const f of geo.features) {
  const code = f.properties.code;
  if (!code || !f.geometry) continue;
  const type = typeOf(f.properties);
  if (!type) continue;
  const m = byCode.get(code) ?? new Map();
  m.set(type, (m.get(type) ?? 0) + length(f.geometry));
  byCode.set(code, m);
}

const out = {};
for (const [code, m] of [...byCode].sort((a, b) => Number(a[0]) - Number(b[0]))) {
  const [type] = [...m].sort((a, b) => b[1] - a[1])[0];
  out[code] = type;
}

const counts = {};
for (const t of Object.values(out)) counts[t] = (counts[t] ?? 0) + 1;

writeFileSync(
  "lib/gis-typology.generated.ts",
  `// נוצר ב-scripts/build-gis-typology.mjs. לא לערוך ידנית.\n` +
    `// ${Object.keys(out).length} רחובות: ${JSON.stringify(counts)}\n` +
    `export const GIS_TYPOLOGY: Record<string, string> = ${JSON.stringify(out, null, 0)};\n`,
);
console.log(Object.keys(out).length, counts);
