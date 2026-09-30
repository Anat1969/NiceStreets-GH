import MapView from "@/components/MapView";
import { CITY, QUARTERS } from "@/lib/city";
import { loadCityData } from "@/lib/data";
import { loadStreetLines, streetLinesAvailable } from "@/lib/geo";
import { getStore } from "@/lib/store";
import { isStaff } from "@/lib/session";
import { DemoBanner, Notice } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const [{ streetStats, quarterStats, totals }, quarters, staff] = await Promise.all([
    loadCityData(),
    getStore()
      .listQuarters()
      .catch(() => QUARTERS),
    isStaff(),
  ]);

  /*
   * רובע מגיע למפה רק אם יש לו מיקום אמיתי. `schematic` מסמן מיקום שנקבע
   * כמילוי מקום ולא נמדד, ורובע כזה נשאר מחוץ למפה עד שימוקם.
   */
  const placed = quarters.filter((q) => !q.schematic);
  const unplacedQuarters = quarters.filter((q) => q.schematic);

  const statsByQuarter = new Map(quarterStats.map((s) => [s.quarter.id, s]));
  const lineByCode = new Map(loadStreetLines().map((l) => [l.code, l.line]));

  return (
    <>
      <DemoBanner demoVotes={totals.demoVotes} totalVotes={totals.votes} />

      <h1 className="mb-1 text-[24px] font-bold text-ink">מפה</h1>
      <p className="mb-3 text-[14px] text-ink-soft">
        בחרו מה למפות: קולות לפי רובע, או קולות לפי רחוב. המספר שעל כל תווית
        הוא מספר הקולות, גודל העיגול לפיו, וצבעו לפי הציון הממוצע.
      </p>

      <MapView
        center={CITY.center}
        zoom={CITY.zoom}
        canCalibrate={staff}
        streetLinesAvailable={streetLinesAvailable()}
        quarters={placed.map((q) => {
          const stats = statsByQuarter.get(q.id);
          return {
            id: q.id,
            name: q.name,
            center: q.center,
            votes: stats?.votes ?? 0,
            avgScore: stats?.avgScore ?? null,
          };
        })}
        unplaced={unplacedQuarters.map((q) => {
          const stats = statsByQuarter.get(q.id);
          return { id: q.id, name: q.name, votes: stats?.votes ?? 0 };
        })}
        streets={streetStats
          .filter((s) => s.street.quarterId && s.votes > 0)
          .map((s) => ({
            id: s.street.id,
            code: s.street.code,
            name: s.street.name,
            quarterId: s.street.quarterId as string,
            votes: s.votes,
            avgScore: s.avgScore,
            line: s.street.code ? lineByCode.get(s.street.code) : undefined,
            center: s.street.center ?? undefined,
          }))}
      />

      <div className="mt-4">
        <Notice>
          מפת הרקע והמיקומים מבוססים OpenStreetMap (רישיון ODbL). מיקום הרובע
          והרחוב נשלף משם לפי השם, ואינו שכבת ה-GIS של העירייה: הוא נקודה אחת,
          לא גבול ולא קו לאורך הרחוב. כששכבות העירייה ייטענו, הן יגברו עליו.
        </Notice>
      </div>
    </>
  );
}
