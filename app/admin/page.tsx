import Link from "next/link";
import { QUARTERS, STATUSES, TYPOLOGIES, TYPOLOGY_MAP } from "@/lib/city";
import { getStore, getStoreConfigError, storeIsDurable } from "@/lib/store";
import { loadCityData } from "@/lib/data";
import { votesLabel } from "@/lib/hebrew";
import { getRole, staffCodeConfigured } from "@/lib/session";
import { Card, Notice, Section, StatusBadge } from "@/components/ui";
import DemoControls from "@/components/DemoControls";
import PhotoModeration from "@/components/PhotoModeration";
import { QUARTER_MAP } from "@/lib/city";
import { contestedThemes } from "@/lib/themes";
import AdminUpload from "@/components/AdminUpload";
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
  const role = await getRole();
  const staff = role !== "resident";

  if (!staff) {
    return (
      <>
        <h1 className="mb-1 text-[24px] font-bold text-ink">כניסת צוות</h1>
        <p className="mb-4 text-[14px] text-ink-soft">
          לוח הבקרה של אגף אדריכלות העיר. הכניסה בקוד צוות או בקוד מנהלת.
        </p>
        {error ? (
          <p role="alert" className="mb-3 rounded-[12px] border border-warm bg-warm-soft px-3 py-2 text-[14px]">
            הקוד שגוי.
          </p>
        ) : null}
        {!staffCodeConfigured() ? (
          <Notice>
            לא הוגדר קוד בשרת. יש להגדיר את משתנה הסביבה STAFF_CODE, ואת
            ADMIN_CODE לכניסת המנהלת, לפני השימוש.
          </Notice>
        ) : (
          <form action="/api/staff/login" method="post" className="grid gap-2">
            <label htmlFor="code" className="text-[15px] text-ink">
              קוד כניסה
            </label>
            <input
              id="code"
              name="code"
              type="password"
              required
              autoComplete="current-password"
              className="rounded-[12px] border border-line bg-surface px-3 py-3 text-[16px]"
            />
            <button
              type="submit"
              className="rounded-[14px] bg-accent px-5 py-3 text-[16px] font-medium text-white"
            >
              כניסה
            </button>
          </form>
        )}
      </>
    );
  }

  const store = getStore();
  const [{ streetStats, totals, error: dataError }, allVotes, allPhotos, imageSlots] =
    await Promise.all([
      loadCityData(),
      store.listVotes().catch(() => []),
      store.listPhotos({ status: "pending" }).catch(() => []),
      store.listContentImageSlots().catch(() => [] as string[]),
    ]);

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
            <li>קולות: {totals.votes}</li>
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
              יש להגדיר SUPABASE_URL ו־SUPABASE_SERVICE_ROLE_KEY.
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
            ratio="3 / 1"
            emptyLabel="אין עדיין לוגו"
            className="max-w-[240px]"
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

      <Section title="ייצוא">
        <div className="flex gap-2">
          <a
            href="/api/export/streets.csv"
            className="flex-1 rounded-[12px] border border-line bg-surface px-3 py-3 text-center text-[15px] text-ink"
          >
            CSV
          </a>
          <a
            href="/api/export/streets.geojson"
            className="flex-1 rounded-[12px] border border-line bg-surface px-3 py-3 text-center text-[15px] text-ink"
          >
            GeoJSON
          </a>
        </div>
      </Section>

      <Section title="נתוני הדגמה">
        <DemoControls />
      </Section>
    </>
  );
}
