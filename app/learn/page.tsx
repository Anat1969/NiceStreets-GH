import { CRITERIA_FAMILIES, TYPOLOGIES } from "@/lib/city";
import { HUB_ICONS } from "@/components/icons";
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
          text={`${CRITERIA_FAMILIES.length} משפחות, ובכל אחת שלושה קריטריונים. לכל קריטריון כתוב מאיפה מגיע הערך שלו.`}
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
          text="רחובות מהארץ ומהעולם שממחישים קריטריון אחד או יותר, עם סינון."
          icon={HUB_ICONS.examples}
        />
        <IconCard
          href="/learn/help"
          title="איך אתם עוזרים"
          text="מה קורה לקול שלכם אחרי שהוא נשמר."
          icon={HUB_ICONS.help}
        />
      </div>

      <div className="mt-6">
        <Notice>
          הקריטריונים מבוססים על עקרונות מחקר &quot;רחובות טובים&quot; של מינהל
          התכנון. יש לאמת את הניסוח והמקור מול המסמך הרשמי לפני פרסום לציבור.
        </Notice>
      </div>
    </>
  );
}
