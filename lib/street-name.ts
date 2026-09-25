/**
 * Canonical handling of Hebrew street names.
 *
 * Residents write the same street in many ways: with or without the "רחוב"
 * prefix, with a geresh or an apostrophe, with double or single spaces. All of
 * those must resolve to one street, so every lookup goes through
 * `normalizeStreetName` first.
 */

/** Geresh and gershayim variants that people and keyboards produce. */
const GERESH = /[׳‘’`´]/g; // ׳ ‘ ’ ` ´
const GERSHAYIM = /[״“”«»]/g; // ״ “ ” « »

/**
 * Words that describe the kind of street rather than name it. The registry
 * abbreviates them ("שד ירושלים") while residents spell them out
 * ("שדרות ירושלים"), so both must reduce to the same key.
 */
const PREFIXES = [
  "רחוב",
  "רח'",
  "רח",
  "שדרות",
  "שדרה",
  "שד'",
  "שד",
  "דרך",
  "כיכר",
  "ככר",
  "כיכרת",
  "סמטת",
  "סמטה",
  "משעול",
  "שביל",
  "טיילת",
  "מדרחוב",
];

export function normalizeStreetName(raw: string): string {
  let text = (raw ?? "").normalize("NFC").trim();

  text = text.replace(GERESH, "'").replace(GERSHAYIM, '"');
  // Hebrew diacritics carry no meaning in a street name.
  text = text.replace(/[֑-ׇ]/g, "");
  // Punctuation people add but never means anything here.
  text = text.replace(/[.,;:()\[\]־–—]/g, " ");
  text = text.replace(/\s+/g, " ").trim();

  // Strip repeatedly: "שדרות דרך בגין" should reduce all the way down.
  let stripped = true;
  while (stripped) {
    stripped = false;
    for (const prefix of PREFIXES) {
      if (text === prefix) return text;
      if (text.startsWith(`${prefix} `)) {
        text = text.slice(prefix.length + 1).trim();
        stripped = true;
        break;
      }
    }
  }

  // A trailing quote mark is noise; one inside an abbreviation is not.
  text = text.replace(/^['"]+|['"]+$/g, "").trim();

  return text;
}

/** A key safe to compare across spellings: normalized and space-free. */
export function streetKey(raw: string): string {
  return normalizeStreetName(raw).replace(/[\s'"]/g, "");
}

/**
 * A key that ignores word order, for the cases where the registry writes
 * "בגין מנחם" and a resident writes "מנחם בגין". Used only as a fallback,
 * and only when it matches exactly one street, so it cannot merge two
 * different streets by accident.
 */
export function streetTokenKey(raw: string): string {
  return normalizeStreetName(raw)
    .replace(/['"]/g, "")
    .split(" ")
    .filter(Boolean)
    .sort()
    .join(" ");
}
