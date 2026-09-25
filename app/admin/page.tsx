import Link from "next/link";
import { STATUSES } from "@/lib/city";
import { getStore, getStoreConfigError, storeIsDurable } from "@/lib/store";
import { loadCityData } from "@/lib/data";
import { isStaff, staffCodeConfigured } from "@/lib/session";
import { Card, Notice, Section, StatusBadge } from "@/components/ui";
import PhotoModeration from "@/components/PhotoModeration";
import DemoControls from "@/components/DemoControls";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const staff = await isStaff();

  if (!staff) {
    return (
      <>
        <h1 className="mb-1 text-[24px] font-bold text-ink">כניסת צוות</h1>
        <p className="mb-4 text-[14px] text-ink-soft">
          לוח הבקרה של אגף אדריכלות העיר. הכניסה בקוד צוות.
        </p>
        {error ? (
          <p role="alert" className="mb-3 rounded-[12px] border border-warm bg-warm-soft px-3 py-2 text-[14px]">
            הקוד שגוי.
          </p>
        ) : null}
        {!staffCodeConfigured() ? (
          <Notice>
            לא הוגדר קוד צוות בשרת. יש להגדיר את משתנה הסביבה STAFF_CODE לפני השימוש.
          </Notice>
        ) : (
          <form action="/api/staff/login" method="post" className="grid gap-2">
            <label htmlFor="code" className="text-[15px] text-ink">
              קוד צוות
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
  const [{ streetStats, totals, error: dataError }, pendingPhotos] = await Promise.all([
    loadCityData(),
    store.listPhotos({ status: "pending" }).catch(() => []),
  ]);
  const streetName = new Map(streetStats.map((s) => [s.street.id, s.street.name]));
  const unverified = streetStats.filter((s) => !s.street.verified && s.votes > 0);

  return (
    <>
      <h1 className="mb-1 text-[24px] font-bold text-ink">לוח בקרה</h1>
      <p className="mb-5 text-[14px] text-ink-soft">אגף אדריכלות העיר, עיריית אשדוד.</p>

      <Section title="מצב כללי">
        <Card>
          <ul className="grid gap-1 text-[15px] text-ink">
            <li>קולות: {totals.votes}</li>
            <li>רחובות עם קולות: {totals.streets}</li>
            <li>תמונות מאושרות: {totals.photos}</li>
            <li>תמונות שממתינות לאישור: {pendingPhotos.length}</li>
          </ul>
        </Card>
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

      <Section title="אישור תמונות" note="תמונה מתפרסמת רק אחרי אישור. בדקו פנים ולוחיות רישוי.">
        <PhotoModeration
          photos={pendingPhotos.map((p) => ({
            id: p.id,
            streetId: p.streetId,
            streetName: streetName.get(p.streetId) ?? p.streetId,
          }))}
        />
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
                    {row.quarterName} · {row.votes} קולות
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
