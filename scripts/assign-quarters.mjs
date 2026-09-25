/**
 * Turns the municipal street→quarter list into a generated lookup keyed by the
 * national registry code.
 *
 *   node scripts/assign-quarters.mjs
 *
 * Input:  data/ashdod-street-quarters.csv   (שם הרחוב,רובע — maintained by staff)
 * Output: lib/street-quarters.generated.ts  (never edited by hand)
 *
 * A name that the registry does not recognise is reported and left out. The
 * app must not invent a quarter for a street it cannot identify.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Quarter label as staff write it → the quarter id the app uses. */
const QUARTER_IDS = {
  "רובע א'": "q-a",
  "רובע ב'": "q-b",
  "רובע ג'": "q-c",
  "רובע ד'": "q-d",
  "רובע ה'": "q-e",
  "רובע ו'": "q-f",
  "רובע ז'": "q-g",
  "רובע ח'": "q-h",
  "רובע ט'": "q-i",
  "רובע י'": "q-j",
  'רובע י"א': "q-k",
  'רובע י"ב': "q-l",
  'רובע י"ג': "q-m",
  'רובע י"ד': "q-n",
  'רובע ט"ו': "q-o",
  'רובע ט"ז': "q-p",
  'רובע י"ז': "q-q",
  המרינה: "q-marina",
  "הקריה (הסיטי)": "q-city",
  'מע"ר דרום': "q-cbd-south",
  "ציר ראשי חוצה": "q-main-axis",
  "עורף הנמל": "q-port",
  "אזור תעשייה עד הלום": "q-ind-ad-halom",
  "אזור תעשייה קריית חלוצים": "q-ind-halutzim",
  "אזור תעשייה קלה": "q-ind-light",
  "אזור תעשייה צפוני": "q-ind-north",
};

// The same normalisation the app uses, kept in step with lib/street-name.ts.
const GERESH = /[׳‘’`´]/g;
const GERSHAYIM = /[״“”«»]/g;
const PREFIXES = [
  "רחוב", "רח'", "רח", "שדרות", "שדרה", "שד'", "שד", "דרך", "כיכר", "ככר",
  "כיכרת", "סמטת", "סמטה", "משעול", "שביל", "טיילת", "מדרחוב",
];

function normalize(raw) {
  let text = String(raw ?? "")
    .replace(GERSHAYIM, '"')
    .replace(GERESH, "'")
    .replace(/[\s ]+/g, " ")
    .trim();
  for (const prefix of PREFIXES) {
    if (text.startsWith(prefix + " ")) {
      text = text.slice(prefix.length + 1).trim();
      break;
    }
  }
  return text;
}

const key = (raw) => normalize(raw).replace(/["']/g, "").toLowerCase();
const tokenKey = (raw) =>
  key(raw).split(" ").filter(Boolean).sort().join(" ");

/** A CSV row splitter that treats a quote as opening a field only at its start. */
function parseCsv(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const fields = [];
      let field = "";
      let quoted = false;
      for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        if (char === '"' && field.length === 0 && !quoted) quoted = true;
        else if (char === '"' && quoted) {
          if (line[i + 1] === '"') {
            field += '"';
            i += 1;
          } else quoted = false;
        } else if (char === "," && !quoted) {
          fields.push(field);
          field = "";
        } else field += char;
      }
      fields.push(field);
      return fields.map((f) => f.trim());
    });
}

const registry = JSON.parse(
  readFileSync(join(root, "data/ashdod-streets.json"), "utf8"),
);

const byKey = new Map();
const byTokens = new Map();
for (const street of registry.streets) {
  for (const spelling of [street.name, ...street.synonyms]) {
    if (!byKey.has(key(spelling))) byKey.set(key(spelling), street);
    const tk = tokenKey(spelling);
    if (!tk) continue;
    const seen = byTokens.get(tk);
    if (seen === undefined) byTokens.set(tk, street);
    else if (seen && seen.code !== street.code) byTokens.set(tk, null);
  }
}

function findStreet(name) {
  return byKey.get(key(name)) ?? byTokens.get(tokenKey(name)) ?? null;
}

const rows = parseCsv(readFileSync(join(root, "data/ashdod-street-quarters.csv"), "utf8"));
const [header, ...body] = rows;
if (header[0] !== "שם הרחוב" || header[1] !== "רובע") {
  console.error("כותרת לא צפויה בקובץ:", header.join(","));
  process.exit(1);
}

const assignments = new Map(); // code -> { quarterId, name }
const unknownStreets = [];
const unknownQuarters = new Set();
const conflicts = [];
const resolved = [];
const seenNames = new Set();

for (const [rawName, rawQuarter] of body) {
  if (!rawName) continue;
  const nameKey = key(rawName);
  if (seenNames.has(nameKey)) continue;
  seenNames.add(nameKey);

  const quarterId = QUARTER_IDS[rawQuarter];
  if (!quarterId) {
    unknownQuarters.add(rawQuarter);
    continue;
  }

  const street = findStreet(rawName);
  if (!street) {
    unknownStreets.push(rawName);
    continue;
  }

  const existing = assignments.get(street.code);
  if (existing && existing.quarterId !== quarterId) {
    /*
     * Two spellings of one street with different quarters. The registry knows
     * them as the same street, so one quarter has to win — and the row whose
     * name is the registry's own name is the one that wins. When neither row
     * matches it, nothing is chosen and the pair is reported instead.
     */
    const officialKey = key(street.name);
    const existingIsOfficial = key(existing.source) === officialKey;
    const currentIsOfficial = key(rawName) === officialKey;

    if (currentIsOfficial && !existingIsOfficial) {
      resolved.push(
        `${street.name}: נבחר "${rawName}" (השם במרשם) ולא "${existing.source}"`,
      );
      assignments.set(street.code, { quarterId, source: rawName, name: street.name });
    } else if (existingIsOfficial && !currentIsOfficial) {
      resolved.push(
        `${street.name}: נבחר "${existing.source}" (השם במרשם) ולא "${rawName}"`,
      );
    } else {
      conflicts.push(`${street.name}: ${existing.source} ↔ ${rawName}`);
    }
    continue;
  }
  assignments.set(street.code, { quarterId, source: rawName, name: street.name });
}

const entries = [...assignments.entries()].sort((a, b) =>
  a[1].name.localeCompare(b[1].name, "he"),
);

const out = [
  "/**",
  " * נוצר אוטומטית מתוך data/ashdod-street-quarters.csv על ידי",
  " * scripts/assign-quarters.mjs. אין לערוך ידנית — לערוך את ה-CSV ולהריץ מחדש.",
  " *",
  ` * ${entries.length} רחובות משויכים מתוך ${body.length} שורות בקובץ המקור.`,
  " */",
  "",
  "export const STREET_QUARTERS: Record<string, string> = {",
  ...entries.map(([code, v]) => `  "${code}": "${v.quarterId}", // ${v.name}`),
  "};",
  "",
].join("\n");

