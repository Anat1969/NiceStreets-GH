import registry from "@/data/ashdod-streets.json";
import { normalizeStreetName, streetKey, streetTokenKey } from "./street-name";

export interface CanonicalStreet {
  /** The registry code; the stable identity of the street. */
  code: string;
  /** The official name, as the registry writes it. */
  name: string;
  /** Other spellings the registry records for the same street. */
  synonyms: string[];
}

export const STREET_REGISTRY_SOURCE = registry.source;
export const STREET_REGISTRY_DATE = registry.generatedAt;

export const CANONICAL_STREETS: CanonicalStreet[] = registry.streets;

const BY_CODE = new Map(CANONICAL_STREETS.map((s) => [s.code, s]));

/** Every spelling the registry knows, official and synonym, to one street. */
const BY_KEY = new Map<string, CanonicalStreet>();
for (const street of CANONICAL_STREETS) {
  BY_KEY.set(streetKey(street.name), street);
  for (const synonym of street.synonyms) {
    if (!BY_KEY.has(streetKey(synonym))) BY_KEY.set(streetKey(synonym), street);
  }
}

/** Word-order-insensitive fallback; ambiguous keys are dropped on purpose. */
const BY_TOKENS = new Map<string, CanonicalStreet | null>();
for (const street of CANONICAL_STREETS) {
  for (const spelling of [street.name, ...street.synonyms]) {
    const key = streetTokenKey(spelling);
    if (!key) continue;
    const seen = BY_TOKENS.get(key);
    if (seen === undefined) BY_TOKENS.set(key, street);
    else if (seen && seen.code !== street.code) BY_TOKENS.set(key, null);
  }
}

export function getStreetByCode(code: string): CanonicalStreet | null {
  return BY_CODE.get(code) ?? null;
}

/** Resolves any spelling a resident might write to one canonical street. */
export function findCanonicalStreet(raw: string): CanonicalStreet | null {
  if (!raw?.trim()) return null;
  const direct = BY_KEY.get(streetKey(raw));
  if (direct) return direct;
  return BY_TOKENS.get(streetTokenKey(raw)) ?? null;
}

/**
 * Autocomplete. Matches the official name and the synonyms, preferring names
 * that start with what was typed.
 */
export function searchStreets(query: string, limit = 8): CanonicalStreet[] {
  const needle = normalizeStreetName(query);
  if (needle.length === 0) return CANONICAL_STREETS.slice(0, limit);

  const starts: CanonicalStreet[] = [];
  const contains: CanonicalStreet[] = [];
  const viaSynonym: CanonicalStreet[] = [];

  for (const street of CANONICAL_STREETS) {
    const name = normalizeStreetName(street.name);
    if (name.startsWith(needle)) starts.push(street);
    else if (name.includes(needle)) contains.push(street);
    else if (street.synonyms.some((s) => normalizeStreetName(s).includes(needle))) {
      viaSynonym.push(street);
    }
    if (starts.length >= limit) break;
  }

  return [...starts, ...contains, ...viaSynonym].slice(0, limit);
}
