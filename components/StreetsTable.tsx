"use client";

import { useMemo, useState } from "react";
import type React from "react";
import Link from "next/link";
import { STATUS_MAP } from "@/lib/city";
import type { StatusKey, TypologyKey } from "@/lib/city";
import { streetsFoundLabel, votesLabel, scoreLabel } from "@/lib/hebrew";
import {
  DEFAULT_FILTER,
  applyStreetFilter,
  isDefaultFilter,
  type SortField,
  type StreetFilter,
} from "@/lib/street-filter";

interface Row {
  id: string;
  name: string;
  quarterId: string | null;
  quarterName: string;
  typology: TypologyKey | null;
  typologyLabel: string;
  votes: number;
  avgScore: number | null;
  photos: number;
  status: StatusKey | null;
}

interface QuarterRow {
  id: string;
  name: string;
  votes: number;
  avgScore: number | null;
  streets: number;
}

/** כיוון ברירת המחדל כשלוחצים על עמודה בפעם הראשונה. */
const FIRST_DIRECTION: Record<SortField, "asc" | "desc"> = {
  name: "asc",
  votes: "desc",
  avgScore: "desc",
  photos: "desc",
  status: "desc",
};

/*
 * מפת החום: גוון אחד (ירוק־האגף) בארבע דרגות, ו"אין נתון" בלי צבע.
 * הדרגות קבועות, כדי שהמקרא יתאר בדיוק את מה שבטבלה. הדרגה הכהה ביותר
 * היא 36% מהצבע, כך שהטקסט הכהה נשאר מעל 4.5:1 בכל דרגה.
 */
const HEAT_STEPS = [0, 10, 18, 27, 36];

/** ציון: סולם קבוע 0–10. */
function scoreLevel(score: number | null): number {
  if (score === null) return 0;
  return Math.min(4, Math.max(1, Math.ceil(score / 2.5)));
}

/** ספירה: ביחס לערך הגבוה בתוצאות, בשורש כדי שרחוב מוביל אחד לא ימחק את השאר. */
function countLevel(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil(Math.sqrt(value / max) * 4)));
}

function heatStyle(level: number): React.CSSProperties | undefined {
  if (level === 0) return undefined;
  return {
    background: `color-mix(in srgb, var(--brand-500) ${HEAT_STEPS[level]}%, transparent)`,
  };
}

function SortArrows({ state }: { state: "asc" | "desc" | null }) {
  return (
    <svg className="sort-arrows" width="10" height="14" viewBox="0 0 10 14" aria-hidden="true">
      <path d="M5 1 9 6H1z" className={state === "asc" ? "on" : ""} />
      <path d="M5 13 1 8h8z" className={state === "desc" ? "on" : ""} />
    </svg>
  );
}

/** כותרת עמודה שהיא כפתור מיון. לחיצה חוזרת הופכת את הכיוון. */
function SortHeader({
  label,
  field,
  sort,
  direction,
  onSort,
}: {
  label: string;
  field: string;
  sort: string;
  direction: "asc" | "desc";
  onSort: (field: string) => void;
}) {
  const active = sort === field;
  return (
    <th
      scope="col"
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className="sort-th"
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={active ? "sort-btn is-active" : "sort-btn"}
        title={
          active
            ? direction === "asc"
              ? "ממוין מהנמוך לגבוה. לחיצה הופכת."
              : "ממוין מהגבוה לנמוך. לחיצה הופכת."
            : `מיון לפי ${label}`
        }
      >
        <span>{label}</span>
        <SortArrows state={active ? direction : null} />
      </button>
    </th>
  );
}

