import { TYPOLOGIES } from "@/lib/city";
import { TYPOLOGY_ICONS } from "@/components/icons";
import { BackLink, IconCard } from "@/components/learn-nav";

export const metadata = { title: "סוגי רחובות — ללמוד" };

export default function TypesIndexPage() {
  return (
    <>
      <BackLink href="/learn" label="ללמוד" />
      <h1 className="mb-1 text-[24px] font-bold text-ink">סוגי רחובות</h1>
      <p className="mb-5 text-[15px] text-ink-soft">
        כל רחוב נמדד מול רחובות מאותו סוג בלבד — שדרה מול שדרה, רחוב מגורים
        מול רחוב מגורים.
      </p>

      <div className="grid gap-3">
        {TYPOLOGIES.map((typology) => (
          <IconCard
            key={typology.key}
            href={`/learn/types/${typology.key}`}
            title={typology.label}
            text={typology.description}
            icon={TYPOLOGY_ICONS[typology.key]}
          />
        ))}
      </div>
    </>
  );
}
