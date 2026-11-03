/**
 * שומר מראש את נתוני OpenStreetMap לחתך של כל רחוב, ב-public/geo/sections/<id>.json.
 *
 * למה: שרתי Overpass הציבוריים מחזירים 502 בשעות עומס ("at capacity"), ואז החתך
 * בדף הרחוב לא נטען (נראה ב-03.11.2026). קובץ שמור מוגש מהאפליקציה עצמה, ולא
 * תלוי בשרת חיצוני. השרת החי נשאר רק לרחוב שאין לו עדיין קובץ.
 *
 *   node scripts/fetch-sections.mjs          רק רחובות בלי קובץ
 *   node scripts/fetch-sections.mjs --all    כולם מחדש
 *
 * רץ ב-GitHub Actions (.github/workflows/fetch-sections.yml).
 *
 * מקור ראשון: ה-API הרשמי של OpenStreetMap (api/0.6/map, תיבה קטנה סביב המרכז). מקור שני: Overpass.
 * ב-03.11.2026 שרתי Overpass לא היו נגישים מ-GitHub Actions (שגיאת רשת מיידית, ו-429 בשרת החלופי),
 * וה-API הרשמי ענה. תיבה של כ-180 על 180 מ' מכסה את שבע הדגימות לאורך הרחוב ואת טווח החיפוש של הקיר.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const outDir = join(root, "public/geo/sections");
mkdirSync(outDir, { recursive: true });

// לא סודות: ראו lib/supabase/config.ts.
const SUPABASE_URL = "https://cbhexpybdggwzyakgagd.supabase.co";
const KEY = "sb_publishable_1KSwG6rqTzBSHmI2RxX6Fw_EEcuKzk3";
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const KEEP_TAGS = ["building", "building:levels", "height", "highway", "name"];
const all = process.argv.includes("--all");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function query([lon, lat]) {
  // זהה ל-overpassQuery ב-lib/street-section.ts
  return (
    `[out:json][timeout:25];(` +
    `way(around:110,${lat},${lon})["building"];` +
    `way(around:40,${lat},${lon})["highway"];` +
    `);out tags geom;`
  );
}

/** תיבה סביב המרכז, במעלות: כ-90 מ' לכל כיוון. */
const BOX_LAT = 0.0008;
const BOX_LON = 0.00095;
const STREET_CLASSES = new Set(["trunk", "primary", "secondary", "tertiary", "unclassified", "residential", "living_street", "pedestrian"]);

/** ה-API הרשמי מחזיר XML. מפרקים אותו לאותה צורה שמחזיר Overpass: way עם tags ו-geometry. */
async function osmApi([lon, lat]) {
  const bbox = [lon - BOX_LON, lat - BOX_LAT, lon + BOX_LON, lat + BOX_LAT].map((n) => n.toFixed(6)).join(",");
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`https://api.openstreetmap.org/api/0.6/map?bbox=${bbox}`, {
        headers: { "User-Agent": "NiceStreets-GH/1.0 (github.com/Anat1969/NiceStreets-GH)" },
        signal: AbortSignal.timeout(45000),
      });
      if (!res.ok) { console.log(`  OSM API: ${res.status}`); await sleep(5000); continue; }
      const xml = await res.text();
      const nodes = new Map();
      for (const m of xml.matchAll(/<node\b([^>]*)>/g)) {
        const a = m[1];
        const id = a.match(/\bid="(\d+)"/)?.[1];
        const la = a.match(/\blat="([-\d.]+)"/)?.[1];
        const lo = a.match(/\blon="([-\d.]+)"/)?.[1];
        if (id && la && lo) nodes.set(id, { lat: +la, lon: +lo });
      }
      const elements = [];
      for (const m of xml.matchAll(/<way\b([^>]*)>([\s\S]*?)<\/way>/g)) {
        const id = Number(m[1].match(/\bid="(\d+)"/)?.[1]);
        const tags = {};
        for (const t of m[2].matchAll(/<tag k="([^"]+)" v="([^"]*)"\s*\/>/g)) tags[t[1]] = t[2].replace(/&quot;/g, '"').replace(/&amp;/g, "&");
        if (!tags.building && !STREET_CLASSES.has(tags.highway)) continue;
        const geometry = [...m[2].matchAll(/<nd ref="(\d+)"\s*\/>/g)].map((r) => nodes.get(r[1])).filter(Boolean);
        if (geometry.length >= 2) elements.push({ type: "way", id, tags, geometry });
      }
      return { elements };
    } catch (e) {
      console.log(`  OSM API: ${e.name}`);
      await sleep(5000);
    }
  }
  return null;
}

async function overpass(center) {
  const body = "data=" + encodeURIComponent(query(center));
  let wait = 5000;
  for (let round = 0; round < 6; round++) {
    for (const url of ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method: "POST",
          body,
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          signal: AbortSignal.timeout(45000),
        });
        if (res.ok) return await res.json();
        console.log(`  ${url}: ${res.status}`);
      } catch (e) {
        console.log(`  ${url}: ${e.name}`);
      }
    }
    console.log(`  כל השרתים עמוסים, ממתין ${wait / 1000} שניות`);
    await sleep(wait);
    wait = Math.min(wait * 2, 60000);
  }
  return null;
}

/** רק מה שהחתך צריך: פחות משקל, ובלי מידע שאינו נדרש. */
function compact(json) {
  return (json.elements ?? [])
    .filter((e) => e.type === "way" && Array.isArray(e.geometry))
    .map((e) => ({
      type: "way",
      id: e.id,
      tags: Object.fromEntries(KEEP_TAGS.filter((k) => e.tags?.[k]).map((k) => [k, e.tags[k]])),
      geometry: e.geometry.map((p) => ({ lat: +p.lat.toFixed(6), lon: +p.lon.toFixed(6) })),
    }));
}

const res = await fetch(`${SUPABASE_URL}/rest/v1/streets?select=id,name,center&center=not.is.null`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
});
if (!res.ok) throw new Error(`Supabase ${res.status}`);
const streets = await res.json();
console.log(`${streets.length} רחובות עם מרכז`);

let saved = 0;
let failed = 0;
for (const s of streets) {
  const file = join(outDir, `${s.id}.json`);
  if (!all && existsSync(file)) continue;
  console.log(`${s.name}`);
  const json = (await osmApi(s.center)) ?? (await overpass(s.center));
  if (!json) {
    failed++;
    continue;
  }
  writeFileSync(
    file,
    JSON.stringify({
      street: s.name,
      center: s.center,
      fetchedAt: new Date().toISOString().slice(0, 10),
      source: "© OpenStreetMap contributors, ODbL",
      elements: compact(json),
    }),
  );
  saved++;
  await sleep(2000);
}
console.log(`נשמרו ${saved}, נכשלו ${failed}`);
