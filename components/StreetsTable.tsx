"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { STATUS_MAP } from "@/lib/city";
import type { StatusKey, TypologyKey } from "@/lib/city";
import { streetsFoundLabel, votesLabel } from "@/lib/hebrew";
import {
  DEFAULT_FILTER,
  applyStreetFilter,
  isDefaultFilter,
  streetFilterToQuery,
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

const SORT_LABELS: { key: SortField; label: string }[] = [
  { key: "votes", label: "מספר קולות" },
  { key: "avgScore", label: "ציון ממוצע" },
  { key: "photos", label: "מספר תמונות" },
  { key: "name", label: "שם הרחוב" },
];

export default function StreetsTable({
  rows,
  quarterRows,
  quarters,
  typologies,
  statuses,
  staff,
}: {
  rows: Row[];
  quarterRows: QuarterRow[];
  quarters: { id: string; name: string }[];
  typologies: { key: string; label: string }[];
  statuses: { key: string; label: string }[];
  staff: boolean;
}) {
  const [view, setView] = useState<"streets" | "quarters">("streets");
  const [filter, setFilter] = useState<StreetFilter>(DEFAULT_FILTER);

  const set = <K extends keyof StreetFilter>(key: K, value: StreetFilter[K]) =>
    setFilter((f) => ({ ...f, [key]: value }));

  const results = useMemo(() => applyStreetFilter(rows, filter), [rows, filter]);
  const exportQuery = streetFilterToQuery(filter);
  const exportSuffix = exportQuery ? `?${exportQuery}` : "";

  const field =
    "w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[15px] text-ink";

  return (
    <div>
      <div className="mb-4 flex gap-2">
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
        <>
          {/* The controls sit in their own panel, visually apart from results. */}
          <section
            aria-labelledby="filters-heading"
            className="mb-5 rounded-[14px] border border-line bg-accent-soft/60 p-4"
          >
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h2 id="filters-heading" className="text-[17px] font-semibold text-ink">
                סינון ומיון
              </h2>
              <button
                type="button"
                onClick={() => setFilter(DEFAULT_FILTER)}
                disabled={isDefaultFilter(filter)}
                className="min-h-0 rounded-[8px] border border-line bg-surface px-3 py-1 text-[13px] text-ink disabled:opacity-40"
              >
                איפוס
              </button>
            </div>

            <div className="grid gap-3">
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

              <div className="grid grid-cols-2 gap-2">
                <label className="text-[13px] text-ink-soft">
                  מיון לפי
                  <select
                    value={filter.sort}
                    onChange={(e) => set("sort", e.target.value as SortField)}
                    className={`mt-1 ${field}`}
                  >
                    {SORT_LABELS.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[13px] text-ink-soft">
                  סדר
                  <select
                    value={filter.direction}
                    onChange={(e) => set("direction", e.target.value === "asc" ? "asc" : "desc")}
                    className={`mt-1 ${field}`}
                  >
                    <option value="desc">מהגבוה לנמוך</option>
                    <option value="asc">מהנמוך לגבוה</option>
                  </select>
                </label>
              </div>
            </div>
          </section>

          <section aria-labelledby="results-heading">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h2 id="results-heading" className="text-[17px] font-semibold text-ink">
                תוצאות
              </h2>
              <p role="status" className="text-[14px] text-ink-soft">
                {streetsFoundLabel(results.length)}
              </p>
            </div>

            <div className="card overflow-x-auto">
              <table className="w-full">
                <caption className="sr-only">
                  טבלת רחובות, {streetsFoundLabel(results.length)}
                </caption>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="px-2 py-2 text-right text-[13px] font-medium text-ink-soft">
                      רחוב
                    </th>
                    <th scope="col" className="px-2 py-2 text-right text-[13px] font-medium text-ink-soft">
                      קולות
                    </th>
                    <th scope="col" className="px-2 py-2 text-right text-[13px] font-medium text-ink-soft">
                      ציון
                    </th>
                    <th scope="col" className="px-2 py-2 text-right text-[13px] font-medium text-ink-soft">
                      תמונות
                    </th>
                    <th scope="col" className="px-2 py-2 text-right text-[13px] font-medium text-ink-soft">
                      סטטוס
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row) => (
                    <tr key={row.id} className="border-b border-line last:border-0">
                      <th scope="row" className="px-2 py-2 text-right font-normal">
                        <Link
                          href={`/street/${row.id}`}
                          className="text-[15px] text-ink underline-offset-2 hover:underline"
                        >
                          {row.name}
                        </Link>
                        <span className="block text-[12px] text-ink-faint">
                          {row.quarterName} · {row.typologyLabel}
                        </span>
                      </th>
                      <td className="px-2 py-2 text-[15px] tabular-nums text-ink">{row.votes}</td>
                      <td className="px-2 py-2 text-[15px] tabular-nums text-ink">
                        {row.avgScore === null ? "—" : row.avgScore.toFixed(1)}
                      </td>
                      <td className="px-2 py-2 text-[15px] tabular-nums text-ink">{row.photos}</td>
                      <td className="px-2 py-2 text-[13px] text-ink-soft">
                        {row.status ? STATUS_MAP[row.status].label : "—"}
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
          </section>
        </>
      ) : (
        <section aria-labelledby="quarters-heading">
          <h2 id="quarters-heading" className="mb-2 text-[17px] font-semibold text-ink">
            רובעים
          </h2>
          <div className="card overflow-x-auto">
            <table className="w-full">
              <caption className="sr-only">טבלת רובעים</caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="px-2 py-2 text-right text-[13px] font-medium text-ink-soft">רובע</th>
                  <th scope="col" className="px-2 py-2 text-right text-[13px] font-medium text-ink-soft">קולות</th>
                  <th scope="col" className="px-2 py-2 text-right text-[13px] font-medium text-ink-soft">ציון</th>
                  <th scope="col" className="px-2 py-2 text-right text-[13px] font-medium text-ink-soft">רחובות</th>
                </tr>
              </thead>
              <tbody>
                {[...quarterRows]
                  .sort((a, b) => b.votes - a.votes)
                  .map((row) => (
                    <tr key={row.id} className="border-b border-line last:border-0">
                      <th scope="row" className="px-2 py-2 text-right text-[15px] font-normal text-ink">
                        {row.name}
                      </th>
                      <td className="px-2 py-2 text-[15px] tabular-nums text-ink">{row.votes}</td>
                      <td className="px-2 py-2 text-[15px] tabular-nums text-ink">
                        {row.avgScore === null ? "—" : row.avgScore.toFixed(1)}
                      </td>
                      <td className="px-2 py-2 text-[15px] tabular-nums text-ink">{row.streets}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="mt-4">
        {staff ? (
          <>
            <p className="mb-2 text-[13px] text-ink-soft">
              {view === "streets"
                ? `הייצוא כולל בדיוק את התוצאות המסוננות. ${streetsFoundLabel(results.length)}.`
                : "הייצוא כולל את כל הרחובות."}
            </p>
            <div className="flex gap-2">
              <a
                href={`/api/export/streets.csv${view === "streets" ? exportSuffix : ""}`}
                className="flex-1 rounded-[12px] border border-line bg-surface px-3 py-3 text-center text-[15px] text-ink"
              >
                ייצוא CSV
              </a>
              <a
                href={`/api/export/streets.geojson${view === "streets" ? exportSuffix : ""}`}
                className="flex-1 rounded-[12px] border border-line bg-surface px-3 py-3 text-center text-[15px] text-ink"
              >
                ייצוא GeoJSON
              </a>
            </div>
          </>
        ) : (
          <p className="text-[13px] text-ink-faint">
            ייצוא הנתונים פתוח לצוות העירייה בלבד.
          </p>
        )}
      </div>

      <p className="mt-3 text-[12px] text-ink-faint">
        סך הכול {votesLabel(rows.reduce((sum, r) => sum + r.votes, 0))} על{" "}
        {rows.filter((r) => r.votes > 0).length} רחובות.
      </p>
    </div>
  );
}
