import Link from "next/link";
import {
  CRITERIA_FAMILIES,
  CRITERION_MAP,
  EXAMPLES,
  FAMILY_MAP,
  GIS_METRICS,
  QUESTIONS,
  QUESTION_MAP,
  TYPOLOGIES,
  criteriaForQuestion,
} from "@/lib/city";
import type { Criterion, CriterionKey, QuestionKey } from "@/lib/city";
import { ButtonLink, Card, Notice, Section } from "@/components/ui";

export const metadata = { title: "ללמוד — הרחובות הטובים של אשדוד" };

/** How many library examples name this criterion. Zero means no link is shown. */
const EXAMPLE_COUNT = new Map<CriterionKey, number>();
for (const example of EXAMPLES) {
  for (const key of example.criterionKeys) {
    EXAMPLE_COUNT.set(key, (EXAMPLE_COUNT.get(key) ?? 0) + 1);
  }
}

function Source({ criterion }: { criterion: Criterion }) {
  if (criterion.link.kind === "question") {
    const question = QUESTION_MAP[criterion.link.questionKey];
    return (
      <p className="text-[13px] text-ink-soft">
        נמדד בשאלה שלכם:{" "}
        <Link href="/choose" className="inline-link underline underline-offset-2 text-accent">
          {question.label}
        </Link>
      </p>
    );
  }
  if (criterion.link.kind === "gis") {
    return (
      <p className="text-[13px] text-ink-soft">
        נמדד בנתוני העירייה: {GIS_METRICS[criterion.link.metric].label}
      </p>
    );
  }
  return (
    <p className="text-[13px] text-warm">טרם שויך מקור מדידה. {criterion.link.note}</p>
  );
}

function CriterionRow({
  criterion,
  highlighted,
}: {
  criterion: Criterion;
  highlighted: boolean;
}) {
  const examples = EXAMPLE_COUNT.get(criterion.key) ?? 0;
  return (
    <li
      id={`criterion-${criterion.key}`}
      className={`border-t border-line px-3 py-3 ${
        highlighted ? "bg-accent-soft" : ""
      }`}
    >
      <p className="text-[15px] font-medium text-ink">{criterion.name}</p>
      <p className="mb-1 text-[14px] text-ink-soft">{criterion.text}</p>
      <Source criterion={criterion} />
      {examples > 0 ? (
        <Link
          href={`/examples?criterion=${criterion.key}`}
          className="mt-1 inline-block text-[13px] text-accent underline underline-offset-2"
        >
          ראו דוגמאות ({examples})
        </Link>
      ) : (
        <p className="mt-1 text-[13px] text-ink-faint">
          אין עדיין דוגמה בספרייה לקריטריון הזה.
        </p>
      )}
    </li>
  );
}

