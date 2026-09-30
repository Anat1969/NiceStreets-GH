import {
  CRITERIA_FAMILIES,
  EXAMPLES,
  LOCAL_QUESTION_KEYS,
  QUESTION_MAP,
  TYPOLOGIES,
} from "@/lib/city";
import { HUB_ICONS, QUESTION_ICONS } from "@/components/icons";
import { IconCard } from "@/components/learn-nav";
import { Notice } from "@/components/ui";

export const metadata = { title: "ללמוד — הרחובות הטובים של אשדוד" };

export default function LearnPage() {
  const criteriaCount = CRITERIA_FAMILIES.reduce(
    (sum, family) => sum + family.criteria.length,
    0,
  );

  return (
    <>
      <h1 className="mb-1 text-[24px] font-bold text-ink">ללמוד</h1>
      <p className="mb-5 text-[15px] text-ink-soft">
        מה הופך רחוב לטוב, בארבעה חלקים. כל אחד קצר.
      </p>

      <div className="grid gap-3">
        <IconCard
          href="/learn/criteria"
          title={`${criteriaCount} הקריטריונים`}
          text={`${CRITERIA_FAMILIES.length} משפחות, ובהן ${criteriaCount} קריטריונים. לכל קריטריון כתוב מה נמדד בו ומאיפה מגיע הערך שלו.`}
          icon={HUB_ICONS.criteria}
        />
        <IconCard
          href="/learn/types"
          title="סוגי רחובות"
          text={`${TYPOLOGIES.length} טיפולוגיות. כל רחוב נמדד מול רחובות מאותו סוג בלבד.`}
          icon={HUB_ICONS.types}
        />
        <IconCard
          href="/examples"
          title="ספריית דוגמאות"
          text={`${EXAMPLES.length} הרחובות שהמסמך מביא כדוגמה, אחד לכל קריטריון, עם המספר שנמדד בהם.`}
          icon={HUB_ICONS.examples}
        />
        <IconCard
          href="/learn/help"
          title="איך אתם עוזרים"
          text="מה קורה לקול שלכם אחרי שהוא נשמר."
          icon={HUB_ICONS.help}
        />
      </div>

      {/*
        המסמך עצמו אומר מה אינו מודד, והאפליקציה שואלת בדיוק את זה. זה לא
        פער — זו הסיבה שיש שאלות לתושבים ולא רק שכבת GIS.
      */}
      <section className="mt-6">
        <h2 className="mb-1 text-[17px] font-semibold text-ink">
          מה שהמסמך אינו מודד
        </h2>
        <p className="mb-3 text-[14px] text-ink-soft">
          המסמך מודד את הרחוב הבנוי. הוא אינו מודד ניקיון, תאורה, רעש ובטיחות,
          וכותב זאת במפורש: &quot;טיפוח וביטחון לא נמדדים במסמך — ודווקא אותם
          העירייה יכולה לשפר מהר&quot;. שלוש השאלות האלה נשאלות כאן דווקא
          משום כך.
        </p>
        {/*
          האייקונים כאן אפורים ולא בצבע ההדגשה: אותה שפה חזותית, בטון
          שאומר "נמדד אצלנו ולא במסמך". בלי האייקון הרשימה הזאת נראית
          כמו טקסט שנשכח, ולא כמו חלק מהמערכת.
        */}
        <ul className="card divide-y divide-line">
          {LOCAL_QUESTION_KEYS.map((key) => {
            const Mark = QUESTION_ICONS[key];
            return (
              <li key={key} className="flex items-start gap-3 p-3">
                <span className="mt-0.5 shrink-0 text-ink-faint">
                  {Mark ? <Mark /> : null}
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold text-ink">
                    {QUESTION_MAP[key].label}
                  </span>
                  <span className="block text-[14px] text-ink-soft">
                    {QUESTION_MAP[key].help}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-6">
        <Notice>
          הקריטריונים, הדוגמאות וערכי הייחוס לקוחים מ&quot;הרחובות הטובים —
          זיקוק הקריטריונים&quot;, המבוסס על עבודת מינהל התכנון, היחידה לתכנון
          אסטרטגי, אוגוסט 2026. המסמך מציין במפורש שאינו מדריך תכנון: המספרים
          מתארים מה עובד ב-18 רחובות שנותחו, ואינם תקן.
        </Notice>
      </div>
    </>
  );
}
