import Link from "next/link";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import {
  CITY,
  CRITERIA,
  CRITERIA_FAMILIES,
  EXAMPLES,
  PRINCIPLES,
  QUARTERS,
  QUESTIONS,
  STATUSES,
} from "@/lib/city";
import { loadCityData } from "@/lib/data";
import { topStreets } from "@/lib/stats";
import { scoreLabel } from "@/lib/hebrew";
import { StreetTile } from "@/components/StreetTile";
import HomeHero from "@/components/HomeHero";
import Rich from "@/components/Rich";
import { GLYPHS, type GlyphKey } from "@/components/glyphs";
import {
  Card,
  Counter,
  DemoBanner,
  Section,
  StatusBadge,
} from "@/components/ui";

export const dynamic = "force-dynamic";

/*
 * חתך הרחוב: רחוב לדוגמה שהחתך שלו נמדד היטב (רוגוזין, 35 מ' מקיר לקיר), ומספר
 * הרחובות שיש להם נתוני חתך שמורים (scripts/fetch-sections.mjs).
 */
const SECTION_EXAMPLE_STREET = "16530b32-1c94-47c8-843f-165e27cb64d9";
function sectionFilesCount(): number {
  try {
    return readdirSync(join(process.cwd(), "public/geo/sections")).filter((f) => f.endsWith(".json"))
      .length;
  } catch {
    return 0;
  }
}

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

      <HomeHero
        eyebrow={`${CITY.name} · ${CITY.nameEn.toUpperCase()} · אגף אדריכלות העיר`}
        title={"רחוב טוב בנוי מ**ארבע שכבות**."}
        sub={`**${CRITERIA.length}** קריטריונים, ב**שלד**, ב**חתך**, ב**דופן** וב**מרקם**.\nכל רחוב באשדוד נבדק בהם.`}
        question={CITY.homeQuestion}
        layers={CRITERIA_FAMILIES.map((family) => {
          const [q, ...rest] = family.text.split("?");
          return {
            key: family.key,
            title: family.title,
            question: q + "?",
            answer: rest.join("?").trim(),
            count: family.criteria.length,
            criteria: family.criteria.map((c) => c.name),
          };
        })}
      />

      <section className="vision mb-8" aria-labelledby="vision-title">
        <h2 id="vision-title" className="section-title">החזון, המטרה, הכלי והתהליך</h2>
        <div className="vision-grid">
          <div className="vision-cell tone-insight">
            <p className="tone-label">החזון</p>
            <Rich as="p" className="vision-lead">{"אשדוד של **רחובות שרוצים ללכת בהם**."}</Rich>
            <p className="vision-text">רחוב שהוא מקום, לא רק מעבר.</p>
          </div>
          <div className="vision-cell tone-problem">
            <p className="tone-label">המטרה</p>
            <Rich as="p" className="vision-lead">{"למדוד רחוב ב**הליכה**, לא רק ב**תנועה**."}</Rich>
            <p className="vision-text">צל, חזית פעילה וצמתים קרובים לא נספרים בספירת רכבים.</p>
          </div>
          <div className="vision-cell tone-solution">
            <p className="tone-label">הכלי</p>
            <Rich as="p" className="vision-lead">{`**מדידה עירונית** ו**קול התושבים** יחד.`}</Rich>
            <p className="vision-text">{`${QUESTIONS.length} שאלות לתושבים, ${CRITERIA.length} קריטריונים מקצועיים, מול רחובות מאותו סוג.`}</p>
          </div>
          <div className="vision-cell vision-process">
            <p className="tone-label">התהליך</p>
            <ol className="process">
              <li><span className="num">1</span>אתם בוחרים רחוב ומדרגים.</li>
              <li><span className="num">2</span>הצוות בודק מול הנתונים.</li>
              <li><span className="num">3</span>לרחוב נקבע סטטוס עירוני.</li>
              <li><span className="num">4</span>הסטטוס מופיע במפה ובכרטיס.</li>
            </ol>
          </div>
        </div>
      </section>

      <div className="home-pair mb-8">
        <section aria-labelledby="here-title">
          <h2 id="here-title" className="section-title">מה יש כאן</h2>
          <nav className="here-list" aria-label="מפת התוכן">
            {(
              [
                { href: "/choose", glyph: "rate", key: QUESTIONS.length, title: "לבחור ולדרג", line: "שאלות לכל רחוב" },
                { href: "/map", glyph: "map", key: QUARTERS.length, title: "מפה", line: "רובעים, צבועים לפי ציון" },
                { href: "/streets", glyph: "table", key: totals.streetsKnown, title: "טבלה", line: "רחובות, למיון וייצוא" },
                { href: `/street/${SECTION_EXAMPLE_STREET}`, glyph: "section", key: Math.max(1, sectionFilesCount()), title: "חתך הרחוב", line: "רוחב מול גובה" },
                { href: "/examples", glyph: "examples", key: EXAMPLES.length, title: "דוגמאות", line: "מהעיר ומהעולם" },
                { href: "/learn", glyph: "learn", key: CRITERIA.length, title: "ללמוד", line: "קריטריונים לרחוב טוב" },
                { href: "/suggest", glyph: "suggest", key: 1, title: "להציע רחוב", line: "רחוב שחסר ברשימה" },
              ] as { href: string; glyph: GlyphKey; key: number; title: string; line: string }[]
            ).map((item, i) => (
              <Link key={item.href} href={item.href} className="here-item rise" style={{ "--i": i } as React.CSSProperties}>
                <span className="here-glyph">{GLYPHS[item.glyph]}</span>
                <span className="here-title">{item.title}</span>
                <span className="here-key num">{item.key.toLocaleString("he-IL")}</span>
                <span className="here-line">{item.line}</span>
              </Link>
            ))}
          </nav>
        </section>

        <section aria-labelledby="kui-title">
          <h2 id="kui-title" className="section-title">ידע, הבנה, יישום</h2>
          <ol className="kui-list">
            {PRINCIPLES.map((principle, i) => (
              <li key={principle.key} className="kui-item">
                <span className="kui-glyph">{GLYPHS[principle.key as GlyphKey]}</span>
                <p className="eyebrow">{String(i + 1).padStart(2, "0")}</p>
                <p className="kui-title">{principle.title}</p>
                <p className="kui-text">{principle.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <Section
        title="מה קורה עכשיו"
        note="כל המספרים מאז פתיחת האפליקציה, ומתעדכנים מיד."
      >
        <div className="flex gap-2">
          <Counter value={totals.votes} label="קולות" note="דירוגים שנשלחו" />
          <Counter
            value={totals.streets}
            label="רחובות"
            note={`דורגו, מתוך ${totals.streetsKnown}`}
          />
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
        {/*
          שלושת המספרים אינם מאותו סוג, וזה נראה כמו סתירה כשלא אומרים
          את זה: חלק מהתמונות צולמו מכרטיס הרחוב בלי דירוג, ויש יותר
          רחובות במערכת מרחובות שדורגו.
        */}
        <p className="mt-2 text-[13px] text-ink-faint">
          {totals.photos > totals.photoVotes
            ? `מתוך ${totals.photos} התמונות, ${totals.photoVotes} צורפו לקול ו-${totals.photos - totals.photoVotes} צולמו בלי דירוג. `
            : ""}
          {totals.streetsKnown > totals.streets
            ? `${totals.streetsKnown} רחובות כבר במערכת, ${totals.streets} מהם קיבלו דירוג. הבדיקה האוטומטית של האגף עוברת על כולם.`
            : ""}
        </p>
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
                  <StreetTile
                    className="h-[88px] w-[112px] shrink-0"
                    name={row.street.name}
                    quarterName={row.quarterName}
                    avgScore={row.avgScore}
                    photoId={row.latestPhotoId}
                  />

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
                      <span className="block text-[11px] text-ink-faint">ציון מ-10</span>
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

      <footer className="sources">
        <p className="sources-title">מקורות ואימות</p>
        <p>רשימת הרחובות לבחירה: המרשם הארצי של רחובות (data.gov.il), כולל שמות מקובלים.</p>
        <p>קווי הרחובות, הרובע של כל קטע וסוג הרחוב המוערך: שכבת הרחובות של עיריית אשדוד (2,991 קטעים, נובמבר 2026).</p>
        <p>גבולות הרובעים: 19 פוליגונים. חסרים רובע ז׳ ורובע י״ד, ולכן הם מופיעים בדירוג בלבד.</p>
        <p>שבילי אופניים: שכבת העירייה. חתך הרחוב: OpenStreetMap.</p>
        <p>
          השראה: אלן ג׳ייקובס (Allan B. Jacobs), <i>Great Streets</i>, MIT Press, 1993.
          חתכים ותוכניות של רחובות באותו קנה מידה, כדי שאפשר יהיה להשוות ביניהם.
        </p>
      </footer>
    </>
  );
}
