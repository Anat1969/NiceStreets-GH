/**
 * שיוך אוטומטי של רובע וסוג רחוב (בקשת ענת, 08.11.2026, סעיף 25).
 *
 * הצוות לא יושב על כל רחוב. המערכת מציעה לכל רחוב רובע וסוג, עם הנימוק
 * והמקור, והצוות מאשר בלחיצה — אחת לכל הרשימה או אחת לרחוב. השינוי הידני
 * נשאר לבדיקה במקרה הצורך. מה שחסר, או שהתושבים חושבים אחרת, מסומן כהצעה.
 *
 * המקורות, לפי סדר:
 *  - רובע: שכבת הרחובות של העירייה (rehevot.shp), הרובע שמכסה את רוב
 *    אורך הרחוב. בלעדיה: רשימת הרובעים של העירייה (ashdod-street-quarters.csv).
 *  - סוג: הערכה ממידרג וסוג באותה שכבה (scripts/build-gis-typology.mjs).
 */
import { QUARTER_MAP, TYPOLOGY_MAP } from "@/lib/city";
import { GIS_QUARTER } from "@/lib/gis-quarter.generated";
import { GIS_TYPOLOGY } from "@/lib/gis-typology.generated";
import { STREET_QUARTERS } from "@/lib/street-quarters.generated";

export type Match = "same" | "new" | "differs" | "none";

export interface Suggestion<T> {
  value: T | null;
  reason: string;
  /** current מול value. */
  match: Match;
}

export interface AssignRow {
  id: string;
  name: string;
  code: string | null;
  quarterId: string | null;
  typology: string | null;
  votes: number;
  suggestions: { key: string; label: string; count: number }[];
  quarter: Suggestion<string>;
  type: Suggestion<string>;
  /** סיבות לבדיקה ידנית: חסר מידע, או שהתושבים חושבים אחרת. */
  flags: string[];
}

function match(current: string | null, value: string | null): Match {
  if (!value) return "none";
  if (!current) return "new";
  return current === value ? "same" : "differs";
}

export function suggestQuarter(code: string | null, current: string | null): Suggestion<string> {
  const gis = code ? GIS_QUARTER[code] : undefined;
  if (gis?.q) {
    const name = QUARTER_MAP[gis.q]?.name ?? gis.q;
    const reason =
      gis.q === "q-main-axis"
        ? `לפי שכבת הרחובות: עובר ב-${gis.n} רובעים, ואף אחד מהם אינו מכיל מחצית מאורכו.`
        : gis.n === 1
          ? `לפי שכבת הרחובות: כל אורך הרחוב ב${name}.`
          : `לפי שכבת הרחובות: ${gis.share}% מאורך הרחוב ב${name}, מתוך ${gis.n} רובעים.`;
    return { value: gis.q, reason, match: match(current, gis.q) };
  }
  const listed = code ? STREET_QUARTERS[code] : undefined;
  if (listed) {
    return {
      value: listed,
      reason: "לפי רשימת הרובעים של העירייה. הרחוב אינו בשכבת הרחובות.",
      match: match(current, listed),
    };
  }
  return {
    value: null,
    reason: gis?.note
      ? `בשכבת הרחובות הרחוב ב"${gis.note}", שאין לו אזור מקביל באפליקציה.`
      : code
        ? "הרחוב אינו בשכבת הרחובות ואינו ברשימת הרובעים."
        : "לרחוב אין סמל רשמי, ולכן אין לו התאמה בשכבות.",
    match: "none",
  };
}

export function suggestType(code: string | null, current: string | null): Suggestion<string> {
  const value = code ? (GIS_TYPOLOGY[code] ?? null) : null;
  if (!value) {
    return {
      value: null,
      reason: code
        ? "אין לרחוב קטעים עם מידרג מוכר בשכבה (למשל חניה או כביש בין־עירוני)."
        : "לרחוב אין סמל רשמי, ולכן אין לו התאמה בשכבה.",
      match: "none",
    };
  }
  return {
    value,
    reason: `הערכה לפי שכבת הרחובות (מידרג וסוג, לפי רוב האורך): ${TYPOLOGY_MAP[value]?.label ?? value}.`,
    match: match(current, value),
  };
}

export function buildAssignRow(input: Omit<AssignRow, "quarter" | "type" | "flags">): AssignRow {
  const quarter = suggestQuarter(input.code, input.quarterId);
  const type = suggestType(input.code, input.typology);
  const flags: string[] = [];
  if (quarter.match === "none" && !input.quarterId) flags.push("אין מידע לרובע");
  if (type.match === "none" && !input.typology) flags.push("אין מידע לסוג");
  if (quarter.match === "differs") flags.push("הרובע השמור שונה מהשכבה");
  if (type.match === "differs") flags.push("הסוג השמור שונה מההערכה");
  const decided = input.typology ?? type.value;
  const disagree = input.suggestions.filter((s) => s.key !== decided);
  if (disagree.length > 0) {
    flags.push(
      `תושבים מציעים: ${disagree.map((s) => `${s.label} (${s.count})`).join(", ")}`,
    );
  }
  return { ...input, quarter, type, flags };
}

/** רחוב שאפשר לאשר לו הצעה: יש הצעה, והיא חדשה (השדה ריק). */
export function hasPendingSuggestion(row: AssignRow): boolean {
  return row.quarter.match === "new" || row.type.match === "new";
}
