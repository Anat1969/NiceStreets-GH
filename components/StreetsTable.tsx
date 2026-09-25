"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { STATUS_MAP } from "@/lib/city";
import type { StatusKey } from "@/lib/city";

interface Row {
  id: string;
  name: string;
  quarterId: string | null;
  quarterName: string;
  typology: string | null;
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

type SortKey = "name" | "votes" | "avgScore" | "photos";

export default function StreetsTable({
  rows,
  quarterRows,
  quarters,
  typologies,
  staff,
}: {
  rows: Row[];
  quarterRows: QuarterRow[];
  quarters: { id: string; name: string }[];
  typologies: { key: string; label: string }[];
  staff: boolean;
}) {
  const [view, setView] = useState<"streets" | "quarters">("streets");
  const [quarterId, setQuarterId] = useState("");
  const [typology, setTypology] = useState("");
  const [onlyVoted, setOnlyVoted] = useState(true);
  const [sort, setSort] = useState<SortKey>("votes");
  const [asc, setAsc] = useState(false);

  const filtered = useMemo(() => {
    const list = rows
      .filter((r) => !quarterId || r.quarterId === quarterId)
      .filter((r) => !typology || r.typology === typology)
      .filter((r) => !onlyVoted || r.votes > 0);
    const direction = asc ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "he") * direction;
      const av = sort === "avgScore" ? (a.avgScore ?? -1) : a[sort];
      const bv = sort === "avgScore" ? (b.avgScore ?? -1) : b[sort];
      return (av - bv) * direction;
    });
  }, [rows, quarterId, typology, onlyVoted, sort, asc]);

  function toggleSort(key: SortKey) {
    if (sort === key) setAsc((v) => !v);
    else {
      setSort(key);
      setAsc(key === "name");
    }
  }

  const header = (label: string, key: SortKey) => (
    <th scope="col" className="px-2 py-2 text-right text-[13px] font-medium text-ink-soft">
      <button
        type="button"
        onClick={() => toggleSort(key)}
        aria-sort={sort === key ? (asc ? "ascending" : "descending") : "none"}
        className="min-h-0 text-[13px] underline-offset-2 hover:underline"
      >
        {label}
        {sort === key ? (asc ? " ▲" : " ▼") : ""}
      </button>
    </th>
  );

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => setView("streets")}
          aria-pressed={view === "streets"}
          className={`flex-1 rounded-[12px] px-3 py-2 text-[15px] ${
            view === "streets" ? "bg-accent text-white" : "border border-line bg-surface text-ink"
          }`}
        >
          רחובות
        </button>
        <button
          type="button"
          onClick={() => setView("quarters")}
          aria-pressed={view === "quarters"}
          className={`flex-1 rounded-[12px] px-3 py-2 text-[15px] ${
            view === "quarters" ? "bg-accent text-white" : "border border-line bg-surface text-ink"
          }`}
        >
          רובעים
        </button>
      </div>

      {view === "streets" ? (
        <>
          <div className="mb-3 grid gap-2">
            <label className="text-[14px] text-ink-soft">
              רובע
              <select
                value={quarterId}
                onChange={(e) => setQuarterId(e.target.value)}
                className="mt-1 w-full rounded-[12px] border border-line bg-surface px-3 py-2 text-[15px] text-ink"
              >
                <option value="">כל הרובעים</option>
                {quarters.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[14px] text-ink-soft">
              סוג רחוב
              <select
                value={typology}
                onChange={(e) => setTypology(e.target.value)}
                className="mt-1 w-full rounded-[12px] border border-line bg-surface px-3 py-2 text-[15px] text-ink"
              >
                <option value="">כל הסוגים</option>
                {typologies.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-[14px] text-ink-soft">
              <input
                type="checkbox"
                checked={onlyVoted}
                onChange={(e) => setOnlyVoted(e.target.checked)}
              />
              רק רחובות עם קולות
            </label>
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full">
              <caption className="sr-only">טבלת רחובות</caption>
              <thead>
                <tr className="border-b border-line">
                  {header("רחוב", "name")}
                  {header("קולות", "votes")}
                  {header("ציון", "avgScore")}
                  {header("תמונות", "photos")}
                  <th scope="col" className="px-2 py-2 text-right text-[13px] font-medium text-ink-soft">
                    סטטוס
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-b border-line last:border-0">
                    <th scope="row" className="px-2 py-2 text-right font-normal">
                      <Link href={`/street/${row.id}`} className="text-[15px] text-ink underline-offset-2 hover:underline">
                        {row.name}
                      </Link>
                      <span className="block text-[12px] text-ink-faint">{row.quarterName}</span>
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
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-2 py-4 text-center text-[15px] text-ink-soft">
                      אין רחובות שתואמים לסינון.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : (
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
      )}

      <div className="mt-4">
        {staff ? (
          <div className="flex gap-2">
            <a
              href="/api/export/streets.csv"
              className="flex-1 rounded-[12px] border border-line bg-surface px-3 py-3 text-center text-[15px] text-ink"
            >
              ייצוא CSV
            </a>
            <a
              href="/api/export/streets.geojson"
              className="flex-1 rounded-[12px] border border-line bg-surface px-3 py-3 text-center text-[15px] text-ink"
            >
              ייצוא GeoJSON
            </a>
          </div>
        ) : (
          <p className="text-[13px] text-ink-faint">ייצוא הנתונים פתוח לצוות העירייה בלבד.</p>
        )}
      </div>
    </div>
  );
}
