import Link from "next/link";
import { CITY, PRINCIPLES, STATUSES } from "@/lib/city";
import { loadCityData } from "@/lib/data";
import { topStreets } from "@/lib/stats";
import { votesLabel } from "@/lib/hebrew";
import { ButtonLink, Card, Counter, Notice, Section, StatusBadge } from "@/components/ui";

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

      <Section title="מה קורה עכשיו">
        <div className="flex gap-2">
          <Counter value={totals.votes} label="קולות" />
          <Counter value={totals.streets} label="רחובות" />
          <Counter
            value={totals.photos}
            label="תמונות"
            note={
              totals.photosPending > 0
                ? `${totals.photosPending} ממתינות לאישור`
                : undefined
            }
          />
        </div>
      </Section>

      <Section title="חמשת המובילים" note="לפי מספר הקולות, ואז לפי הציון הממוצע.">
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
                  {/* Decorative: the street name beside it carries the meaning. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      row.latestPhotoId
                        ? `/api/photos/${row.latestPhotoId}`
                        : "/street-placeholder.svg"
                    }
                    alt=""
                    className="h-[88px] w-[112px] shrink-0 object-cover"
                  />
                  <span className="flex flex-1 items-center gap-3 py-3 pl-3">
                    <span className="w-6 text-[18px] font-bold tabular-nums text-accent">
                      {index + 1}
                    </span>
                    <span className="flex-1">
                      <span className="block text-[16px] font-medium text-ink">
                        {row.street.name}
                      </span>
                      <span className="block text-[13px] text-ink-faint">
                        {row.quarterName} · {votesLabel(row.votes)}
                      </span>
                    </span>
                    <span className="text-[17px] font-semibold tabular-nums text-ink">
                      {row.avgScore === null ? "—" : row.avgScore.toFixed(1)}
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
        רשימת הרחובות והגבולות במפה הם נתוני הדגמה עד לחיבור שכבות ה־GIS העירוניות.
      </Notice>
    </>
  );
}
