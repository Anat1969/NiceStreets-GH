/**
 * ארבע השכבות של רחוב אחד, עם הערך של כל קריטריון ומה הוא אומר.
 *
 * כל ערך מגיע מהמקור שהקריטריון מצביע עליו ב-city.ts: ציון התושבים
 * לשאלה, מדד GIS עירוני, או "טרם נקבע". שום ערך לא מנוחש.
 */

import { CRITERIA_FAMILIES, GIS_METRICS, QUESTION_MAP, TYPOLOGY_MAP } from "./city";
import type { GisMetricKey, QuestionKey, TypologyKey } from "./city";
import { toTen } from "./score";
import type { Street } from "./types";

export interface CriterionReading {
  name: string;
  /** "question" = ציון תושבים, "gis" = מדידה עירונית, "open" = טרם נקבע מקור. */
  source: "question" | "gis" | "open";
  /** הערך כפי שמוצג, למשל "7.4" או "28 מ'", או null כשאין. */
  value: string | null;
  /** 0 עד 10, רק לציון תושבים, לפס. */
  score10: number | null;
  /** משפט אחד: מה המספר אומר, או למה אין מספר. */
  meaning: string;
}

export interface LayerReading {
  key: "skeleton" | "section" | "frontage" | "texture";
  title: string;
  question: string;
  /** ממוצע ציוני התושבים בשכבה, 0 עד 10, או null. */
  score10: number | null;
  scoreMeaning: string;
  criteria: CriterionReading[];
}

const BENCH_FOR: Partial<Record<GisMetricKey, keyof (typeof TYPOLOGY_MAP)[TypologyKey]["benchmarks"]>> = {
  rowWidthM: "rowWidth",
  heightToWidth: "ratio",
  canopyPct: "canopy",
  intersectionDistanceM: "intersections",
  buildingsPer100m: "buildings",
  plotFrontageM: "frontage",
};

export function layerReadings(
  street: Pick<Street, "gis" | "typology">,
  perQuestion: Record<QuestionKey, number | null>,
  votes: number,
): LayerReading[] {
  const typology = street.typology ? TYPOLOGY_MAP[street.typology] : null;
  const gis = (street.gis ?? {}) as Record<string, unknown>;

  return CRITERIA_FAMILIES.map((family) => {
    const criteria: CriterionReading[] = family.criteria.map((c) => {
      if (c.link.kind === "question") {
        const q = QUESTION_MAP[c.link.questionKey];
        const v = perQuestion[c.link.questionKey];
        if (v === null || v === undefined) {
          return {
            name: c.name,
            source: "question",
            value: null,
            score10: null,
            meaning: `עוד אין קולות לשאלה "${q.label}". הציון יופיע אחרי הדירוג הראשון.`,
          };
        }
        const s = toTen(v);
        return {
          name: c.name,
          source: "question",
          value: s.toFixed(1),
          score10: s,
          meaning: `ממוצע ${votes.toLocaleString("he-IL")} ${votes === 1 ? "קול" : "קולות"} של תושבים לשאלה "${q.label}", מתוך 10.`,
        };
      }
      if (c.link.kind === "gis") {
        const metric = c.link.metric;
        const def = GIS_METRICS[metric];
        let raw = gis[metric];
        if (metric === "heightToWidth" && typeof raw !== "number") {
          const sec = (gis.section as { heightToWidth?: number } | undefined)?.heightToWidth;
          if (typeof sec === "number") raw = sec;
        }
        const bk = BENCH_FOR[metric];
        const bench = typology && bk ? typology.benchmarks[bk] : null;
        if (typeof raw !== "number") {
          return {
            name: c.name,
            source: "gis",
            value: null,
            score10: null,
            meaning: `אין עדיין מדידה עירונית של ${def.label} לרחוב הזה${bench ? `. ערך הייחוס ל${typology!.label}: ${bench}` : ""}.`,
          };
        }
        const shown = metric === "heightToWidth" ? `1:${(1 / raw).toFixed(1)}` : `${raw}${def.unit ? ` ${def.unit}` : ""}`;
        return {
          name: c.name,
          source: "gis",
          value: shown,
          score10: null,
          meaning: `${def.label} מה-GIS העירוני${bench ? `. ערך הייחוס ל${typology!.label}: ${bench}` : ""}.`,
        };
      }
      return {
        name: c.name,
        source: "open",
        value: null,
        score10: null,
        meaning: `טרם נקבע מקור: ${c.link.note.split(".")[0]}.`,
      };
    });

    const scored = criteria.map((c) => c.score10).filter((x): x is number => x !== null);
    const score10 = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : null;
    const measured = criteria.filter((c) => c.value !== null).length;
    return {
      key: family.key,
      title: family.title === "מרקם ואקלים" ? "מרקם" : family.title,
      question: family.text.split("?")[0] + "?",
      score10,
      scoreMeaning:
        score10 === null
          ? `אין עדיין ציון תושבים לשכבה. ${measured} מתוך ${criteria.length} הקריטריונים עם ערך.`
          : `ממוצע ציוני התושבים בשכבה. ${measured} מתוך ${criteria.length} הקריטריונים עם ערך.`,
      criteria,
    };
  });
}
