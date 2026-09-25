#!/usr/bin/env node
/**
 * Builds the canonical Ashdod street list from the national street registry.
 *
 *   node scripts/build-street-list.mjs data/source-streets-israel-ashdod.csv > data/ashdod-streets.json
 *
 * Source: data.gov.il, "רשימת רחובות בישראל – קובץ עם סינונימים".
 * Each official street keeps its registry code; every synonym row is attached
 * to the official code it points at, so the three spellings a resident might
 * type all resolve to one street.
 */

import { readFileSync } from "node:fs";

const CITY_NAME = "אשדוד";
/** Registry code 9000 names the locality itself, not a street. */
const NOT_A_STREET = new Set(["9000"]);

/**
 * Minimal CSV reader. A quote only opens a quoted field at the start of a
 * field: in this registry gershayim appear inside names (בן צבי ז"ל), and
 * treating those as quotes swallowed the rest of the file.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  let atFieldStart = true;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && atFieldStart) {
      quoted = true;
      atFieldStart = false;
    } else if (ch === ",") {
      row.push(field);
      field = "";
      atFieldStart = true;
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      atFieldStart = true;
    } else if (ch !== "\r") {
      field += ch;
      atFieldStart = false;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const path = process.argv[2] ?? "data/source-streets-israel-ashdod.csv";
const raw = readFileSync(path, "utf8").replace(/^﻿/, "");
const rows = parseCsv(raw);
const header = rows.shift().map((h) => h.trim());
const col = (name) => header.indexOf(name);

const iCity = col("city_name");
const iCode = col("street_code");
const iName = col("street_name");
const iStatus = col("street_name_status");
const iOfficial = col("official_code");

const official = new Map(); // code -> name
const synonyms = new Map(); // code -> Set(name)
let skippedOtherCity = 0;

for (const row of rows) {
  if (row.length < header.length) continue;
  const city = row[iCity].trim();
  if (city !== CITY_NAME) {
    skippedOtherCity += 1;
    continue;
  }
  const code = row[iCode].trim();
  const name = row[iName].trim();
  const status = row[iStatus].trim();
  const officialCode = row[iOfficial].trim();
  if (!name) continue;

  if (status === "official") {
    if (NOT_A_STREET.has(code)) continue;
    official.set(code, name);
  } else if (status.startsWith("synonym")) {
    if (NOT_A_STREET.has(officialCode)) continue;
    if (!synonyms.has(officialCode)) synonyms.set(officialCode, new Set());
    synonyms.get(officialCode).add(name);
  }
}

const streets = [...official.entries()]
  .map(([code, name]) => ({
    code,
    name,
    synonyms: [...(synonyms.get(code) ?? [])].filter((s) => s !== name).sort((a, b) => a.localeCompare(b, "he")),
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "he"));

const orphanSynonyms = [...synonyms.keys()].filter((code) => !official.has(code));

process.stderr.write(
  `streets: ${streets.length}\n` +
    `synonyms: ${streets.reduce((n, s) => n + s.synonyms.length, 0)}\n` +
    `rows skipped (other city): ${skippedOtherCity}\n` +
    `synonyms with no official street: ${orphanSynonyms.length}\n`,
);

process.stdout.write(
  JSON.stringify(
    {
      city: CITY_NAME,
      source: "data.gov.il — רשימת רחובות בישראל, קובץ עם סינונימים",
      generatedAt: new Date().toISOString().slice(0, 10),
      streets,
    },
    null,
    2,
  ) + "\n",
);
