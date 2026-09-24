import { CRITERIA_FAMILIES, EXAMPLES, QUESTIONS, TYPOLOGIES } from "@/lib/city";
import { ButtonLink, Card, Notice, Section } from "@/components/ui";

export const metadata = { title: "ללמוד — הרחובות הטובים של אשדוד" };

export default function LearnPage() {
  return (
    <>
      <h1 className="mb-1 text-[24px] font-bold text-ink">ללמוד</h1>
      <p className="mb-5 text-[15px] text-ink-soft">
        שנים־עשר קריטריונים בארבע משפחות, שש טיפולוגיות של רחובות, ודוגמאות.
      </p>

      <Section title="ארבע משפחות, שנים־עשר קריטריונים">
        <div className="grid gap-3">
          {CRITERIA_FAMILIES.map((family) => (
            <Card key={family.key}>
              <p className="text-[17px] font-semibold text-ink">{family.title}</p>
              <p className="mb-2 text-[14px] text-ink-soft">{family.text}</p>
              <ul className="grid gap-2">
                {family.criteria.map((criterion) => (
                  <li key={criterion.name} className="border-t border-line pt-2">
                    <p className="text-[15px] font-medium text-ink">{criterion.name}</p>
                    <p className="text-[14px] text-ink-soft">{criterion.text}</p>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
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
            </Card>
          ))}
        </div>
        <p className="mt-2 text-[13px] text-ink-faint">
          ערכי הייחוס הם טווחי עבודה לצורך השוואה, ואינם תקן מחייב.
        </p>
      </Section>

      <Section title="שבע השאלות שלכם" note="כל שאלה מתורגמת לקריטריונים המקצועיים.">
        <div className="grid gap-2">
          {QUESTIONS.map((question) => (
            <Card key={question.key}>
              <p className="text-[16px] font-medium text-ink">{question.label}</p>
              <p className="mb-1 text-[14px] text-ink-soft">{question.help}</p>
              <p className="text-[13px] text-ink-faint">
                קריטריונים: {question.criteria.join(" · ")}
                {question.local ? " · תוספת מקומית" : ""}
              </p>
            </Card>
          ))}
        </div>
        <p className="mt-2 text-[13px] text-ink-faint">
          תחזוקה וביטחון אינם נמדדים במסמך מינהל התכנון, ונוספו כאן משום שהתושבים מזכירים אותם.
        </p>
      </Section>

      <Section title="ספריית דוגמאות">
        <div className="grid gap-2">
          {EXAMPLES.map((example) => (
            <Card key={example.title}>
              <p className="text-[16px] font-medium text-ink">{example.title}</p>
              <p className="text-[13px] text-ink-faint">{example.place}</p>
              <p className="mt-1 text-[14px] text-ink-soft">{example.text}</p>
            </Card>
          ))}
        </div>
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
