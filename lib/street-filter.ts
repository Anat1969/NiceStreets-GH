import type { StatusKey, TypologyKey } from "./city";

export type SortField = "name" | "votes" | "avgScore" | "photos";
export type SortDirection = "asc" | "desc";

export interface StreetFilter {
  /** חיפוש חופשי בשם הרחוב. ריק = בלי חיפוש. */
  q: string;
  quarterId: string;
  typology: string;
  status: string;
  minVotes: number;
  sort: SortField;
  direction: SortDirection;
}

/** The shape both the table and the export filter on. */
export interface FilterableStreet {
  name: string;
  quarterId: string | null;
  typology: TypologyKey | null;
  status: StatusKey | null;
  votes: number;
  avgScore: number | null;
  photos: number;
}

export const DEFAULT_FILTER: StreetFilter = {
  q: "",
  quarterId: "",
  typology: "",
  status: "",
  minVotes: 1,
  sort: "votes",
  direction: "desc",
};

const SORT_FIELDS: SortField[] = ["name", "votes", "avgScore", "photos"];

/** מוריד קידומות, גרשים ורווחים כפולים, כדי שהחיפוש יסלח על כתיב. */
export function normaliseForSearch(value: string): string {
  return value
    .trim()
    .replace(/["'\u05f3\u05f4]/g, "")
    .replace(/^(רחוב|רח|שדרות|שד|דרך|סמטת|שביל)\s+/, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * Reads a filter from a query string, so the table and the export always
 * describe the same set of streets.
 */
export function parseStreetFilter(params: URLSearchParams): StreetFilter {
  const sort = params.get("sort");
  const direction = params.get("dir");
  const minVotes = Number(params.get("minVotes"));

  return {
    q: (params.get("q") ?? "").trim(),
    quarterId: params.get("quarter") ?? "",
    typology: params.get("typology") ?? "",
    status: params.get("status") ?? "",
    minVotes: Number.isFinite(minVotes) && minVotes >= 0 ? Math.floor(minVotes) : DEFAULT_FILTER.minVotes,
    sort: SORT_FIELDS.includes(sort as SortField) ? (sort as SortField) : DEFAULT_FILTER.sort,
    direction: direction === "asc" ? "asc" : "desc",
  };
}

export function streetFilterToQuery(filter: StreetFilter): string {
  const params = new URLSearchParams();
  if (filter.q) params.set("q", filter.q);
  if (filter.quarterId) params.set("quarter", filter.quarterId);
  if (filter.typology) params.set("typology", filter.typology);
  if (filter.status) params.set("status", filter.status);
  if (filter.minVotes !== DEFAULT_FILTER.minVotes) params.set("minVotes", String(filter.minVotes));
  if (filter.sort !== DEFAULT_FILTER.sort) params.set("sort", filter.sort);
  if (filter.direction !== DEFAULT_FILTER.direction) params.set("dir", filter.direction);
  return params.toString();
}

export function applyStreetFilter<T extends FilterableStreet>(
  rows: T[],
  filter: StreetFilter,
): T[] {
  /*
   * החיפוש מנוקה מקידומות ומגרשים לפני ההשוואה, כי מי שמחפש "הרצל"
   * מתכוון גם ל"שד הרצל", ומי שמקליד גרש אחר לא אמור לצאת בלי תוצאות.
   */
  const needle = normaliseForSearch(filter.q);
  const filtered = rows.filter(
    (row) =>
      (!needle || normaliseForSearch(row.name).includes(needle)) &&
      (!filter.quarterId || row.quarterId === filter.quarterId) &&
      (!filter.typology || row.typology === filter.typology) &&
      (!filter.status || row.status === filter.status) &&
      row.votes >= filter.minVotes,
  );

  const sign = filter.direction === "asc" ? 1 : -1;
  return [...filtered].sort((a, b) => {
    if (filter.sort === "name") return a.name.localeCompare(b.name, "he") * sign;
    // A street with no score sorts below every scored street, either way round.
    const av = filter.sort === "avgScore" ? (a.avgScore ?? -1) : a[filter.sort];
    const bv = filter.sort === "avgScore" ? (b.avgScore ?? -1) : b[filter.sort];
    return (av - bv) * sign || a.name.localeCompare(b.name, "he");
  });
}

/** Whether anything was narrowed, so a reset button can say so. */
export function isDefaultFilter(filter: StreetFilter): boolean {
  return (
    filter.q === DEFAULT_FILTER.q &&
    filter.quarterId === DEFAULT_FILTER.quarterId &&
    filter.typology === DEFAULT_FILTER.typology &&
    filter.status === DEFAULT_FILTER.status &&
    filter.minVotes === DEFAULT_FILTER.minVotes &&
    filter.sort === DEFAULT_FILTER.sort &&
    filter.direction === DEFAULT_FILTER.direction
  );
}
