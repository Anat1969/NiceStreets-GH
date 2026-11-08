import { CRITERIA_FAMILIES } from "@/lib/city";
import { FAMILY_ICONS } from "@/components/icons";
import { BackLink, IconCard } from "@/components/learn-nav";
import { CriteriaLegend, FamilyMark } from "@/components/CriteriaMark";

export const metadata = { title: "הקריטריונים — ללמוד" };

export default function CriteriaIndexPage() {
  return (
    <>
      <BackLink href="/learn" label="ללמוד" />
      <h1 className="mb-1 text-[24px] font-bold text-ink">ארבע משפחות</h1>
      <p className="mb-5 text-[15px] text-ink-soft">
        בכל משפחה שלושה קריטריונים. הקישו על משפחה כדי לקרוא אותם.
      </p>

      <CriteriaLegend />
      <div className="grid gap-3">
        {CRITERIA_FAMILIES.map((family) => (
          <IconCard
            key={family.key}
            href={`/learn/criteria/${family.key}`}
            title={
              <span className="inline-flex items-center gap-2">
                <FamilyMark family={family.key} size={18} />
                {family.title}
              </span>
            }
            text={family.text}
            icon={FAMILY_ICONS[family.key]}
          />
        ))}
      </div>
    </>
  );
}
