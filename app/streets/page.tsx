import StreetsTable from "@/components/StreetsTable";
import { QUARTERS, STATUSES, TYPOLOGIES, TYPOLOGY_MAP } from "@/lib/city";
import { loadCityData } from "@/lib/data";
import { isStaff } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function StreetsPage() {
  const [{ streetStats, quarterStats }, staff] = await Promise.all([
    loadCityData(),
    isStaff(),
  ]);

  return (
    <>
      <h1 className="mb-1 text-[24px] font-bold text-ink">רחובות</h1>
      <p className="mb-4 text-[14px] text-ink-soft">
        סננו וממיינו בחלק העליון, והתוצאות מופיעות מתחת.
      </p>
      <StreetsTable
        staff={staff}
        quarters={QUARTERS.map((q) => ({ id: q.id, name: q.name }))}
        typologies={TYPOLOGIES.map((t) => ({ key: t.key, label: t.label }))}
        statuses={STATUSES.map((s) => ({ key: s.key, label: s.label }))}
        rows={streetStats.map((s) => ({
          id: s.street.id,
          name: s.street.name,
          quarterId: s.street.quarterId,
          quarterName: s.quarterName,
          typology: s.street.typology,
          typologyLabel: s.street.typology
            ? (TYPOLOGY_MAP[s.street.typology]?.label ?? s.street.typology)
            : "טרם סווג",
          votes: s.votes,
          avgScore: s.avgScore,
          photos: s.photos,
          status: s.status?.status ?? null,
        }))}
        quarterRows={quarterStats.map((q) => ({
          id: q.quarter.id,
          name: q.quarter.name,
          votes: q.votes,
          avgScore: q.avgScore,
          streets: q.streets,
        }))}
      />
    </>
  );
}
