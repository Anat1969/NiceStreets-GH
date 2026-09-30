import { notFound } from "next/navigation";
import { CRITERIA_FAMILIES, TYPOLOGIES } from "@/lib/city";
import { isStaff } from "@/lib/session";
import {
  CRITERION_ICONS,
  FAMILY_ICONS,
  HUB_ICONS,
  TYPOLOGY_ICONS,
} from "@/components/icons";
import { BackLink } from "@/components/learn-nav";

export const dynamic = "force-dynamic";

const HUB_LABELS: Record<string, string> = {
  criteria: "12 הקריטריונים",
  types: "סוגי רחובות",
  examples: "ספריית דוגמאות",
  help: "איך אתם עוזרים",
};

function Grid({
  title,
  note,
  items,
}: {
  title: string;
  note?: string;
  items: { key: string; label: string; icon: () => React.ReactElement }[];
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-1 text-[19px] font-semibold text-ink">{title}</h2>
      {note ? <p className="mb-2 text-[13px] text-ink-soft">{note}</p> : null}
      <ul className="grid grid-cols-2 gap-2">
        {items.map((item) => {
          const Glyph = item.icon;
          return (
            <li key={item.key} className="card flex flex-col items-center gap-2 p-3">
              <span className="text-accent">
                <Glyph />
              </span>
              <span className="text-center text-[13px] text-ink">{item.label}</span>
              <span className="text-center text-[11px] text-ink-faint">{item.key}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default async function IconPreviewPage() {
  // Not a login screen: an address that is not for the public does not exist for it.
  if (!(await isStaff())) notFound();

  const criteria = CRITERIA_FAMILIES.flatMap((family) =>
    family.criteria.map((criterion) => ({
      key: criterion.key,
      label: criterion.name,
      icon: CRITERION_ICONS[criterion.key],
    })),
  );

  return (
    <>
      <BackLink href="/learn" label="ללמוד" />
      <h1 className="mb-1 text-[24px] font-bold text-ink">ערכת האייקונים</h1>
      <p className="mb-5 text-[14px] text-ink-soft">
        מסך לצוות בלבד, לבדיקת כל האייקונים יחד. רשת 24, קו 1.5, קצוות
        מעוגלים, צבע אחד, בלי מילוי. משמשים בתוכן הלימוד בלבד — בניווט יש
        תוויות טקסט.
      </p>

      <Grid
        title="ארבעת כרטיסי המדור"
        items={Object.entries(HUB_ICONS).map(([key, icon]) => ({
          key,
          label: HUB_LABELS[key] ?? key,
          icon,
        }))}
      />

      <Grid
        title="ארבע המשפחות"
        items={CRITERIA_FAMILIES.map((family) => ({
          key: family.key,
          label: family.title,
          icon: FAMILY_ICONS[family.key],
        }))}
      />

      <Grid title="שנים־עשר הקריטריונים" items={criteria} />

      <Grid
        title="שש הטיפולוגיות"
        items={TYPOLOGIES.map((typology) => ({
          key: typology.key,
          label: typology.label,
          icon: TYPOLOGY_ICONS[typology.key],
        }))}
      />
    </>
  );
}
