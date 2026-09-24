import MapView from "@/components/MapView";
import { CITY } from "@/lib/city";
import { loadCityData } from "@/lib/data";
import { getStore } from "@/lib/store";
import { Notice } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const [{ streetStats, quarterStats }, quarters] = await Promise.all([
    loadCityData(),
    getStore().listQuarters(),
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
        quarters={quarters.map((q) => {
          const stats = quarterStats.find((s) => s.quarter.id === q.id);
          return {
            id: q.id,
            name: q.name,
            polygon: q.polygon,
            center: q.center,
            votes: stats?.votes ?? 0,
            avgScore: stats?.avgScore ?? null,
          };
        })}
        streets={streetStats
          .filter((s) => s.street.line && s.street.line.length > 1)
          .map((s) => ({
            id: s.street.id,
            name: s.street.name,
            quarterId: s.street.quarterId,
            line: s.street.line as [number, number][],
            votes: s.votes,
            avgScore: s.avgScore,
          }))}
      />
      <div className="mt-4">
        <Notice>
          הגבולות וקווי הרחובות במפה הם סכמטיים ונועדו להדגמה בלבד, עד לטעינת שכבות
          ה־GIS העירוניות. להוספת מפת רקע עירונית: משתנה הסביבה NEXT_PUBLIC_MAP_STYLE.
        </Notice>
      </div>
    </>
  );
}
