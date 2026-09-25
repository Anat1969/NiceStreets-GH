import MapView from "@/components/MapView";
import { CITY, QUARTERS } from "@/lib/city";
import { loadCityData } from "@/lib/data";
import { getStore } from "@/lib/store";
import { isStaff } from "@/lib/session";
import { Notice } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const [{ streetStats, quarterStats }, quarters, staff] = await Promise.all([
    loadCityData(),
    // Fall back to the configured quarters so the map still draws when the
    // database is unreachable.
    getStore()
      .listQuarters()
      .catch(() => QUARTERS),
    isStaff(),
  ]);

  return (
    <>
      <h1 className="mb-1 text-[24px] font-bold text-ink">מפה</h1>
      <p className="mb-3 text-[14px] text-ink-soft">
        עוצמת הצבע לפי מספר הקולות. הקישו על רובע כדי לראות את רחובותיו.
      </p>
      <MapView
        center={CITY.center}
        zoom={CITY.zoom}
        canCalibrate={staff}
        quarters={quarters.map((q) => {
          const stats = quarterStats.find((s) => s.quarter.id === q.id);
          return {
            id: q.id,
            name: q.name,
            polygon: q.polygon,
            center: q.center,
            schematic: q.schematic,
            votes: stats?.votes ?? 0,
            avgScore: stats?.avgScore ?? null,
          };
        })}
        streets={streetStats
          .filter((s) => s.street.quarterId && s.votes > 0)
          .map((s) => ({
            id: s.street.id,
            name: s.street.name,
            quarterId: s.street.quarterId as string,
            votes: s.votes,
            avgScore: s.avgScore,
          }))}
      />
      <div className="mt-4">
        <Notice>
          מפת הרקע מבוססת OpenStreetMap. גבולות הרובעים הם ריבועים שהצוות ממקם על
          המפה, עד לטעינת שכבות ה־GIS העירוניות.
        </Notice>
      </div>
    </>
  );
}
