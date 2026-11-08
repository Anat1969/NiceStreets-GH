import Link from "next/link";
import { QUARTERS, TYPOLOGIES, TYPOLOGY_MAP } from "@/lib/city";
import { getStore } from "@/lib/store";
import { loadCityData } from "@/lib/data";
import { loadAuditOverview, STATE_LABELS } from "@/lib/audit";
import { votesLabel } from "@/lib/hebrew";
import { getRole } from "@/lib/session";
import { StatusBadge } from "@/components/ui";
import PhotoModeration from "@/components/PhotoModeration";
import ReportHandled from "@/components/ReportHandled";
import StreetAssignment from "@/components/StreetAssignment";
import Queue from "@/components/staff/Queue";
import StatusInline from "@/components/staff/StatusInline";
import "./staff.css";

export const dynamic = "force-dynamic";

export const metadata = { title: "שולחן העבודה של הצוות — הרחובות הטובים של אשדוד" };

/*
 * שולחן העבודה של הצוות (בקשת ענת, 08.11.2026, סעיף 22).
 *
 * לוח הבקרה (/admin) מציג הכול: מצב, ייצוא, העלאות, הגדרות. כאן רק מה
 * שמחכה לפעולה, בסדר קבוע ובמספרים: תמונות, דיווחים, סיווג, בדיקות,
 * סטטוסים. כל תור אומר מה עושים בו ומה השלב הבא, וכל פעולה נעשית במקום,
 * דרך אותם נתיבי API שלוח הבקרה כבר משתמש בהם. ההרשאה נאכפת שוב במסד (RLS).
 */