function HeatLegend() {
  return (
    <div className="heat-legend" aria-label="מקרא מפת החום">
      <span className="heat-legend-title">מקרא</span>
      <span className="heat-legend-scale">
        <span className="heat-legend-end">נמוך</span>
        {HEAT_STEPS.slice(1).map((pct) => (
          <span
            key={pct}
            className="heat-swatch"
            style={{ background: `color-mix(in srgb, var(--brand-500) ${pct}%, transparent)` }}
          />
        ))}
        <span className="heat-legend-end">גבוה</span>
      </span>
      <span className="heat-legend-note">
        <span className="heat-swatch heat-swatch-empty" aria-hidden="true" /> אין נתון.
      </span>
      <span className="heat-legend-note">
        ציון: מתוך 10. קולות ותמונות: ביחס לרחוב המוביל בתוצאות.
      </span>
    </div>
  );
}

type QuarterSort = "name" | "votes" | "avgScore" | "streets";

export default function StreetsTable({
  rows,
  quarterRows,
  quarters,
  typologies,
  statuses,
  initialFilter = DEFAULT_FILTER,
}: {
  rows: Row[];
  quarterRows: QuarterRow[];
  quarters: { id: string; name: string }[];
  typologies: { key: string; label: string }[];
  statuses: { key: string; label: string }[];
  /** Export moved to /staff (Anat, item 14); kept so callers need no change. */
  staff?: boolean;
  /** Set from the address, so a link can open the table already narrowed. */
  initialFilter?: StreetFilter;
}) {
  const [view, setView] = useState<"streets" | "quarters">("streets");
  const [filter, setFilter] = useState<StreetFilter>(initialFilter);
  const [quarterSort, setQuarterSort] = useState<{ field: QuarterSort; direction: "asc" | "desc" }>({
    field: "votes",
    direction: "desc",
  });

  const set = <K extends keyof StreetFilter>(key: K, value: StreetFilter[K]) =>
    setFilter((f) => ({ ...f, [key]: value }));

  const sortBy = (field: string) =>
    setFilter((f) => {
      const key = field as SortField;
      if (f.sort === key) return { ...f, direction: f.direction === "asc" ? "desc" : "asc" };
      return { ...f, sort: key, direction: FIRST_DIRECTION[key] };
    });

  const sortQuartersBy = (field: string) =>
    setQuarterSort((s) => {
      const key = field as QuarterSort;
      if (s.field === key) return { field: key, direction: s.direction === "asc" ? "desc" : "asc" };
      return { field: key, direction: key === "name" ? "asc" : "desc" };
    });

  const results = useMemo(() => applyStreetFilter(rows, filter), [rows, filter]);
  const maxVotes = Math.max(0, ...results.map((r) => r.votes));
  const maxPhotos = Math.max(0, ...results.map((r) => r.photos));

  const sortedQuarters = useMemo(() => {
    const sign = quarterSort.direction === "asc" ? 1 : -1;
    return [...quarterRows].sort((a, b) => {
      if (quarterSort.field === "name") return a.name.localeCompare(b.name, "he") * sign;
      const av = quarterSort.field === "avgScore" ? (a.avgScore ?? -1) : a[quarterSort.field];
      const bv = quarterSort.field === "avgScore" ? (b.avgScore ?? -1) : b[quarterSort.field];
      return (av - bv) * sign || a.name.localeCompare(b.name, "he");
    });
  }, [quarterRows, quarterSort]);
  const maxQuarterVotes = Math.max(0, ...quarterRows.map((r) => r.votes));
  const maxQuarterStreets = Math.max(0, ...quarterRows.map((r) => r.streets));

  const field =
    "w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[15px] text-ink";

  return (
    <div>
      <div className="mb-3 flex gap-2" role="group" aria-label="תצוגה">
        <button
          type="button"
          onClick={() => setView("streets")}
          aria-pressed={view === "streets"}
          className={`flex-1 rounded-[12px] px-3 py-2 text-[15px] ${
            view === "streets"
              ? "bg-accent text-white"
              : "border border-line bg-surface text-ink"
          }`}
        >
          רחובות
        </button>
        <button
          type="button"
          onClick={() => setView("quarters")}
          aria-pressed={view === "quarters"}
          className={`flex-1 rounded-[12px] px-3 py-2 text-[15px] ${
            view === "quarters"
              ? "bg-accent text-white"
              : "border border-line bg-surface text-ink"
          }`}
        >
          רובעים
        </button>
      </div>

      {view === "streets" ? (
        <div className="streets-layout">
          {/*
            קלט מימין, פלט משמאל. במחשב הסינון הוא סרגל צד צמוד, והטבלה
            מתחילה באותו גובה, בלי גלילה. בנייד הם אחד מעל השני, והשדות
            הקצרים יושבים שניים בשורה.
          */}
          <section aria-labelledby="filters-heading" className="streets-filters">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 id="filters-heading" className="text-[15px] font-semibold text-ink">
                סינון
              </h2>
              <button
                type="button"
                onClick={() => setFilter(DEFAULT_FILTER)}
                disabled={isDefaultFilter(filter)}
                className="rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink disabled:opacity-40"
              >
                איפוס
              </button>
            </div>

            <div className="streets-filter-grid">
              {/*
                חיפוש שם הרחוב, ראשון: מי שיודע איזה רחוב הוא מחפש לא
                אמור לגלול טבלה שלמה או לנחש באיזה רובע הוא נמצא.
              */}
              <label className="streets-filter-wide text-[13px] text-ink-soft">
                חיפוש רחוב
                <input
                  type="search"
                  value={filter.q}
                  onChange={(e) => set("q", e.target.value)}
                  placeholder="שם הרחוב, למשל הרצל"
                  autoComplete="off"
                  className={`mt-1 ${field}`}
                />
              </label>

              <label className="text-[13px] text-ink-soft">
                רובע
                <select
                  value={filter.quarterId}
                  onChange={(e) => set("quarterId", e.target.value)}
                  className={`mt-1 ${field}`}
                >
                  <option value="">כל הרובעים</option>
                  {quarters.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-[13px] text-ink-soft">
                סוג רחוב
                <select
                  value={filter.typology}
                  onChange={(e) => set("typology", e.target.value)}
                  className={`mt-1 ${field}`}
                >
                  <option value="">כל הסוגים</option>
                  {typologies.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-[13px] text-ink-soft">
                סטטוס עירוני
                <select
                  value={filter.status}
                  onChange={(e) => set("status", e.target.value)}
                  className={`mt-1 ${field}`}
                >
                  <option value="">כל הסטטוסים</option>
                  {statuses.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-[13px] text-ink-soft">
                מינימום קולות
                <input
                  type="number"
                  min={0}
                  max={999}
                  value={filter.minVotes}
                  onChange={(e) => set("minVotes", Math.max(0, Number(e.target.value) || 0))}
                  className={`mt-1 ${field}`}
                />
              </label>
            </div>
            <p className="mt-2 text-[12px] text-ink-faint">
              למיון: לוחצים על כותרת העמודה.
              <br />
              לחיצה נוספת הופכת את הסדר.
            </p>
          </section>

          <section aria-labelledby="results-heading" className="streets-results">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h2 id="results-heading" className="text-[15px] font-semibold text-ink">
                תוצאות
              </h2>
              <p role="status" className="text-[14px] text-ink-soft">
                {streetsFoundLabel(results.length)}
              </p>
            </div>

            <div className="card overflow-x-auto">
              <table className="streets-table w-full">
                <caption className="sr-only">
                  טבלת רחובות, {streetsFoundLabel(results.length)}. כותרות העמודות ממיינות.
                </caption>
                <thead>
                  <tr className="border-b border-line">
                    <SortHeader label="רחוב" field="name" sort={filter.sort} direction={filter.direction} onSort={sortBy} />
                    <SortHeader label="קולות" field="votes" sort={filter.sort} direction={filter.direction} onSort={sortBy} />
                    <SortHeader label="ציון" field="avgScore" sort={filter.sort} direction={filter.direction} onSort={sortBy} />
                    <SortHeader label="תמונות" field="photos" sort={filter.sort} direction={filter.direction} onSort={sortBy} />
                    <SortHeader label="סטטוס" field="status" sort={filter.sort} direction={filter.direction} onSort={sortBy} />
                  </tr>
                </thead>
                <tbody>
                  {results.map((row) => (
                    <tr key={row.id} className="border-b border-line last:border-0">
                      <th scope="row" className="text-right font-normal">
                        {/* The whole cell is the target, not just the name. */}
                        <Link
                          href={`/street/${row.id}`}
                          className="block px-2 py-2 underline-offset-2 hover:underline"
                        >
                          <span className="block text-[15px] font-medium text-ink">{row.name}</span>
                          <span className="block text-[12px] text-ink-faint">
                            {row.quarterName} · {row.typologyLabel}
                          </span>
                        </Link>
                      </th>
                      <td className="heat-cell" style={heatStyle(countLevel(row.votes, maxVotes))}>
                        {row.votes}
                      </td>
                      <td className="heat-cell" style={heatStyle(scoreLevel(row.avgScore))}>
                        {scoreLabel(row.avgScore)}
                      </td>
                      <td className="heat-cell" style={heatStyle(countLevel(row.photos, maxPhotos))}>
                        {row.photos}
                      </td>
                      <td className="px-2 py-2 text-[13px] text-ink-soft">
                        {row.status ? (STATUS_MAP[row.status]?.label ?? "—") : "—"}
                      </td>
                    </tr>
                  ))}
                  {results.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-2 py-4 text-center text-[15px] text-ink-soft">
                        אין רחובות שתואמים לסינון. אפשר לאפס ולנסות שוב.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <HeatLegend />
          </section>
        </div>
      ) : (
        <section aria-labelledby="quarters-heading">
          <h2 id="quarters-heading" className="mb-2 text-[15px] font-semibold text-ink">
            רובעים
          </h2>
          <div className="card overflow-x-auto">
            <table className="streets-table w-full">
              <caption className="sr-only">טבלת רובעים. כותרות העמודות ממיינות.</caption>
              <thead>
                <tr className="border-b border-line">
                  <SortHeader label="רובע" field="name" sort={quarterSort.field} direction={quarterSort.direction} onSort={sortQuartersBy} />
                  <SortHeader label="קולות" field="votes" sort={quarterSort.field} direction={quarterSort.direction} onSort={sortQuartersBy} />
                  <SortHeader label="ציון" field="avgScore" sort={quarterSort.field} direction={quarterSort.direction} onSort={sortQuartersBy} />
                  <SortHeader label="רחובות" field="streets" sort={quarterSort.field} direction={quarterSort.direction} onSort={sortQuartersBy} />
                </tr>
              </thead>
              <tbody>
                {sortedQuarters.map((row) => (
                  <tr key={row.id} className="border-b border-line last:border-0">
                    <th scope="row" className="px-2 py-2 text-right text-[15px] font-medium text-ink">
                      {row.name}
                    </th>
                    <td className="heat-cell" style={heatStyle(countLevel(row.votes, maxQuarterVotes))}>
                      {row.votes}
                    </td>
                    <td className="heat-cell" style={heatStyle(scoreLevel(row.avgScore))}>
                      {scoreLabel(row.avgScore)}
                    </td>
                    <td className="heat-cell" style={heatStyle(countLevel(row.streets, maxQuarterStreets))}>
                      {row.streets}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <HeatLegend />
        </section>
      )}

      <p className="mt-3 text-[12px] text-ink-faint">
        סך הכול {votesLabel(rows.reduce((sum, r) => sum + r.votes, 0))} על{" "}
        {rows.filter((r) => r.votes > 0).length} רחובות.
      </p>
    </div>
  );
}
