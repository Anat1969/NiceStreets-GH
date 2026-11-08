import Legend from "@/components/Legend";
import {
  residentPct,
  verdictPct,
  VERDICT_LABELS,
  fmt,
  targetText,
  type CriterionRow,
  type StreetAudit,
} from "@/lib/audit";

/*
 * קול התושבים מול הבדיקה האמפירית (ענת, 09.11.2026, סעיף 5).
 *
 * דירוג התושבים מתעדכן עם כל קול. הבדיקה היא נקודת הייחוס: מדידה לפי
 * מקורות מידע, שהצוות מריץ שוב כשהמקורות משתנים. הפער ביניהם מוצג
 * באחוזים, כמידע ולא כטעות: פער אומר שהתושבים חווים משהו שהמדידה לא
 * רואה, או שהמדידה רואה משהו שעוד לא הורגש.
 */

function gapLine(res: number | null, aud: number | null): { text: string; dir: "up" | "down" | "even" | "none" } {
  if (res === null || aud === null) return { text: "אין עדיין שני הצדדים להשוואה", dir: "none" };
  const d = res - aud;
  if (Math.abs(d) < 5) return { text: "התושבים והמדידה מסכימים", dir: "even" };
  return d > 0
    ? { text: `התושבים מעריכים ב-${d}% יותר מהמדידה`, dir: "up" }
    : { text: `התושבים מעריכים ב-${-d}% פחות מהמדידה`, dir: "down" };
}

export default function ResidentVsAudit({
  audit,
  criteria,
  residentAvg,
  staff,
  compact = false,
}: {
  audit: StreetAudit | null;
  criteria: CriterionRow[];
  /** ציון התושבים הכולל, 1..5. */
  residentAvg: number | null;
  staff: boolean;
  /** בתצוגת הצוות: רק הסיכום והטבלה, בלי הסבר ארוך. */
  compact?: boolean;
}) {
  const approved = audit && (audit.state === "approved" || audit.state === "edited_approved");
  // בלי ממוצע כולל (תצוגת הצוות) — ממוצע הדירוגים לפי הקריטריונים שבבדיקה.
  const fromResults = (audit?.results ?? [])
    .map((r) => r.resident_avg)
    .filter((x): x is number => x !== null && x !== undefined)
    .map(Number);
  const resOverall = residentPct(
    residentAvg ?? (fromResults.length ? fromResults.reduce((a, b) => a + b, 0) / fromResults.length : null),
  );

  if (!audit || (!approved && !staff)) {
    return (
      <div className="rva">
        <div className="rva-overall">
          <div className="rva-side">
            <span className="rva-label">התושבים</span>
            <span className="score-hand rva-num">{resOverall === null ? "—" : `${resOverall}%`}</span>
          </div>
          <div className="rva-side rva-muted">
            <span className="rva-label">הבדיקה האמפירית</span>
            <span className="rva-num-small">עוד לא אושרה</span>
          </div>
        </div>
        <p className="how">
          הבדיקה לפי מקורות המידע מתפרסמת אחרי שהצוות מאשר אותה. עד אז מוצג כאן רק קול התושבים, שמתעדכן עם כל דירוג.
        </p>
      </div>
    );
  }

  const audOverall =
    audit.objective_score === null || audit.objective_score === undefined
      ? null
      : Math.round(Number(audit.objective_score) * 100);
  const overallGap = gapLine(resOverall, audOverall);
  const byId = new Map(criteria.map((c) => [c.id, c]));
  const rows = audit.results
    .map((r) => ({ r, c: byId.get(r.criterion_id) }))
    .filter((x) => x.c)
    .sort((a, b) => (a.c!.sort ?? 0) - (b.c!.sort ?? 0));

  return (
    <div className="rva">
      {!approved ? (
        <p className="rva-draft">טיוטה לצוות: הבדיקה עוד לא אושרה, ולכן הציבור לא רואה אותה.</p>
      ) : null}
      <div className="rva-overall">
        <div className="rva-side">
          <span className="rva-label">התושבים</span>
          <span className="score-hand rva-num">{resOverall === null ? "—" : `${resOverall}%`}</span>
        </div>
        <div className="rva-side">
          <span className="rva-label">הבדיקה האמפירית</span>
          <span className="score-hand rva-num rva-num-audit">{audOverall === null ? "—" : `${audOverall}%`}</span>
        </div>
        <p className="rva-gap" data-dir={overallGap.dir}>
          {overallGap.text}
        </p>
      </div>

      {!compact ? (
        <p className="how">
          פער אינו טעות של אף צד.
          <br />
          כשהתושבים מעריכים יותר — יש ברחוב משהו טוב שהמדידה עוד לא תופסת.
          <br />
          כשפחות — המדידה מראה פוטנציאל שעוד לא מורגש, או בעיה שהנתונים לא רואים.
        </p>
      ) : null}

      <div className="rva-table-wrap">
        <table className="param-table rva-table">
          <thead>
            <tr>
              <th scope="col">קריטריון</th>
              <th scope="col">תושבים</th>
              <th scope="col">מדידה</th>
              <th scope="col">פער</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ r, c }) => {
              const res = residentPct(r.resident_avg);
              const aud = verdictPct(r.verdict);
              const g = gapLine(res, aud);
              const diff = res !== null && aud !== null ? res - aud : null;
              return (
                <tr key={r.criterion_id}>
                  <th scope="row">{c!.name_he}</th>
                  <td className="num">
                    {res === null ? <span className="text-ink-faint">—</span> : `${res}%`}
                    {r.resident_n ? <span className="rva-n"> ({r.resident_n})</span> : null}
                  </td>
                  <td className="num">
                    {aud === null ? (
                      <span className="text-ink-faint">{VERDICT_LABELS[r.verdict]}</span>
                    ) : (
                      <>
                        {aud}%
                        <span className="rva-n">
                          {" "}
                          {fmt(r.value)} / {targetText(r.benchmark_min, r.benchmark_max)}
                        </span>
                      </>
                    )}
                  </td>
                  <td className="num" data-dir={g.dir}>
                    {diff === null ? "—" : `${diff > 0 ? "+" : ""}${diff}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Legend
        items={[
          { swatch: "var(--tone-solution)", label: "פער חיובי: התושבים מעריכים יותר" },
          { swatch: "var(--color-warm)", label: "פער שלילי: המדידה גבוהה יותר" },
          { swatch: "var(--color-ink-faint)", label: "עד 5% — הסכמה" },
        ]}
        note="תושבים: ממוצע 1–5 באחוזים. מדידה: עומד ביעד 100%, חלקי 50%, מתחת ליעד 0%. בסוגריים: מספר המדרגים, והערך שנמדד מול היעד."
      />
    </div>
  );
}
