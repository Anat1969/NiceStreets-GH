#!/usr/bin/env node
/**
 * One-time merge of street rows onto the national registry.
 *
 *   node scripts/dedupe-streets.mjs streets.json          # report only
 *   node scripts/dedupe-streets.mjs streets.json --sql    # also print the SQL
 *
 * Input: a JSON array of the existing rows, each {id, name, votes, photos}.
 * Every name is resolved through the same normalisation the app uses, so the
 * spellings residents produced collapse onto one registry code.
 *
 * Nothing is merged on a guess: a name the registry does not know is reported
 * with near matches for staff to decide, and left untouched.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const registry = require("../data/ashdod-streets.json");

const GERESH = /[׳‘’`´]/g;
const GERSHAYIM = /[״“”«»]/g;
const PREFIXES = ["רחוב","רח'","רח","שדרות","שדרה","שד'","שד","דרך","כיכר","ככר","כיכרת","סמטת","סמטה","משעול","שביל","טיילת","מדרחוב"];

function normalize(raw) {
  let t = (raw ?? "").normalize("NFC").trim();
  t = t.replace(GERESH, "'").replace(GERSHAYIM, '"');
  t = t.replace(/[֑-ׇ]/g, "").replace(/[.,;:()\[\]־–—]/g, " ");
  t = t.replace(/\s+/g, " ").trim();
  let stripped = true;
  while (stripped) {
    stripped = false;
    for (const p of PREFIXES) {
      if (t === p) return t;
      if (t.startsWith(p + " ")) { t = t.slice(p.length + 1).trim(); stripped = true; break; }
    }
  }
  return t.replace(/^['"]+|['"]+$/g, "").trim();
}
const key = (s) => normalize(s).replace(/[\s'"]/g, "");
const tokenKey = (s) => normalize(s).replace(/['"]/g, "").split(" ").filter(Boolean).sort().join(" ");

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
const resolve = (name) => byKey.get(key(name)) ?? byTokens.get(tokenKey(name)) ?? null;

function suggestions(name) {
  const n = normalize(name);
  const parts = n.split(" ").filter((w) => w.length > 2);
  return registry.streets
    .filter((s) => parts.some((w) => s.name.includes(w) || s.synonyms.some((x) => x.includes(w))))
    .slice(0, 3)
    .map((s) => `${s.name} (${s.code})`);
}

const rows = JSON.parse(readFileSync(process.argv[2], "utf8"));
const byCode = new Map();
const unmatched = [];

for (const row of rows) {
  const hit = resolve(row.name);
  if (!hit) { unmatched.push(row); continue; }
  if (!byCode.has(hit.code)) byCode.set(hit.code, { street: hit, rows: [] });
  byCode.get(hit.code).rows.push(row);
}

const merges = [];
const renames = [];
const sql = [];

for (const { street, rows: group } of byCode.values()) {
  // The row with the most votes survives, so the least data has to move.
  group.sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));
  const [keep, ...drop] = group;
  renames.push({ id: keep.id, from: keep.name, to: street.name, code: street.code });
  sql.push(
    `update streets set code = '${street.code}', name = '${street.name.replace(/'/g, "''")}' where id = '${keep.id}';`,
  );
  for (const d of drop) {
    merges.push({ from: d.name, into: street.name, votes: d.votes ?? 0, photos: d.photos ?? 0 });
    sql.push(
      // One vote per person per street: if the same person voted on two
      // spellings, the newer vote survives the merge.
      `delete from votes a using votes b where a.street_id = '${d.id}' and b.street_id = '${keep.id}' and a.user_id = b.user_id and a.updated_at <= b.updated_at;`,
      `delete from votes a using votes b where a.street_id = '${keep.id}' and b.street_id = '${d.id}' and a.user_id = b.user_id and a.updated_at < b.updated_at;`,
      `update votes set street_id = '${keep.id}' where street_id = '${d.id}';`,
      `update photos set street_id = '${keep.id}' where street_id = '${d.id}';`,
      `delete from street_status where street_id = '${d.id}';`,
      `delete from streets where id = '${d.id}';`,
    );
  }
}

const deletable = unmatched.filter((r) => !(r.votes > 0 || r.photos > 0));
for (const r of deletable) sql.push(`delete from streets where id = '${r.id}';`);

console.log("=== דוח איחוד רחובות ===\n");
console.log(`שורות נבדקו: ${rows.length}`);
console.log(`זוהו ברישום הרשמי: ${rows.length - unmatched.length}`);
console.log(`נותרו ללא זיהוי: ${unmatched.length}\n`);

console.log("-- שמות שעודכנו לשם הרשמי:");
for (const r of renames) {
  console.log(`   ${r.from}  →  ${r.to}  (קוד ${r.code})${r.from === r.to ? "  [ללא שינוי]" : ""}`);
}

console.log(`\n-- מיזוגי כפילויות: ${merges.length}`);
for (const m of merges) {
  console.log(`   ${m.from}  ←מוזג לתוך→  ${m.into}   (${m.votes} קולות, ${m.photos} תמונות הועברו)`);
}

console.log(`\n-- ללא התאמה ברישום (${unmatched.length}) — להחלטת הצוות:`);
for (const r of unmatched) {
  const keep = r.votes > 0 || r.photos > 0;
  console.log(
    `   ${r.name}  [${r.votes} קולות, ${r.photos} תמונות] ${keep ? "— נשמר, מסומן לבדיקה" : "— יימחק (ריק)"}`,
  );
  const s = suggestions(r.name);
  if (s.length) console.log(`      אולי התכוונו ל: ${s.join(" · ")}`);
}

if (process.argv.includes("--sql")) {
  console.log("\n=== SQL ===");
  console.log(sql.join("\n"));
}
