"use client";

import Link from "next/link";
import { useState } from "react";
import { StreetTile } from "@/components/StreetTile";

export interface LeaderRow {
  id: string;
  name: string;
  quarterName: string;
  votes: number;
  /** ציון מתוך 10, כבר מעוגל לתצוגה. */
  score: string;
  /** ציון משוקלל מתוך 10. */
  weighted: string;
  avgScore: number | null;
  photoId: string | null;
}

type By = "votes" | "score" | "weighted";

const MODES: { key: By; label: string; explain: string }[] = [
  {
    key: "votes",
    label: "קולות",
    explain: "הרחובות שהכי הרבה תושבים דירגו. מדד של עניין, לא של איכות.",
  },
  {
    key: "score",
    label: "ציון",
    explain: "הציון הממוצע הגבוה ביותר. רחוב עם קול אחד יכול להגיע לכאן.",
  },
  {
    key: "weighted",
    label: "שקלול",
    explain:
      "ציון ממוצע שנמשך אל ממוצע העיר כשיש מעט קולות. כך רחוב עם קול אחד של 10 לא עוקף רחוב שעשרות תושבים נתנו לו 8.5. זו הדרך המומלצת.",
  },
];

/*
 * "5 המובילים" — לפי מה? (ענת, 09.11.2026: "זו שאלה שנשאלת ולא ברורה").
 * מתג קטן ליד הכותרת, והסבר נטוי של מה בדיוק נמדד.
 */
export default function Leaders({ lists }: { lists: Record<By, LeaderRow[]> }) {
  const [by, setBy] = useState<By>("weighted");
  const rows = lists[by];
  const mode = MODES.find((m) => m.key === by)!;

  return (
    <section className="mb-8" aria-labelledby="leaders-title">
      <div className="leaders-head">
        <h2 id="leaders-title" className="section-title">
          5 המובילים
        </h2>
        <div className="seg" role="radiogroup" aria-label="מיון המובילים">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              role="radio"
              aria-checked={by === m.key}
              onClick={() => setBy(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <p className="how mb-3">{mode.explain}</p>

      {rows.length === 0 ? (
        <div className="card p-4">
          <p className="text-[15px] text-ink-soft">עדיין אין קולות. הרחוב הראשון שתבחרו יופיע כאן.</p>
        </div>
      ) : (
        <ol className="grid gap-2">
          {rows.map((row, index) => (
            <li key={row.id}>
              <Link href={`/street/${row.id}`} className="card flex items-stretch gap-3 overflow-hidden p-0">
                <StreetTile
                  className="h-[88px] w-[112px] shrink-0"
                  name={row.name}
                  quarterName={row.quarterName}
                  avgScore={row.avgScore}
                  photoId={row.photoId}
                />
                <span className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-3">
                  <span className="score-hand w-7 shrink-0 text-[22px] text-accent">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-semibold text-ink">{row.name}</span>
                    <span className="block truncate text-[13px] text-ink-faint">{row.quarterName}</span>
                    {/* שני הנתונים שאינם המיון — קטנים ושקטים. */}
                    <span className="leader-minor">
                      {by !== "votes" ? (
                        <span>
                          <bdi className="num">{row.votes.toLocaleString("he-IL")}</bdi> {row.votes === 1 ? "קול" : "קולות"}
                        </span>
                      ) : null}
                      {by !== "score" ? (
                        <span>
                          ציון <bdi className="num">{row.score}</bdi>
                        </span>
                      ) : null}
                      {by !== "weighted" ? (
                        <span>
                          משוקלל <bdi className="num">{row.weighted}</bdi>
                        </span>
                      ) : null}
                    </span>
                  </span>
                  {/* הנתון שלפיו ממוינת הרשימה — גדול, בכתב יד, עם תווית. */}
                  <span className="leader-key shrink-0 text-center">
                    <span className="leader-key-label">ממוין לפי</span>
                    <span className="score-hand block text-[32px]" data-on>
                      {by === "votes" ? row.votes.toLocaleString("he-IL") : by === "score" ? row.score : row.weighted}
                    </span>
                    <span className="block text-[11px] text-ink-faint">
                      {by === "votes" ? (row.votes === 1 ? "קול" : "קולות") : by === "score" ? "ציון מ-10" : "משוקלל, מ-10"}
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
