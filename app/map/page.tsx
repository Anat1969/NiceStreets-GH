import Link from "next/link";
import DistrictMap from "@/components/DistrictMap";
import MapView from "@/components/MapView";
import { CITY, DISTRICT_GEOJSON_URL, QUARTERS, ROVA_CODE_TO_QUARTER } from "@/lib/city";
import { loadCityData } from "@/lib/data";
import type { DistrictData, MetricDef } from "@/lib/districts";
import { loadStreetLines, streetLinesAvailable } from "@/lib/geo";
import { votesLabel } from "@/lib/hebrew";
import { scoreOutOfTen, toTen } from "@/lib/score";
import { getStore } from "@/lib/store";
import { isStaff } from "@/lib/session";
import { DemoBanner, Notice } from "@/components/ui";

export const dynamic = "force-dynamic";

/** המדדים שאפשר לצבוע לפיהם. היום אחד; הוספת מדד = שורה כאן וערך בנתונים. */
const METRICS: MetricDef[] = [
  { key: "score", label: "ציון ממוצע", decimals: 1, unit: "מתוך 10", higherIsBetter: true },
];

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const view = params.view === "streets" ? "streets" : "districts";

  const [{ streetStats, quarterStats, totals }, quarters, staff] = await Promise.all([
    loadCityData(),
    getStore()
      .listQuarters()
      .catch(() => QUARTERS),
    isStaff(),
  ]);

  const statsByQuarter = new Map(quarterStats.map((s) => [s.quarter.id, s]));
  const quarterById = new Map(quarters.map((q) => [q.id, q]));

  /*
   * הנתונים למפת הרובעים, לפי קוד הרובע שבקובץ הגבולות. רובע שאין לו
   * פוליגון בקובץ (ז', י"ד) עדיין נכנס — הוא יופיע בדירוג עם הסימון
   * "אין גבול במפה".
   */
  const districtData: DistrictData = {};
  for (const [code, quarterId] of Object.entries(ROVA_CODE_TO_QUARTER)) {
    const quarter = quarterById.get(quarterId);
    if (!quarter) continue;
    const stats = statsByQuarter.get(quarterId);
    const top = streetStats
      .filter((s) => s.street.quarterId === quarterId && s.votes > 0)
      .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0) || b.votes - a.votes)
      .slice(0, 5);
    districtData[code] = {
      name: quarter.name,
      values: {
        score: stats?.avgScore == null ? null : Number(toTen(stats.avgScore).toFixed(2)),
      },
      fields: [
        { label: "קולות", value: String(stats?.votes ?? 0) },
        { label: "רחובות מדורגים", value: String(stats?.streets ?? 0) },
      ],
      itemsTitle: top.length > 0 ? "הרחובות המובילים" : undefined,
      items: top.map((s) => ({
        label: s.street.name,
        detail: `${scoreOutOfTen(s.avgScore)} · ${votesLabel(s.votes)}`,
        href: `/street/${s.street.id}`,
      })),
      link: {
        href: `/streets?quarter=${quarterId}&minVotes=0`,
        label: `כל הרחובות ב${quarter.name}`,
      },
    };
  }

  // מפת הרחובות: המיקומים המשוערים של הרובעים נשארים רק לכיול של הצוות.
  const placed = quarters.filter((q) => !q.schematic);
  const unplacedQuarters = quarters.filter((q) => q.schematic);
  const lineByCode = new Map(loadStreetLines().map((l) => [l.code, l.line]));

  return (
    <>
      <DemoBanner demoVotes={totals.demoVotes} totalVotes={totals.votes} />

      <h1 className="mb-1 text-[24px] font-bold text-ink">מפה</h1>

      <div className="mb-3 flex gap-2" role="group" aria-label="מה מוצג על המפה">
        {(
          [
            ["districts", "לפי רובע", "/map"],
            ["streets", "לפי רחוב", "/map?view=streets"],
          ] as const
        ).map(([value, label, href]) => (
          <Link
            key={value}
            href={href}
            aria-current={view === value ? "true" : undefined}
            className={`pressable flex flex-1 items-center justify-center rounded-[12px] px-3 py-2 text-[14px] ${
              view === value
                ? "bg-accent font-semibold text-white"
                : "border border-line bg-surface text-ink"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {view === "districts" ? (
        <>
          <p className="mb-3 text-[14px] text-ink-soft">
            כל רובע צבוע לפי הציון הממוצע שנתנו התושבים לרחובות שבו, ברבעונים: הכהה
            ביותר הוא הרבע העליון. לחיצה על רובע, או על שורה בדירוג, מציגה את
            הפרטים שלו.
          </p>
          <DistrictMap
            geojsonUrl={DISTRICT_GEOJSON_URL}
            data={districtData}
            metrics={METRICS}
            center={CITY.center}
            zoom={CITY.zoom}
          />
          <div className="mt-4">
            <Notice>
              גבולות הרובעים מקובץ הרובעים של העירייה. לרובע ז&apos; ולרובע י&quot;ד
              עדיין אין גבול בקובץ, ולכן הם מופיעים בדירוג בלבד. מפת הרקע:
              OpenStreetMap (רישיון ODbL).
            </Notice>
          </div>
        </>
      ) : (
        <>
          <p className="mb-3 text-[14px] text-ink-soft">
            המספר שעל כל תווית הוא מספר הקולות, גודל העיגול לפיו, וצבעו לפי
            הציון הממוצע.
          </p>
          <MapView
            center={CITY.center}
            zoom={CITY.zoom}
            canCalibrate={staff}
            lockMode={staff ? undefined : "street"}
            streetLinesAvailable={streetLinesAvailable()}
            quarters={placed.map((q) => {
              const stats = statsByQuarter.get(q.id);
              return {
                id: q.id,
                name: q.name,
                center: q.center,
                votes: stats?.votes ?? 0,
                avgScore: stats?.avgScore ?? null,
                centerSource: q.centerSource ?? null,
              };
            })}
            unplaced={
              staff
                ? unplacedQuarters.map((q) => {
                    const stats = statsByQuarter.get(q.id);
                    return { id: q.id, name: q.name, votes: stats?.votes ?? 0 };
                  })
                : []
            }
            streets={streetStats
              .filter((s) => s.votes > 0 || staff)
              .map((s) => ({
                id: s.street.id,
                code: s.street.code,
                name: s.street.name,
                quarterId: s.street.quarterId as string,
                votes: s.votes,
                avgScore: s.avgScore,
                line: s.street.code ? lineByCode.get(s.street.code) : undefined,
                center: s.street.center ?? undefined,
                centerSource: s.street.centerSource,
              }))}
          />
          <div className="mt-4">
            <Notice>
              מפת הרקע והמיקומים מבוססים OpenStreetMap (רישיון ODbL). מיקום הרחוב
              נשלף משם לפי השם, ואינו שכבת ה-GIS של העירייה: הוא נקודה אחת, לא קו
              לאורך הרחוב. כששכבת העירייה תיטען, היא תגבר עליו.
            </Notice>
          </div>
        </>
      )}
    </>
  );
}
