import StreetsTable from "@/components/StreetsTable";
import { QUARTERS, TYPOLOGIES } from "@/lib/city";
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
        מיון וסינון של כל הרחובות שהתקבלו עליהם קולות, או תצוגה לפי רובעים.
      </p>
      <StreetsTable
        staff={staff}
        quarters={QUARTERS.map((q) => ({ id: q.id, name: q.name }))}
        typologies={TYPOLOGIES.map((t) => ({ key: t.key, label: t.label }))}
        rows={streetStats.map((s) => ({
          id: s.street.id,
          name: s.street.name,
          quarterId: s.street.quarterId,
          quarterName: s.quarterName,
          typology: s.street.typology,
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
