import Link from "next/link";
import { CITY, PRINCIPLES, STATUSES } from "@/lib/city";
import { loadCityData } from "@/lib/data";
import { topStreets } from "@/lib/stats";
import { ButtonLink, Card, Counter, Notice, Section, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { streetStats, totals, error } = await loadCityData();
  const leaders = topStreets(streetStats, 5);

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
          <Counter value={totals.photos} label="תמונות" />
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
                <Link href={`/street/${row.street.id}`} className="card flex items-center gap-3 p-3">
                  <span className="w-6 text-[18px] font-bold tabular-nums text-accent">
                    {index + 1}
                  </span>
                  <span className="flex-1">
                    <span className="block text-[16px] font-medium text-ink">
                      {row.street.name}
                    </span>
                    <span className="block text-[13px] text-ink-faint">
                      {row.quarterName} · {row.votes} קולות
                    </span>
                  </span>
                  <span className="text-[17px] font-semibold tabular-nums text-ink">
                    {row.avgScore === null ? "—" : row.avgScore.toFixed(1)}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title="מה העירייה עושה" note="סיכום הסטטוסים של הרחובות שהתקבלו עליהם קולות.">
        <Card>
          <ul className="grid gap-2">
            {STATUSES.map((status) => (
              <li key={status.key} className="flex items-center justify-between">
                <StatusBadge status={status.key} />
                <span className="text-[16px] font-semibold tabular-nums text-ink">
                  {totals.byStatus[status.key]}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </Section>

      <Notice>
        רשימת הרחובות והגבולות במפה הם נתוני הדגמה עד לחיבור שכבות ה־GIS העירוניות.
      </Notice>
    </>
  );
}