writeFileSync(join(root, "lib/street-quarters.generated.ts"), out);

/*
 * A report staff can open and fix at the source. Every line is a street the
 * app cannot place, with the reason, so the CSV can be corrected rather than
 * the mapping guessed.
 */
// Hebrew names contain gershayim ("), so every field is quoted and doubled.
const csvField = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

const report = [
  "שם הרחוב ברשימת העירייה,רובע ברשימה,הסיבה",
  ...unknownStreets.map((name) => {
    const row = body.find(([n]) => n === name);
    return [name, row?.[1] ?? "", "לא נמצא במרשם הרחובות הארצי"]
      .map(csvField)
      .join(",");
  }),
  ...conflicts.map((c) =>
    [c, "", "שני שמות באותה רשומת מרשם עם רובע שונה"].map(csvField).join(","),
  ),
  "",
].join("\n");
writeFileSync(join(root, "data/ashdod-street-quarters.unmatched.csv"), report);

console.log(`שורות בקובץ המקור: ${body.length}`);
console.log(`שויכו לקוד רשמי:   ${entries.length}`);
if (unknownQuarters.size > 0) {
  console.log(`\nשמות רובע שאינם מוכרים (${unknownQuarters.size}):`);
  for (const q of unknownQuarters) console.log(`  ${q}`);
}
if (resolved.length > 0) {
  console.log(`\nשני שמות לאותו רחוב — נבחר השם שבמרשם (${resolved.length}):`);
  for (const r of resolved) console.log(`  ${r}`);
}
if (conflicts.length > 0) {
  console.log(`\nסתירות — אותו רחוב לשני רובעים (${conflicts.length}):`);
  for (const c of conflicts) console.log(`  ${c}`);
}
if (unknownStreets.length > 0) {
  console.log(`\nלא נמצאו במרשם הרחובות הארצי (${unknownStreets.length}):`);
  for (const s of unknownStreets) console.log(`  ${s}`);
}