export default async function StaffPage() {
  const role = await getRole();
  if (role === "resident") {
    return (
      <>
        <h1 className="mb-1 text-[24px] font-bold text-ink">שולחן העבודה של הצוות</h1>
        <p className="mb-2 text-[15px] text-ink">הדף הזה לצוות אדריכלות העיר בלבד.</p>
        <p className="mb-4 text-[14px] text-ink-soft">
          הכניסה נעשית בלוח הבקרה, בקישור שנשלח למייל של איש הצוות.
        </p>
        <Link
          href="/admin"
          className="pressable inline-flex min-h-11 items-center rounded-[12px] bg-accent px-4 text-[15px] font-medium text-white"
        >
          לכניסת צוות
        </Link>
      </>
    );
  }

  const store = getStore();
  const [{ streetStats, error: dataError }, allVotes, everyPhoto, openReports, audits] =
    await Promise.all([
      loadCityData(),
      store.listVotes().catch(() => []),
      store.listPhotos().catch(() => []),
      store
        .listReports({ handled: false })
        .catch(() => [] as Awaited<ReturnType<typeof store.listReports>>),
      loadAuditOverview(),
    ]);

  // 1. תמונות: הוותיקה קודם, עם מה שהתושב כתב כתת־כותרת.
  const reasonByVote = new Map(allVotes.map((v) => [v.id, v.reason]));
  const streetNameById = new Map(streetStats.map((s) => [s.street.id, s.street.name]));
  const pendingPhotos = everyPhoto
    .filter((p) => p.status === "pending")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((p) => ({
      id: p.id,
      streetId: p.streetId,
      streetName: streetNameById.get(p.streetId) ?? "רחוב לא ידוע",
      createdAt: p.createdAt,
      reason: (p.voteId ? (reasonByVote.get(p.voteId) ?? "") : "").trim() || undefined,
    }));

  // 2. דיווחים פתוחים: הוותיק קודם.
  const reports = [...openReports].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  // 3. סיווג: רחובות עם קולות שאין להם סוג, וכל רחוב שתושב הציע לו סוג אחר.
  const suggestionsByStreet = new Map<string, Map<string, number>>();
  for (const vote of allVotes) {
    if (!vote.typologySuggestion) continue;
    const counts = suggestionsByStreet.get(vote.streetId) ?? new Map<string, number>();
    counts.set(vote.typologySuggestion, (counts.get(vote.typologySuggestion) ?? 0) + 1);
    suggestionsByStreet.set(vote.streetId, counts);
  }
  const toClassify = streetStats
    .filter(
      (row) =>
        suggestionsByStreet.has(row.street.id) ||
        (row.votes > 0 && (!row.street.typology || !row.street.quarterId)),
    )
    .sort((a, b) => b.votes - a.votes)
    .map((row) => ({
      id: row.street.id,
      name: row.street.name,
      code: row.street.code,
      quarterId: row.street.quarterId,
      typology: row.street.typology,
      votes: row.votes,
      suggestions: [...(suggestionsByStreet.get(row.street.id) ?? new Map()).entries()].map(
        ([key, count]) => ({ label: TYPOLOGY_MAP[key]?.label ?? key, count }),
      ),
    }));

  // 4. רשימת בדיקות: רחוב עם קולות = שורה. פתוח עד שהבדיקה שלו אושרה.
  const auditByStreet = new Map(audits.latest.map((a) => [a.street_id, a]));
  const checklist = streetStats
    .filter((row) => row.votes > 0)
    .map((row) => {
      const audit = auditByStreet.get(row.street.id);
      const done = audit?.state === "approved" || audit?.state === "edited_approved";
      const label = audit ? STATE_LABELS[audit.state] : "טרם נבדק";
      return { id: row.street.id, name: row.street.name, votes: row.votes, done, label };
    })
    .sort((a, b) => Number(a.done) - Number(b.done) || b.votes - a.votes);
  const checklistOpen = checklist.filter((c) => !c.done).length;
  const gaps = audits.voteGaps.filter((g) => g.state === "gap").length;

  // 5. סטטוסים: רחוב שקיבל קולות ואין לו סטטוס קודם, ואז הוותיק בעדכון.
  const statusRows = streetStats
    .filter((row) => row.votes > 0)
    .sort((a, b) => {
      const aHas = a.status ? 1 : 0;
      const bHas = b.status ? 1 : 0;
      if (aHas !== bHas) return aHas - bHas;
      return b.votes - a.votes;
    });
  const withoutStatus = statusRows.filter((r) => !r.status).length;

  const queues = [
    { id: "q-photos", title: "תמונות לאישור", count: pendingPhotos.length },
    { id: "q-reports", title: "דיווחים פתוחים", count: reports.length },
    { id: "q-types", title: "סוג רחוב", count: toClassify.length },
    { id: "q-checks", title: "רשימת בדיקות", count: checklistOpen },
    { id: "q-status", title: "עדכוני סטטוס", count: withoutStatus },
  ];
  const totalOpen = queues.reduce((sum, q) => sum + q.count, 0);

  return (
    <div className="staff-page">
      <p className="mb-1 text-[13px] text-ink-faint">
        <Link href="/admin" className="inline-link underline underline-offset-2">
          לוח בקרה
        </Link>{" "}
        · שולחן העבודה
      </p>
      <h1 className="mb-1 text-[24px] font-bold text-ink">שולחן העבודה של הצוות</h1>
      <p className="mb-1 text-[15px] text-ink">
        {totalOpen === 0
          ? "אין כרגע משהו שמחכה לכם."
          : `${totalOpen.toLocaleString("he-IL")} פריטים מחכים לפעולה.`}
      </p>
      <p className="mb-4 text-[14px] text-ink-soft">
        עובדים מלמעלה למטה.
        <br />
        כל תור אומר מה עושים בו ומה השלב הבא.
      </p>

      {dataError ? (
        <p role="alert" className="mb-4 rounded-[12px] border border-warm bg-warm-soft px-3 py-2 text-[14px] text-ink">
          תקלה בקריאה ממסד הנתונים: {dataError}
        </p>
      ) : null}

      <nav className="staff-index" aria-label="התורים בדף">
        <ol>
          {queues.map((q, i) => (
            <li key={q.id}>
              <a href={`#${q.id}`} data-open={q.count > 0 ? "true" : "false"}>
                <span className="staff-index-num">{i + 1}</span>
                <span className="staff-index-title">{q.title}</span>
                <span className="staff-index-count">{q.count.toLocaleString("he-IL")}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <Queue
        step={1}
        id="q-photos"
        title="תמונות לאישור"
        count={pendingPhotos.length}
        countLabel="תמונות ממתינות"
        what="תמונה של תושב מתפרסמת רק אחרי אישור. בודקים שאין פנים מזוהות או לוחיות רישוי, ושהיא מהרחוב שצוין."
        next="אחרי האישור התמונה מופיעה בכרטיס הרחוב. ממשיכים לדיווחים."
        emptyTitle="אין תמונות שממתינות לאישור."
        emptyText="תמונה חדשה של תושב תופיע כאן."
      >
        <PhotoModeration photos={pendingPhotos} />
      </Queue>

      <Queue
        step={2}
        id="q-reports"
        title="דיווחים פתוחים"
        count={reports.length}
        countLabel="דיווחים פתוחים"
        what="דיווח על משהו שקרה ברחוב, או הצעה של רחוב שאינו ברשימה. קוראים, מעבירים לגורם המטפל, ומסמנים כטופל."
        next="דיווח שסומן כטופל יוצא מהתור. ממשיכים לסוג הרחוב."
        emptyTitle="אין דיווחים פתוחים."
      >
        <ol className="staff-list">
          {reports.map((report) => (
            <li key={report.id} className="staff-item">
              <div className="staff-item-head">
                <p className="staff-item-title">{report.streetName || "רחוב בלי שם"}</p>
                <span className="staff-item-meta">
                  {new Date(report.createdAt).toLocaleDateString("he-IL")}
                </span>
              </div>
              <p className="staff-item-meta">
                {report.kind === "issue" ? "דיווח לעירייה" : "הצעת רחוב שאינו ברשימה"}
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/reports/${report.id}/photo`}
                alt={`התמונה שצורפה לדיווח על ${report.streetName}`}
                className="staff-report-photo"
              />
              <p className="staff-resident-text">{report.body}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <ReportHandled reportId={report.id} handled={report.handled} />
                {report.streetId ? (
                  <Link
                    href={`/street/${report.streetId}`}
                    className="inline-flex min-h-11 items-center text-[14px] text-accent underline underline-offset-2"
                  >
                    לכרטיס הרחוב
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </Queue>

      <Queue
        step={3}
        id="q-types"
        title="סוג רחוב ורובע"
        count={toClassify.length}
        countLabel="רחובות לסיווג"
        what="רחוב שקיבל קולות צריך סוג ורובע, כדי שיושווה לרחובות מאותו סוג. הצעות התושבים מסומנות ליד כל רחוב."
        next="רחוב שסווג נמדד מול הערך של הסוג שלו. ממשיכים לרשימת הבדיקות."
        emptyTitle="כל הרחובות שקיבלו קולות מסווגים, ואין הצעות חדשות."
      >
        <StreetAssignment
          quarters={QUARTERS.map((q) => ({ id: q.id, name: q.name }))}
          typologies={TYPOLOGIES.map((t) => ({ key: t.key, label: t.label }))}
          rows={toClassify}
        />
      </Queue>

      <Queue
        step={4}
        id="q-checks"
        title="רשימת בדיקות"
        count={checklistOpen}
        countLabel="בדיקות פתוחות"
        what="לכל רחוב עם קולות יש בדיקה אוטומטית מול הקריטריונים. בדיקה סגורה רק אחרי שהצוות אישר אותה."
        next="מאשרים או מחזירים לשטח במסך הבדיקה, ואז קובעים סטטוס לרחוב."
        emptyTitle="כל הבדיקות אושרו."
      >
        {audits.error ? (
          <p role="alert" className="mb-2 text-[14px] text-ink">
            טעינת הבדיקות נכשלה: {audits.error}
          </p>
        ) : null}
        <p className="mb-2 text-[13px] text-ink-soft">
          {checklist.length - checklistOpen} מתוך {checklist.length} סגורות
          {gaps > 0 ? ` · ${gaps} קולות עם פער מעל 30% בין המדידה לדירוג` : ""}
        </p>
        <div className="staff-progress" role="presentation">
          <span
            style={{
              width: `${checklist.length ? Math.round(((checklist.length - checklistOpen) / checklist.length) * 100) : 0}%`,
            }}
          />
        </div>
        <ul className="staff-checklist">
          {checklist.map((row) => (
            <li key={row.id} data-done={row.done ? "true" : "false"}>
              <span className="staff-check" aria-hidden="true" />
              <Link href={`/street/${row.id}`} className="staff-check-name">
                {row.name}
                <span className="staff-item-meta">{votesLabel(row.votes)}</span>
              </Link>
              <span className="staff-check-state">
                <span className="sr-only">{row.done ? "סגורה: " : "פתוחה: "}</span>
                {row.label}
              </span>
            </li>
          ))}
        </ul>
        <Link
          href="/admin/audit"
          className="mt-2 inline-flex min-h-11 items-center text-[15px] font-medium text-accent underline underline-offset-2"
        >
          למסך הבדיקה, לאישור ולפערים
        </Link>
      </Queue>

      <Queue
        step={5}
        id="q-status"
        title="עדכוני סטטוס"
        count={withoutStatus}
        countLabel="רחובות בלי סטטוס"
        what="הסטטוס הוא מה שהתושבים רואים על המפה ובכרטיס הרחוב. רחובות בלי סטטוס מופיעים ראשונים."
        next="הסטטוס וההערה לציבור מתפרסמים מיד בדף הבית ובכרטיס הרחוב."
        emptyTitle="לכל רחוב שקיבל קולות יש סטטוס."
      >
        <ul className="staff-list">
          {statusRows.map((row) => (
            <li key={row.street.id} className="staff-item">
              <div className="staff-item-head">
                <Link href={`/street/${row.street.id}`} className="staff-item-title underline-offset-2 hover:underline">
                  {row.street.name}
                </Link>
                <StatusBadge status={row.status?.status ?? null} />
              </div>
              <p className="staff-item-meta">
                {row.quarterName} · {votesLabel(row.votes)}
              </p>
              <StatusInline
                streetId={row.street.id}
                current={row.status?.status ?? null}
                note={row.status?.publicNote ?? ""}
              />
            </li>
          ))}
        </ul>
      </Queue>

      <p className="staff-foot">
        הדף מציג רק מה שמחכה לפעולה.
        <br />
        מצב כללי, ייצוא, העלאות והגדרות נמצאים בלוח הבקרה.
        <br />
        כל פעולה נבדקת שוב במסד הנתונים מול הרשאת הצוות.
      </p>
    </div>
  );
}
