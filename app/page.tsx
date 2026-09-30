import Link from "next/link";
import { CITY, PRINCIPLES, STATUSES } from "@/lib/city";
import { loadCityData } from "@/lib/data";
import { topStreets } from "@/lib/stats";
import { scoreLabel } from "@/lib/hebrew";
import {
  ButtonLink,
  Card,
  Counter,
  DemoBanner,
  Notice,
  Section,
  StatusBadge,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { streetStats, totals, error } = await loadCityData();
  const leaders = topStreets(streetStats, 5);

  // The municipal feed: every street the staff has given a status, newest first.
  const updates = streetStats
    .filter((row) => row.status !== null)
    .sort((a, b) => (b.status?.updatedAt ?? "").localeCompare(a.status?.updatedAt ?? ""))
    .slice(0, 8);

  return (
    <>
      {error ? (
        <p role="alert" className="mb-4 rounded-[12px] border border-warm bg-warm-soft px-3 py-2 text-[14px] text-ink">
          יש תקלה בחיבור למסד הנתונים, ולכן המספרים ריקים. פרטים בעמוד{" "}
          <a href="/api/health" className="underline">
            בדיקת מצב המערכת
          </a>
          .
        </p>
      ) : null}
      <DemoBanner demoVotes={totals.demoVotes} totalVotes={totals.votes} />

      <section className="mb-6">
        <h1 className="mb-2 text-[26px] font-bold leading-tight text-ink">
          {CITY.homeQuestion}
        </h1>
        <p className="mb-4 text-[15px] text-ink-soft">{CITY.tagline}</p>
        <div className="grid gap-2">
          <ButtonLink href="/choose">לבחור רחוב ולדרג</ButtonLink>
          <ButtonLink href="/learn" variant="ghost">
            ללמוד מה הופך רחוב לטוב
          </ButtonLink>
        </div>
      </section>

      <Section title="שלושה עקרונות">
        <div className="grid gap-2">
          {PRINCIPLES.map((principle) => (
            <Card key={principle.key}>
              <p className="text-[16px] font-semibold text-ink">{principle.title}</p>
              <p className="text-[14px] text-ink-soft">{principle.text}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section
        title="מה קורה עכשיו"
        note="כל המספרים מאז פתיחת האפליקציה, ומתעדכנים מיד."
      >
        <div className="flex gap-2">
          <Counter value={totals.votes} label="קולות" note="דירוגים שנשלחו" />
          <Counter value={totals.streets} label="רחובות" note="שקיבלו דירוג" />
          <Counter
            value={totals.photos}
            label="תמונות"
            note={
              totals.photosPending > 0
                ? `מאושרות · ${totals.photosPending} ממתינות`
                : "מאושרות ומוצגות"
            }
          />
        </div>
      </Section>

      <Section
        title="5 המובילים"
        note="מדורגים לפי מספר הקולות, ובשוויון לפי הציון הממוצע."
      >
        {leaders.length === 0 ? (
          <Card>
            <p className="text-[15px] text-ink-soft">
              עדיין אין קולות. הרחוב הראשון שתבחרו יופיע כאן.
            </p>
          </Card>
        ) : (
          <ol className="grid gap-2">
            {leaders.map((row, index) => (
              <li key={row.street.id}>
                <Link
                  href={`/street/${row.street.id}`}
                  className="card flex items-stretch gap-3 overflow-hidden p-0"
                >
                  {/*
                    התמונה נושאת את שם הרחוב עליה, על גרדיאנט שקוף שנולד
                    מהמסגרת עצמה. השם הוא הדבר החשוב בשורה, ולכן הוא
                    מודגש ויושב על הכהה ביותר בגרדיאנט.
                  */}
                  <span className="relative h-[88px] w-[112px] shrink-0 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        row.latestPhotoId
                          ? `/api/photos/${row.latestPhotoId}`
                          : "/street-placeholder.svg"
                      }
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <span className="photo-scrim" aria-hidden="true" />
                    <span className="absolute inset-x-0 bottom-0 px-2 pb-1.5 text-[13px] font-semibold leading-tight text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.75)]">
                      {row.street.name}
                    </span>
                  </span>

                  <span className="flex flex-1 items-center gap-3 py-3 pl-3">
                    <span className="w-7 shrink-0 text-[18px] font-bold tabular-nums text-accent">
                      {index + 1}.
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[16px] font-semibold text-ink">
                        {row.street.name}
                      </span>
                      <span className="block text-[13px] text-ink-faint">
                        {row.quarterName}
                      </span>
                      <span className="mt-0.5 block text-[13px] text-ink-soft">
                        <span className="font-semibold tabular-nums text-ink">
                          {row.votes.toLocaleString("he-IL")}
                        </span>{" "}
                        {row.votes === 1 ? "קול" : "קולות"}
                      </span>
                    </span>
                    <span className="shrink-0 text-center">
                      <span className="block text-[19px] font-bold tabular-nums text-ink">
                        {scoreLabel(row.avgScore)}
                      </span>
                      <span className="block text-[11px] text-ink-faint">ציון ממוצע</span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title="מה העירייה עושה" note="עדכוני הסטטוס האחרונים, מהחדש לישן.">
        {updates.length === 0 ? (
          <Card>
            <p className="mb-2 text-[15px] text-ink">
              עדיין אין עדכונים עירוניים להצגה.
            </p>
            <p className="text-[14px] text-ink-soft">
              כך זה עובד: אתם בוחרים רחוב ומדרגים אותו. צוות אדריכלות העיר עובר על
              הרחובות שקיבלו קולות, קובע לכל אחד סטטוס — התקבל, בבדיקה, מתוכנן,
              בביצוע, הושלם — ומוסיף הערה לציבור. כל עדכון כזה יופיע כאן, ובכרטיס
              הרחוב עצמו.
            </p>
          </Card>
        ) : (
          <>
            <ul className="grid gap-2">
              {updates.map((row) => (
                <li key={row.street.id}>
                  <Link href={`/street/${row.street.id}`} className="card block p-3">
                    <span className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-[16px] font-medium text-ink">
                        {row.street.name}
                      </span>
                      <StatusBadge status={row.status?.status ?? null} />
                    </span>
                    {row.status?.publicNote ? (
                      <span className="block text-[14px] text-ink-soft">
                        {row.status.publicNote}
                      </span>
                    ) : null}
                    <span className="mt-1 block text-[12px] text-ink-faint">
                      {row.quarterName} ·{" "}
                      {row.status
                        ? new Date(row.status.updatedAt).toLocaleDateString("he-IL", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })
                        : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] text-ink-faint">
              {STATUSES.map((s) => `${s.label} ${totals.byStatus[s.key]}`).join(" · ")}
            </p>
          </>
        )}
      </Section>

      <Notice>
        גבולות הרובעים במפה עדיין אינם שכבת ה-GIS העירונית. רשימת הרחובות היא
        המרשם הארצי.
      </Notice>
    </>
  );
}
