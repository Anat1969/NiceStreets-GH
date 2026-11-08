"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QuarterIcon from "@/components/QuarterIcon";
import StreetThumb from "@/components/StreetThumb";
import { normalizeStreetName } from "@/lib/street-name";

export interface SearchQuarter {
  id: string;
  name: string;
  /** הקוד בקובץ הגבולות. null = אין לרובע גבול על המפה. */
  rovaCode: string | null;
}

export interface SearchStreet {
  id: string;
  name: string;
  synonyms: string[];
  quarterName: string;
  votes: number;
  photoId: string | null;
}

/*
 * חיפוש אחד לרובע ולרחוב (ענת, 09.11.2026). הוא יושב באותו מקום בשתי
 * התצוגות — הדף מציב אותו מתחת לכותרת, לפני כל מה שמשתנה בין התצוגות —
 * ולכן הבחירה בתצוגה לא מזיזה אותו. התוצאות נפתחות מעל המפה, בשכבה צפה
 * בגובה קבוע, ולא דוחפות אותה למטה.
 *
 * בחירת רובע פותחת את מפת הרובעים עליו. בחירת רחוב פותחת את מפת
 * הרחובות, טסה אליו ומציגה את הגיליון שלו. הכול דרך הכתובת, כך שגם קישור
 * או רענון מגיעים לאותו מקום.
 */
function normalizeQuarter(text: string): string {
  return text
    .replace(/['"״׳`]/g, "")
    .replace(/^\s*רובע\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function MapSearch({
  quarters,
  streets,
}: {
  quarters: SearchQuarter[];
  streets: SearchStreet[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    const qNorm = normalizeQuarter(q);
    const sNorm = normalizeStreetName(q);
    // "רובע ה" מחפש רק רובעים ממוספרים; "ה" לבד או "מרינה" מחפשים גם אזורים.
    const askedRova = /^\s*רובע/.test(q);
    const quarterHits = quarters
      .filter((x) => {
        if (askedRova && !x.name.startsWith("רובע")) return false;
        const name = normalizeQuarter(x.name);
        return name === qNorm || name.startsWith(qNorm) || (!askedRova && x.name.includes(q));
      })
      .sort((a, b) => Number(normalizeQuarter(b.name) === qNorm) - Number(normalizeQuarter(a.name) === qNorm))
      .slice(0, 3)
      .map((x) => ({ kind: "quarter" as const, x }));
    const streetHits = sNorm
      ? streets
          .filter(
            (s) =>
              normalizeStreetName(s.name).includes(sNorm) ||
              s.synonyms.some((syn) => normalizeStreetName(syn).includes(sNorm)),
          )
          .sort((a, b) => {
            const as = normalizeStreetName(a.name).startsWith(sNorm) ? 0 : 1;
            const bs = normalizeStreetName(b.name).startsWith(sNorm) ? 0 : 1;
            return as - bs || b.votes - a.votes;
          })
          .slice(0, 6)
          .map((s) => ({ kind: "street" as const, s }))
      : [];
    return [...quarterHits, ...streetHits];
  }, [query, quarters, streets]);

  function go(index: number) {
    const r = results[index];
    if (!r) return;
    setOpen(false);
    setQuery("");
    input.current?.blur();
    if (r.kind === "quarter") {
      router.push(
        r.x.rovaCode
          ? `/map?quarter=${encodeURIComponent(r.x.rovaCode)}`
          : `/streets?quarter=${encodeURIComponent(r.x.id)}&minVotes=0`,
      );
    } else {
      router.push(`/map?view=streets&street=${encodeURIComponent(r.s.id)}`);
    }
  }

  const showList = open && query.trim().length > 0;

  return (
    <div className="map-search" role="search">
      <label className="sr-only" htmlFor="map-search-input">
        חיפוש רובע או רחוב
      </label>
      <input
        ref={input}
        id="map-search-input"
        type="search"
        value={query}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls="map-search-list"
        aria-activedescendant={showList && results[active] ? `map-search-opt-${active}` : undefined}
        placeholder="חיפוש רובע או רחוב, למשל: רובע ה, רוגוזין"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            go(active);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="map-search-input"
      />
      {showList ? (
        <ul id="map-search-list" role="listbox" className="map-search-list">
          {results.length === 0 ? (
            <li className="map-search-empty">
              לא נמצא רובע או רחוב מדורג בשם הזה. רחוב שעוד לא דורג לא מופיע על המפה.
            </li>
          ) : (
            results.map((r, i) => (
              <li
                key={r.kind === "quarter" ? `q-${r.x.id}` : `s-${r.s.id}`}
                id={`map-search-opt-${i}`}
                role="option"
                aria-selected={i === active}
              >
                <button
                  type="button"
                  className="map-search-opt"
                  data-active={i === active || undefined}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => go(i)}
                >
                  {r.kind === "quarter" ? (
                    <>
                      <span className="map-search-media">
                        <QuarterIcon id={r.x.id} size={28} className="text-accent" />
                      </span>
                      <span className="map-search-text">
                        <span className="map-search-name">{r.x.name}</span>
                        <span className="map-search-kind">
                          {r.x.rovaCode ? "רובע · פותח את מפת הרובעים" : "אזור בלי גבול במפה · פותח את רשימת הרחובות"}
                        </span>
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="map-search-media">
                        <StreetThumb photoId={r.s.photoId} name={r.s.name} width={40} height={30} />
                      </span>
                      <span className="map-search-text">
                        <span className="map-search-name">{r.s.name}</span>
                        <span className="map-search-kind">
                          רחוב · {r.s.quarterName} · {r.s.votes} {r.s.votes === 1 ? "קול" : "קולות"}
                        </span>
                      </span>
                    </>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
