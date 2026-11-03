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
 * רץ ב-GitHub Actions (.github/workflows/fetch-sections.yml), שם יש גישה ל-Overpass.
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
  const json = await overpass(s.center);
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
