/**
 * הרובע של כל רחוב, משכבת הרחובות העירונית (data/streets.geojson, מ-rehevot.shp).
 *
 *   node scripts/build-gis-quarters.mjs
 *
 * לכל סמל רחוב: הרובע שמכסה את רוב האורך של הקטעים שלו, ואחוז האורך שבו.
 * רחוב שאף רובע אינו מכסה ממנו מחצית, ועובר בשלושה רובעים לפחות, מוצע
 * כ"ציר ראשי חוצה עיר" (q-main-axis), כמו השדרות שכבר מסווגות כך.
 *
 * שמות הרובעים בשכבה אינם אחידים ("רוביע י", " רובע י", "מע''ר דרום"). הם
 * מנורמלים כאן. אזורים שאין להם אזור מקביל באפליקציה (בקמה, שמעון פרס,
 * תעשייה כבדה, פארק עוגנים, קריית פארק לכיש) נשארים בלי הצעה, עם השם מהשכבה.
 */
import { readFileSync, writeFileSync } from "node:fs";

const geo = JSON.parse(readFileSync("data/streets.geojson", "utf8"));

const LETTERS = {
  "א": "q-a", "ב": "q-b", "ג": "q-c", "ד": "q-d", "ה": "q-e", "ו": "q-f",
  "ז": "q-g", "ח": "q-h", "ט": "q-i", "י": "q-j", "יא": "q-k", "יב": "q-l",
  "יג": "q-m", "יד": "q-n", "טו": "q-o", "טז": "q-p", "יז": "q-q",
};
const AREAS = [
  [/מרינה/, "q-marina"],
  [/סיטי|קרי?יה/, "q-city"],
  [/מער דרום/, "q-cbd-south"],
  [/עורף הנמל/, "q-port"],
  [/תעשי+ה.*צפו/, "q-ind-north"],
  [/תעשי+ה קלה/, "q-ind-light"],
];

function normalize(raw) {
  return String(raw ?? "")
    .replace(/['"״׳`]/g, "")
    .replace(/^\s*(רובע|רוביע)\s+/, "")
    .replace(/^אזור\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function quarterId(raw) {
  const name = normalize(raw);
  if (!name) return null;
  if (LETTERS[name]) return LETTERS[name];
  for (const [re, id] of AREAS) if (re.test(name)) return id;
  return null;
}

function length(geom) {
  const lines = geom.type === "LineString" ? [geom.coordinates] : geom.coordinates;
  let sum = 0;
  for (const line of lines)
    for (let i = 1; i < line.length; i++) {
      const dx = (line[i][0] - line[i - 1][0]) * 94_800;
      const dy = (line[i][1] - line[i - 1][1]) * 111_000;
      sum += Math.hypot(dx, dy);
    }
  return sum;
}

const byCode = new Map();
for (const f of geo.features) {
  const p = f.properties;
  if (!p.code || !f.geometry || Number(p.hierarchy) === 9) continue;
  const key = quarterId(p.quarter) ?? `?${normalize(p.quarter) || "ללא רובע"}`;
  const m = byCode.get(p.code) ?? new Map();
  m.set(key, (m.get(key) ?? 0) + length(f.geometry));
  byCode.set(p.code, m);
}

const out = {};
let main = 0;
let unmapped = 0;
for (const [code, m] of [...byCode].sort((a, b) => Number(a[0]) - Number(b[0]))) {
  const total = [...m.values()].reduce((s, v) => s + v, 0);
  const ranked = [...m].sort((a, b) => b[1] - a[1]);
  const [topKey, topLen] = ranked[0];
  const share = Math.round((topLen / total) * 100);
  const known = ranked.filter(([k]) => !k.startsWith("?"));
  let id = topKey.startsWith("?") ? null : topKey;
  let note = topKey.startsWith("?") ? topKey.slice(1) : null;
  if (share < 50 && known.length >= 3) {
    id = "q-main-axis";
    note = null;
    main++;
  }
  if (!id) unmapped++;
  // כל הרובעים שהרחוב עובר בהם, מהארוך לקצר (ענת, 09.11.2026: "אם הוא בכמה רובעים
  // אז להראות את האייקון של כולם"). רק רובעים שיש להם מקביל באפליקציה.
  const all = known.filter(([, len]) => len / total >= 0.05).map(([k]) => k);
  out[code] = { q: id, share, n: m.size, ...(all.length > 1 ? { all } : {}), ...(note ? { note } : {}) };
}

writeFileSync(
  "lib/gis-quarter.generated.ts",
  `// נוצר ב-scripts/build-gis-quarters.mjs. לא לערוך ידנית.\n` +
    `// ${Object.keys(out).length} רחובות · ${main} צירים חוצי עיר · ${unmapped} בלי אזור מקביל באפליקציה\n` +
    `export interface GisQuarter {\n  /** מזהה הרובע באפליקציה, או null כשאין לו מקביל. */\n  q: string | null;\n  /** אחוז מאורך הרחוב שנמצא ברובע הזה. */\n  share: number;\n  /** בכמה רובעים הרחוב עובר. */\n  n: number;\n  /** שם האזור בשכבה, כשאין לו מקביל באפליקציה. */\n  note?: string;\n  /** כל הרובעים שהרחוב עובר בהם (5% מהאורך ומעלה), כשהם יותר מאחד. */\n  all?: string[];\n}\n` +
    `export const GIS_QUARTER: Record<string, GisQuarter> = ${JSON.stringify(out)};\n`,
);
console.log(Object.keys(out).length, "streets ·", main, "main axes ·", unmapped, "unmapped");
