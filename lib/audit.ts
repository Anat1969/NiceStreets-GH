import { supabaseServer } from "./supabase/server";

/**
 * The automated street audit, as the staff screens read it.
 *
 * Everything is computed in the database (run_street_audit). This file only
 * reads the latest run per street and names things in Hebrew. Reads go out
 * under the staff member's own session, so RLS decides what comes back.
 */

export type Verdict = "meets" | "partial" | "below" | "no_data";
export type Confidence = "high" | "medium" | "low";
export type GapClass = "aligned" | "residents_higher" | "residents_lower" | "insufficient";
export type AuditState = "blocked" | "draft" | "approved" | "edited_approved" | "returned_to_field";

export interface CriterionRow {
  id: string;
  family: "skeleton" | "section" | "frontage" | "texture_climate";
  name_he: string;
  metric: string;
  unit: string;
  method: "gis" | "remote_sensing" | "registry" | "resident";
  vote_key: string | null;
  automation_level: "A" | "B" | "C" | "D";
  source: string;
  placeholder: boolean;
  sort: number;
}

export interface Check {
  code: string;
  text: string;
  criterion?: string;
}

export interface AuditResult {
  criterion_id: string;
  value: number | null;
  benchmark_min: number | null;
  benchmark_max: number | null;
  verdict: Verdict;
  confidence: Confidence;
  data_source: string | null;
  data_date: string | null;
  resident_avg: number | null;
  resident_n: number;
  gap_class: GapClass;
  needs_field_check: boolean;
  staff_only: boolean;
}

export interface StreetAudit {
  id: string;
  street_id: string;
  version: number;
  run_at: string;
  run_by: string;
  engine_version: string;
  state: AuditState;
  errors: Check[];
  warnings: Check[];
  proposed_status: string | null;
  proposed_note_he: string | null;
  note_source: string | null;
  results: AuditResult[];
}

export const FAMILY_LABELS: Record<CriterionRow["family"], string> = {
  skeleton: "שלד",
  section: "חתך",
  frontage: "דופן",
  texture_climate: "מרקם ואקלים",
};

export const VERDICT_LABELS: Record<Verdict, string> = {
  meets: "עומד ביעד",
  partial: "עומד חלקית",
  below: "לא עומד ביעד",
  no_data: "אין נתון",
};

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  high: "גבוהה",
  medium: "בינונית",
  low: "נמוכה",
};

export const GAP_LABELS: Record<GapClass, string> = {
  aligned: "תואם",
  residents_higher: "התושבים גבוה יותר",
  residents_lower: "התושבים נמוך יותר",
  insufficient: "אין די נתונים",
};

export const STATE_LABELS: Record<AuditState, string> = {
  blocked: "חסומה — חסרים נתוני יסוד",
  draft: "טיוטה ממתינה לאישור",
  approved: "אושרה ופורסמה",
  edited_approved: "נערכה ואושרה",
  returned_to_field: "הוחזרה לבדיקת שטח",
};

export const METHOD_LABELS: Record<CriterionRow["method"], string> = {
  gis: "GIS",
  remote_sensing: "חישה מרחוק",
  registry: "מרשם עירוני",
  resident: "תושבים",
};

export const PROPOSED_STATUS_LABELS: Record<string, string> = {
  under_review: "בבדיקה",
  in_progress: "בטיפול",
  done: "טופל",
};

/** "12–14", "≥ 35", or "—" when there is no target. */
export function targetText(min: number | null, max: number | null): string {
  if (min === null && max === null) return "—";
  if (max === null) return `≥ ${fmt(min)}`;
  if (min === null) return `≤ ${fmt(max)}`;
  return `${fmt(min)}–${fmt(max)}`;
}

export function fmt(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString("he-IL", { maximumFractionDigits: 2 });
}

/**
 * הפער בין הבדיקה האובייקטיבית לקול בודד של תושב.
 *
 * הציון האובייקטיבי של הרחוב נשמר בבדיקה, וכל קול נבדק מולו. פער גדול
 * מ-30% מסומן באדום ומדווח לצוות; פער של 30% ומטה עובר אוטומטית לירוק.
 *
 * **הקול נספר בציון הרחוב בכל מקרה.** הסימון הוא דיווח על פער בין
 * המדידה לדעה, ולא סינון של דעות — ופער יכול להעיד על טעות במדידה
 * בדיוק כמו על קול חריג.
 */
export type VoteGapState = "gap" | "aligned" | "no_audit";

export interface VoteGap {
  vote_id: string;
  street_id: string;
  street_name: string;
  updated_at: string;
  is_demo: boolean;
  audited_at: string | null;
  objective_score: number | null;
  resident_score: number | null;
  gap: number | null;
  state: VoteGapState;
  street_votes: number;
}

export const VOTE_GAP_LABELS: Record<VoteGapState, string> = {
  gap: "יש פער בין המדידה האובייקטיבית לדירוג הסובייקטיבי",
  aligned: "מאושר — אין פערים",
  no_audit: "הרחוב עדיין לא נמדד",
};

/** כמה אפשר לסמוך על הפער, לפי מספר המדרגים ברחוב. */
export function gapConfidence(streetVotes: number): Confidence {
  if (streetVotes >= 10) return "high";
  if (streetVotes >= 3) return "medium";
  return "low";
}

export interface AuditOverview {
  criteria: CriterionRow[];
  latest: StreetAudit[];
  streets: { id: string; name: string; typology: string | null; hasGeom: boolean }[];
  /** קול אחר קול, מול הציון האובייקטיבי של הרחוב. */
  voteGaps: VoteGap[];
  /** Null when everything loaded; otherwise what failed, in Hebrew. */
  error: string | null;
}

export async function loadAuditOverview(): Promise<AuditOverview> {
  try {
    const db = await supabaseServer();
    const [criteria, latest, streets, gaps] = await Promise.all([
      db.from("criteria").select("*").order("sort"),
      db.from("street_audit_latest").select("*"),
      db.from("streets").select("id, name, typology, geom").order("name"),
      // הפער הגדול קודם: זה מה שהצוות צריך להכריע בו.
      db.from("vote_audit_gaps").select("*").eq("is_demo", false)
        .order("gap", { ascending: false, nullsFirst: false }),
    ]);
    if (criteria.error) throw new Error(criteria.error.message);
    if (latest.error) throw new Error(latest.error.message);
    if (streets.error) throw new Error(streets.error.message);
    if (gaps.error) throw new Error(gaps.error.message);

    const ids = (latest.data ?? []).map((a) => a.id);
    const results = ids.length
      ? await db.from("audit_results").select("*").in("audit_id", ids)
      : { data: [], error: null };
    if (results.error) throw new Error(results.error.message);

    const byAudit = new Map<string, AuditResult[]>();
    for (const row of results.data ?? []) {
      const list = byAudit.get(row.audit_id) ?? [];
      list.push(row as AuditResult);
      byAudit.set(row.audit_id, list);
    }

    return {
      criteria: (criteria.data ?? []) as CriterionRow[],
      latest: (latest.data ?? []).map((a) => ({
        ...(a as Omit<StreetAudit, "results">),
        results: byAudit.get(a.id) ?? [],
      })),
      streets: (streets.data ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        typology: s.typology,
        hasGeom: s.geom !== null,
      })),
      voteGaps: (gaps.data ?? []) as VoteGap[],
      error: null,
    };
  } catch (error) {
    return {
      criteria: [],
      latest: [],
      streets: [],
      voteGaps: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
