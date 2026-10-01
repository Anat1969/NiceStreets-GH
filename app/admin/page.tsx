import Link from "next/link";
import { QUARTERS, STATUSES, TYPOLOGIES, TYPOLOGY_MAP } from "@/lib/city";
import { getStore, getStoreConfigError, storeIsDurable } from "@/lib/store";
import { loadCityData } from "@/lib/data";
import { photoShareByQuarter } from "@/lib/stats";
import { votesLabel } from "@/lib/hebrew";
import { getRole, getSignedInEmail } from "@/lib/session";
import StaffLogin from "@/components/StaffLogin";
import { Card, Notice, Section, StatusBadge } from "@/components/ui";
import DemoControls from "@/components/DemoControls";
import PhotoModeration from "@/components/PhotoModeration";
import { QUARTER_MAP } from "@/lib/city";
import { contestedThemes } from "@/lib/themes";
import AdminUpload from "@/components/AdminUpload";
import AuditRunButton from "@/components/AuditRunButton";
import { loadAuditOverview } from "@/lib/audit";
import StreetAssignment from "@/components/StreetAssignment";
import ImageFrame from "@/components/ImageFrame";
import { imageSlot } from "@/lib/content-images";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const [role, signedInEmail] = await Promise.all([getRole(), getSignedInEmail()]);
  const staff = role !== "resident";

  if (!staff) {
    return (
      <>
        <h1 className="mb-1 text-[24px] font-bold text-ink">כניסת צוות</h1>
        {signedInEmail ? (
          <div role="alert" className="mb-3 rounded-[12px] border border-warm bg-warm-soft px-3 py-2 text-[14px] text-ink">
            <p className="font-medium">
              נכנסתם בכתובת <span dir="ltr">{signedInEmail}</span>, והיא אינה רשומה כצוות.
            </p>
            <p className="mt-1 text-[13px]">
              הוספת איש צוות נעשית על ידי אדריכלית העיר. אחרי ההוספה צריך לבקש קישור כניסה חדש.
            </p>
          </div>
        ) : null}
        <p className="mb-4 text-[14px] text-ink-soft">
          לוח הבקרה של אגף אדריכלות העיר. הכניסה בקישור שנשלח למייל של איש
          הצוות, בלי סיסמה.
        </p>
        {error ? (
          <div role="alert" className="mb-3 rounded-[12px] border border-warm bg-warm-soft px-3 py-2 text-[14px] text-ink">
            <p className="font-medium">קישור הכניסה לא עבד.</p>
            <p className="mt-1 text-[13px]">
              קישור תקף פעם אחת ולזמן מוגבל, ורק בדפדפן שבו ביקשתם אותו. אפשר
              לבקש קישור חדש כאן.
            </p>
          </div>
        ) : null}
        <StaffLogin />
      </>
    );
  }

  const store = getStore();
  const [
    { streetStats, totals, error: dataError },
    allVotes,
    everyPhoto,
    imageSlots,
    openReports,
  ] = await Promise.all([
    loadCityData(),
    store.listVotes().catch(() => []),
    store.listPhotos().catch(() => []),
    store.listContentImageSlots().catch(() => [] as string[]),
    store
      .listReports({ handled: false })
      .catch(() => [] as Awaited<ReturnType<typeof store.listReports>>),
  ]);
  const allPhotos = everyPhoto.filter((p) => p.status === "pending");

  const photoShare = photoShareByQuarter(
    allVotes,
    everyPhoto,
    streetStats.map((row) => row.street),
    QUARTERS,
  ).filter((row) => row.votes > 0);
  const realVotes = allVotes.filter((v) => !v.isDemo).length;
  const realVotesWithPhoto = photoShare.reduce((sum, row) => sum + row.withPhoto, 0);

  // The words the resident wrote with the vote the photo came with.
  const reasonByVote = new Map(allVotes.map((v) => [v.id, v.reason]));
  const streetNameById = new Map(streetStats.map((s) => [s.street.id, s.street.name]));
  const pendingPhotos = [...allPhotos]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((p) => ({
      id: p.id,
      streetId: p.streetId,
      streetName: streetNameById.get(p.streetId) ?? "רחוב לא ידוע",
      createdAt: p.createdAt,
      reason: (reasonByVote.get(p.voteId) ?? "").trim() || undefined,
    }));

  // Residents' opinions that a street is of a different kind, per street.
  const suggestionsByStreet = new Map<string, Map<string, number>>();
  for (const vote of allVotes) {
    if (!vote.typologySuggestion) continue;
    if (!suggestionsByStreet.has(vote.streetId)) {
      suggestionsByStreet.set(vote.streetId, new Map());
    }
    const counts = suggestionsByStreet.get(vote.streetId)!;
    counts.set(vote.typologySuggestion, (counts.get(vote.typologySuggestion) ?? 0) + 1);
  }
  const unverified = streetStats.filter((s) => !s.street.verified && s.votes > 0);
  const audits = await loadAuditOverview();

  return (
    <>
      <h1 className="mb-1 text-[24px] font-bold text-ink">לוח בקרה</h1>
      <p className="mb-5 text-[14px] text-ink-soft">
        אגף אדריכלות העיר, עיריית אשדוד.{" "}
        {role === "admin" ? "מחוברת כמנהלת." : "מחובר כצוות."}
      </p>

      <Section title="מצב כללי">
        <Card>
          <ul className="grid gap-1 text-[15px] text-ink">
            <li>
              קולות: {totals.votes.toLocaleString("he-IL")}
              {totals.demoVotes > 0 ? (
                <span className="text-ink-faint">
                  {" "}
                  — מתוכם {totals.demoVotes.toLocaleString("he-IL")} נתוני הדגמה
                </span>
              ) : null}
            </li>
            <li>רחובות עם קולות: {totals.streets}</li>
            <li>תמונות מאושרות: {totals.photos}</li>
            <li>תמונות שממתינות לאישור: {totals.photosPending}</li>
          </ul>
        </Card>
        {totals.orphanVotes > 0 ? (
          <p role="alert" className="mt-2 rounded-[12px] border border-warm bg-warm-soft px-3 py-2 text-[13px] text-ink">
            {totals.orphanVotes} קולות מפנים לרחוב שאינו ברשימת הרחובות. הם נספרים
            בסיכומים, אך לא יופיעו בטבלת הרחובות עד שהרחוב יתווסף.
          </p>
        ) : null}
        {dataError ? (
          <p role="alert" className="mt-2 rounded-[12px] border border-warm bg-warm-soft px-3 py-2 text-[13px] text-ink">
            תקלה בקריאה ממסד הנתונים: {dataError}
          </p>
        ) : null}
        {getStoreConfigError() ? (
          <p role="alert" className="mt-2 rounded-[12px] border border-warm bg-warm-soft px-3 py-2 text-[13px] text-ink">
            הגדרת Supabase שגויה: {getStoreConfigError()}
          </p>
        ) : null}
        <div className="mt-2">
          {storeIsDurable() ? (
            <p className="rounded-[12px] border border-line bg-accent-soft px-3 py-2 text-[13px] text-accent">
              הנתונים נשמרים במסד הנתונים (Supabase) ואינם נמחקים בפריסה מחדש.
            </p>
          ) : (
            <Notice>
              אחסון זמני: הנתונים נשמרים בקבצים מקומיים ועלולים להימחק בפריסה מחדש.
              LOCAL_STORE=1 מוגדר, ולכן האפליקציה אינה מחוברת ל-Supabase.
            </Notice>
          )}
        </div>
      </Section>

      {/*
        The queue is on the dashboard itself, not one screen away: a photo that
        waits is the one thing here that holds someone else up.
      */}
      <section className="mb-6">
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-[19px] font-semibold text-ink">תמונות לאישור</h2>
          {totals.photosPending > 0 ? (
            <span
              className="rounded-full bg-warm px-3 py-[2px] text-[14px] font-semibold text-white"
              aria-label={`${totals.photosPending} תמונות ממתינות לאישור`}
            >
              {totals.photosPending}
            </span>
          ) : null}
        </div>
        <p className="mb-3 text-[14px] text-ink-soft">
          תמונה של תושב מתפרסמת רק אחרי אישור. בדקו שאין בה פנים מזוהות או
          לוחיות רישוי, ושהיא אכן מצולמת ברחוב שצוין.
        </p>

        <PhotoModeration photos={pendingPhotos} />

        <p className="mt-2 text-[13px]">
          <Link href="/admin/photos" className="inline-link text-accent underline underline-offset-2">
            כל התמונות, כולל אלה שכבר הוכרעו
          </Link>
        </p>
      </section>

      {/*
        דיווחים אינם קולות, ולכן הם מדור נפרד ולא עוד מספר ב"מצב כללי":
        בקול אין מה לעשות, ובדיווח כן.
      */}
      <section className="mb-6">
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-[19px] font-semibold text-ink">דיווחים והצעות</h2>
          {openReports.length > 0 ? (
            <span
              className="rounded-full bg-warm px-3 py-[2px] text-[14px] font-semibold text-white"
              aria-label={`${openReports.length} דיווחים פתוחים`}
            >
              {openReports.length}
            </span>
          ) : null}
        </div>
        <p className="mb-2 text-[14px] text-ink-soft">
          שני המסלולים שבהם התושב חייב לצרף תמונה: דיווח על משהו שקרה ברחוב, והצעת
          רחוב שאינו ברשימה הרשמית.
        </p>
        <p className="text-[13px]">
          <Link
            href="/admin/reports"
            className="inline-link text-accent underline underline-offset-2"
          >
            {openReports.length > 0
              ? `${openReports.length} פתוחים — לטיפול`
              : "אין דיווחים פתוחים. לכל הדיווחים"}
          </Link>
        </p>
      </section>

      <Section
        title="שיעור הקולות עם תמונה"
        note="התמונה בדירוג היא רשות, ולכן היא אינה מתחלקת שווה בין הרובעים. המספר הזה מראה איפה הפער, כדי שההחלטות יישענו על הקולות ולא על התמונות. נתוני הדגמה אינם נספרים כאן."
      >
        {photoShare.length === 0 ? (
          <Card>
            <p className="text-[14px] text-ink-soft">אין עדיין קולות של תושבים.</p>
          </Card>
        ) : (
          <div className="card divide-y divide-line">
            <div className="p-3">
              <p className="text-[15px] font-medium text-ink">
                בכל העיר: {realVotesWithPhoto} מתוך {realVotes}{" "}
                {realVotes > 0
                  ? `(${Math.round((realVotesWithPhoto / realVotes) * 100)}%)`
                  : ""}
              </p>
            </div>
            {photoShare.map((row) => (
              <div key={row.quarterId ?? "none"} className="p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[15px] text-ink">{row.quarterName}</p>
                  <p className="text-[15px] font-medium text-ink">
                    {row.share === null ? "—" : `${Math.round(row.share * 100)}%`}
                  </p>
                </div>
                <p className="text-[13px] text-ink-faint">
                  {row.withPhoto} מתוך {votesLabel(row.votes)} עם תמונה
                </p>
                {/* פס פשוט, כדי שהפער בין רובעים ייראה בעין ולא ייקרא שורה-שורה. */}
                <div
                  className="mt-1 h-2 overflow-hidden rounded-full bg-line"
                  role="presentation"
                >
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${Math.round((row.share ?? 0) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="בדיקה אוטומטית"
        note="המערכת מודדת כל רחוב מול היעד לסוג הרחוב, משווה לדירוג התושבים ומנסחת טיוטה. הצוות רק מאשר."
      >
        <div className="card grid gap-3 p-4">
          {audits.error ? (
            <p className="text-[14px] text-ink">טעינת הבדיקה נכשלה: {audits.error}</p>
          ) : (
            <p className="text-[14px] text-ink">
              {audits.latest.length === 0
                ? "עוד לא הורצה בדיקה."
                : `נבדקו ${audits.latest.length} מתוך ${audits.streets.length} רחובות · ` +
                  `${audits.latest.filter((a) => a.state === "draft").length} טיוטות ממתינות לאישור · ` +
                  `${audits.latest.filter((a) => a.state === "blocked").length} חסומים בגלל נתונים חסרים`}
            </p>
          )}
          <AuditRunButton label="הרצת בדיקה לכל הרחובות" />
          <Link
            href="/admin/audit"
            className="inline-flex min-h-11 items-center text-[15px] font-medium text-accent underline underline-offset-2"
          >
            לתוצאות, לטבלת הקריטריונים ולפערים בנתונים
          </Link>
        </div>
      </Section>

      {role === "admin" ? (
        <Section
          title="לוגו העירייה"
          note="המסגרת עצמה היא ההעלאה. הלוגו מופיע בראש כל מסך."
        >
          <ImageFrame
            slot={imageSlot("logo")}
            alt="לוגו עיריית אשדוד"
            hasImage={imageSlots.includes(imageSlot("logo"))}
            canEdit
            ratio="13 / 8"
            emptyLabel="אין עדיין לוגו"
            className="max-w-[240px]"
            fit="contain"
          />
        </Section>
      ) : null}

      {role === "admin" ? (
        <Section
          title="העלאת תמונה"
          note="התמונה מתפרסמת מיד, בלי תור אישור. שמור למנהלת."
        >
          <AdminUpload
            streets={streetStats
              .map((row) => ({ id: row.street.id, name: row.street.name }))
              .sort((a, b) => a.name.localeCompare(b.name, "he"))}
          />
        </Section>
      ) : null}

      <Section
        title="שיוך רחובות"
        note="רובע וסוג רחוב אינם מופיעים ברישום הארצי, ולכן הם נקבעים כאן. התושבים רואים אותם לקריאה בלבד."
      >
        <StreetAssignment
          quarters={QUARTERS.map((q) => ({ id: q.id, name: q.name }))}
          typologies={TYPOLOGIES.map((t) => ({ key: t.key, label: t.label }))}
          rows={streetStats.map((row) => ({
            id: row.street.id,
            name: row.street.name,
            code: row.street.code,
            quarterId: row.street.quarterId,
            typology: row.street.typology,
            votes: row.votes,
            suggestions: [...(suggestionsByStreet.get(row.street.id) ?? new Map()).entries()].map(
              ([key, count]) => ({ label: TYPOLOGY_MAP[key]?.label ?? key, count }),
            ),
          }))}
        />
      </Section>

      <Section
        title="נושאי שמות שדורשים הכרעה"
        note="בכל אחד מאלה, מילון הנושאים שנמסר סותר את רשימת הרחובות. עד להכרעה לא מוצג 'הידעת' ברובעים האלה."
      >
        <div className="card divide-y divide-line">
          {contestedThemes().map(({ quarterId, entry }) => (
            <div key={quarterId} className="p-3">
              <p className="text-[15px] font-medium text-ink">
                {QUARTER_MAP[quarterId]?.name ?? quarterId}
              </p>
              <p className="text-[14px] text-ink-soft">
                לפי מילון הנושאים: {entry.theme}
              </p>
              <p className="text-[14px] text-ink-soft">
                לפי רחובות הרובע ברשימה: {entry.observed}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="סטטוסים" note="העדכון עצמו נעשה בכרטיס הרחוב.">
        <div className="card divide-y divide-line">
          {streetStats
            .filter((s) => s.votes > 0)
            .sort((a, b) => b.votes - a.votes)
            .map((row) => (
              <div key={row.street.id} className="flex items-center justify-between gap-2 p-3">
                <Link href={`/street/${row.street.id}`} className="flex-1 text-[15px] text-ink">
                  {row.street.name}
                  <span className="block text-[12px] text-ink-faint">
                    {row.quarterName} · {votesLabel(row.votes)}
                  </span>
                </Link>
                <StatusBadge status={row.status?.status ?? null} />
              </div>
            ))}
        </div>
        <p className="mt-2 text-[13px] text-ink-faint">
          סטטוסים אפשריים: {STATUSES.map((s) => s.label).join(" · ")}
        </p>
      </Section>

      {unverified.length > 0 ? (
        <Section title="רחובות לאימות מול GIS" note="רחובות שתושבים הוסיפו או שטרם אומתו.">
          <Card>
            <ul className="grid gap-1 text-[15px] text-ink">
              {unverified.map((row) => (
                <li key={row.street.id}>
                  {row.street.name} — {row.quarterName}
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      ) : null}

      {/*
        שם הפורמט לבדו ("CSV") אינו אומר למי שאינו מתכנת מה ייפתח אצלו.
        קודם מה זה בעברית, ואחר כך הפורמט בקטן בסוגריים — מי שיודע מה
        הוא מחפש עדיין מוצא אותו.
      */}
      <Section title="ייצוא נתונים">
        <div className="grid gap-2">
          <a
            href="/api/export/streets.csv"
            className="pressable rounded-[12px] border border-line bg-surface px-4 py-3 text-[15px] text-ink"
          >
            <span className="block font-medium">טבלה לאקסל</span>
            <span className="block text-[12px] text-ink-faint">
              כל הרחובות, הקולות והציונים, שורה לכל רחוב. נפתח באקסל, בגוגל
              שיטס ובנאמברס (CSV)
            </span>
          </a>
          <a
            href="/api/export/streets.geojson"
            className="pressable rounded-[12px] border border-line bg-surface px-4 py-3 text-[15px] text-ink"
          >
            <span className="block font-medium">שכבת מפה למערכת ה-GIS</span>
            <span className="block text-[12px] text-ink-faint">
              אותם נתונים עם המיקום של כל רחוב. נפתח ב-QGIS, ב-ArcGIS ובמערכות
              מפות אחרות (GeoJSON)
            </span>
          </a>
        </div>
      </Section>

      <Section title="נתוני הדגמה">
        <DemoControls />
      </Section>
    </>
  );
}