export default async function LearnPage({
  searchParams,
}: {
  searchParams: Promise<{ criterion?: string; question?: string }>;
}) {
  const params = await searchParams;

  const criterion =
    params.criterion && params.criterion in CRITERION_MAP
      ? CRITERION_MAP[params.criterion as CriterionKey]
      : null;
  const question =
    params.question && params.question in QUESTION_MAP
      ? QUESTION_MAP[params.question as QuestionKey]
      : null;

  // Which criteria the visitor arrived for, and therefore which families open.
  const highlighted = new Set<CriterionKey>(
    criterion
      ? [criterion.key]
      : question
        ? criteriaForQuestion(question.key).map((c) => c.key)
        : [],
  );
  const openFamilies = new Set(
    [...highlighted].map((key) => CRITERION_MAP[key].familyKey),
  );

  return (
    <>
      {criterion || question ? (
        <nav aria-label="מסלול ניווט" className="mb-2 text-[13px] text-ink-soft">
          <Link href="/learn" className="inline-link underline underline-offset-2">
            ללמוד
          </Link>
          {criterion ? (
            <>
              <span aria-hidden="true"> › </span>
              {FAMILY_MAP[criterion.familyKey].title}
              <span aria-hidden="true"> › </span>
              <span className="text-ink">{criterion.name}</span>
            </>
          ) : (
            <>
              <span aria-hidden="true"> › </span>
              <span className="text-ink">השאלה &quot;{question?.label}&quot;</span>
            </>
          )}
        </nav>
      ) : null}

      <h1 className="mb-1 text-[24px] font-bold text-ink">ללמוד</h1>
      <p className="mb-5 text-[15px] text-ink-soft">
        ארבע משפחות, ובכל אחת שלושה קריטריונים. לכל קריטריון כתוב מאיפה מגיע הערך
        שלו: משאלה שאתם עונים עליה, או ממדידה בנתוני העירייה.
      </p>

      <Section
        title="ארבע משפחות, שנים־עשר קריטריונים"
        note="הקישו על משפחה כדי לפתוח את הקריטריונים שלה."
      >
        <div className="grid gap-3">
          {CRITERIA_FAMILIES.map((family) => (
            <details
              key={family.key}
              open={openFamilies.has(family.key)}
              className="card overflow-hidden"
            >
              <summary className="cursor-pointer list-none p-4">
                <span className="block text-[17px] font-semibold text-ink">
                  {family.title}
                </span>
                <span className="block text-[14px] text-ink-soft">{family.text}</span>
                <span className="mt-1 block text-[13px] text-ink-faint">
                  {family.criteria.map((c) => c.name).join(" · ")}
                </span>
              </summary>
              <ul className="pb-1">
                {family.criteria.map((c) => (
                  <CriterionRow
                    key={c.key}
                    criterion={c}
                    highlighted={highlighted.has(c.key)}
                  />
                ))}
              </ul>
            </details>
          ))}
        </div>
      </Section>

      <Section title="שבע השאלות שלכם" note="כל שאלה מתורגמת לקריטריונים המקצועיים.">
        <div className="grid gap-2">
          {QUESTIONS.map((q) => {
            const linked = criteriaForQuestion(q.key);
            return (
              <Card key={q.key}>
                <p className="text-[16px] font-medium text-ink">{q.label}</p>
                <p className="mb-1 text-[14px] text-ink-soft">{q.help}</p>
                {linked.length > 0 ? (
                  <p className="text-[13px] text-ink-faint">
                    קריטריונים:{" "}
                    {linked.map((c, i) => (
                      <span key={c.key}>
                        {i > 0 ? " · " : ""}
                        <Link
                          href={`/learn?criterion=${c.key}`}
                          className="inline-link text-accent underline underline-offset-2"
                        >
                          {c.name}
                        </Link>
                      </span>
                    ))}
                  </p>
                ) : (
                  <p className="text-[13px] text-ink-faint">
                    תוספת של העירייה — אינה אחד משנים־עשר הקריטריונים.
                  </p>
                )}
                {q.alsoCovers.length > 0 ? (
                  <p className="text-[13px] text-ink-faint">
                    נושאים נוספים בשאלה: {q.alsoCovers.join(" · ")}
                  </p>
                ) : null}
              </Card>
            );
          })}
        </div>
        <p className="mt-2 text-[13px] text-ink-faint">
          תחזוקה וביטחון אינם נמדדים במסמך מינהל התכנון. הם נוספו כאן על ידי
          העירייה, משום שהתושבים מזכירים אותם.
        </p>
      </Section>

      <Section title="שש טיפולוגיות" note="כל רחוב נמדד מול רחובות מאותו סוג בלבד.">
        <div className="grid gap-2">
          {TYPOLOGIES.map((typology) => (
            <Card key={typology.key}>
              <p className="text-[16px] font-semibold text-ink">{typology.label}</p>
              <p className="mb-2 text-[14px] text-ink-soft">{typology.description}</p>
              <dl className="grid grid-cols-3 gap-2 text-[13px]">
                <div>
                  <dt className="text-ink-faint">רוחב זכות דרך</dt>
                  <dd className="text-ink">{typology.benchmarks.rowWidth}</dd>
                </div>
                <div>
                  <dt className="text-ink-faint">יחס גובה־רוחב</dt>
                  <dd className="text-ink">{typology.benchmarks.ratio}</dd>
                </div>
                <div>
                  <dt className="text-ink-faint">חופת עצים</dt>
                  <dd className="text-ink">{typology.benchmarks.canopy}</dd>
                </div>
              </dl>
              {EXAMPLES.some((e) => e.typology === typology.key) ? (
                <Link
                  href={`/examples?typology=${typology.key}`}
                  className="mt-2 inline-block text-[13px] text-accent underline underline-offset-2"
                >
                  ראו דוגמאות
                </Link>
              ) : (
                <p className="mt-2 text-[13px] text-ink-faint">
                  אין עדיין דוגמה בספרייה לסוג הזה.
                </p>
              )}
            </Card>
          ))}
        </div>
        <p className="mt-2 text-[13px] text-ink-faint">
          ערכי הייחוס הם טווחי עבודה לצורך השוואה, ואינם תקן מחייב.
        </p>
      </Section>

      <Section title="איך אתם עוזרים">
        <Card>
          <p className="mb-2 text-[15px] text-ink-soft">
            כל קול הופך לשורה בטבלה שאגף אדריכלות העיר עובד איתה: אילו רחובות לשמר, היכן
            להוסיף עצים, ואיפה לתקן חתך. הסטטוס של כל רחוב מתעדכן בגלוי.
          </p>
          <ButtonLink href="/choose">לבחור רחוב</ButtonLink>
        </Card>
      </Section>

      <Notice>
        הקריטריונים מבוססים על עקרונות מחקר &quot;רחובות טובים&quot; של מינהל התכנון. יש
        לאמת את הניסוח והמקור מול המסמך הרשמי לפני פרסום לציבור.
      </Notice>
    </>
  );
}
