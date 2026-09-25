/**
 * Streets that cross quarters.
 *
 * Six boulevards in the municipal list are classified as "צירים ראשיים חוצי
 * עיר": they run through several quarters, so one quarter for the whole street
 * would be wrong. Instead the street is split into a stretch per quarter, and
 * the resident who rates it says which stretch they mean — the only source for
 * that fact, since the city's GIS lines are not loaded yet.
 *
 * A stretch keeps the registry code so its identity stays traceable:
 *   "189#q-b"  =  the registry street 189, in רובע ב'.
 */

import { CROSSING_AREA_ID, QUARTER_MAP, STREET_ASSIGNMENTS } from "./city";

const SEPARATOR = "#";

/** True when the municipal list says this street runs through several quarters. */
export function isCrossingStreet(code: string): boolean {
  return STREET_ASSIGNMENTS[code]?.quarterId === CROSSING_AREA_ID;
}

export function segmentCode(code: string, quarterId: string): string {
  return `${code}${SEPARATOR}${quarterId}`;
}

/** The registry code and quarter behind a stretch, or null for a plain street. */
export function parseSegmentCode(
  code: string,
): { code: string; quarterId: string } | null {
  const at = code.indexOf(SEPARATOR);
  if (at < 0) return null;
  return { code: code.slice(0, at), quarterId: code.slice(at + 1) };
}

/** "שדרות הרצל (רובע ב')" — the name a resident sees for one stretch. */
export function segmentName(name: string, quarterId: string): string {
  const quarter = QUARTER_MAP[quarterId];
  return quarter ? `${name} (${quarter.name})` : name;
}

/** The quarters a stretch may belong to: the real quarters, not the areas. */
export function segmentQuarters(): { id: string; name: string }[] {
  return Object.values(QUARTER_MAP)
    .filter((q) => q.id !== CROSSING_AREA_ID)
    .map((q) => ({ id: q.id, name: q.name }));
}
