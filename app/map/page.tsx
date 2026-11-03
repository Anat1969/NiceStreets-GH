import Link from "next/link";
import DistrictMap from "@/components/DistrictMap";
import MapView from "@/components/MapView";
import { CITY, DISTRICT_GEOJSON_URL, QUARTERS, ROVA_CODE_TO_QUARTER } from "@/lib/city";
import { loadCityData } from "@/lib/data";
import {
  bothLevels,
  type DistrictData,
  type MetricDef,
  type ShadeDef,
} from "@/lib/districts";
import { loadStreetLines, streetLinesAvailable } from "@/lib/geo";
import { scoreOutOfTen, toTen } from "@/lib/score";
import { getStore } from "@/lib/store";
import { voteScore } from "@/lib/stats";
import { isStaff } from "@/lib/session";
import { DemoBanner, Notice } from "@/components/ui";

export const dynamic = "force-dynamic";

/** המדד לדירוג ולתווית שעל הרובע. הוספת מדד = שורה כאן וערך בנתונים. */
const METRICS: MetricDef[] = [
  { key: "score", label: "ציון ממוצע", decimals: 1, unit: "מתוך 10", higherIsBetter: true },
  { key: "votes", label: "מספר קולות", decimals: 0, unit: "קולות", higherIsBetter: true },
];

/**
 * עוצמת הגוון: כהה = ציון גבוה שנשען על הרבה קולות (bothLevels ב-
 * lib/districts.ts). שלוש דרגות, ובמקרא מילים — הדרגה היא שילוב, לא מספר.
 */
const SHADE: ShadeDef = {
  key: "level",
  preLeveled: true,
  label: "ציון וכמות קולות",
  levels: 3,
  emptyLabel: "אין קולות",
  legendLabels: ["נמוך", "בינוני", "גבוה"],
};

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const view = params.view === "streets" ? "streets" : "districts";

  const [{ streetStats, quarterStats, totals }, quarters, staff, votes] = await Promise.all([
    loadCityData(),
    getStore()
      .listQuarters()
      .catch(() => QUARTERS),
    isStaff(),
    // הקולות עצמם נדרשים רק לתצוגת הרחובות, שבה כל קול מפורט עם הציון שלו.
    view === "streets" ? getStore().listVotes().catch(() => []) : Promise.resolve([]),
  ]);

  /*
   * כל קול ברחוב, מהחדש לישן: תאריך וציון (0–10). התאריך מעוצב כאן ולא
   * בדפדפן, כדי שהשרת והדפדפן יציגו בדיוק אותו טקסט.
   */
  const dateFormat = new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "numeric",
    year: "2-digit",
    timeZone: "Asia/Jerusalem",
  });
  const ballotsByStreet = new Map<string, { date: string; score: string }[]>();
  for (const vote of [...votes].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const list = ballotsByStreet.get(vote.streetId) ?? [];
    list.push({
      date: dateFormat.format(new Date(vote.createdAt)),
      score: toTen(voteScore(vote)).toFixed(1),
    });
    ballotsByStreet.set(vote.streetId, list);
  }

  const statsByQuarter = new Map(quarterStats.map((s) => [s.quarter.id, s]));
  const quarterById = new Map(quarters.map((q) => [q.id, q]));

  /*
   * הנתונים למפת הרובעים, לפי קוד הרובע שבקובץ הגבולות. רובע שאין לו
   * פוליגון בקובץ (ז', י"ד) עדיין נכנס — הוא יופיע בדירוג עם הסימון
   * "אין גבול במפה".
   */
  const districtData: DistrictData = {};
  const levelOf = bothLevels(
    Object.values(ROVA_CODE_TO_QUARTER).map((id) => {
      const st = statsByQuarter.get(id);
      return { id, score: st?.avgScore ?? null, votes: st?.votes ?? 0 };
    }),
  );
  for (const [code, quarterId] of Object.entries(ROVA_CODE_TO_QUARTER)) {
    const quarter = quarterById.get(quarterId);
    if (!quarter) continue;
    const stats = statsByQuarter.get(quarterId);
    // כל הרחובות שקיבלו קול, מהמדורג ביותר: זה מה שמופיע בריחוף ובלוח.
    const rated = streetStats
      .filter((s) => s.street.quarterId === quarterId && s.votes > 0)
      .sort((a, b) => b.votes - a.votes || (b.avgScore ?? 0) - (a.avgScore ?? 0));
    const votes = stats?.votes ?? 0;
    const score = stats?.avgScore == null ? null : toTen(stats.avgScore);
    districtData[code] = {
      name: quarter.name,
      values: {
        score: score === null ? null : Number(score.toFixed(2)),
        votes,
        // 1..3, או null כשאין קולות.
        level: levelOf.has(quarterId) ? (levelOf.get(quarterId) as number) + 1 : null,
      },
      // בלי קולות אין טבלה, ולכן משפט אחד במקומה.
      summary: score === null ? "אין עדיין קולות ברובע הזה" : undefined,
      columns: ["ציון", "קולות"],
      total:
        score === null
          ? undefined
          : { label: "כל הרובע", cells: [score.toFixed(1), String(votes)] },
      fields: [{ label: "רחובות מדורגים", value: String(stats?.streets ?? 0) }],
      items: rated.map((s) => ({
        label: s.street.name,
        cells: [scoreOutOfTen(s.avgScore), String(s.votes)],
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
            רובע כהה הוא רובע עם ציון גבוה שנשען על הרבה קולות. ציון גבוה מקולות
            בודדים נשאר בהיר. המספר על הרובע הוא הציון הממוצע. ריחוף או לחיצה על רובע מציגים את הרחובות שדורגו בו, ולכל
            רחוב את מספר הקולות והציון.
          </p>
          <DistrictMap
            geojsonUrl={DISTRICT_GEOJSON_URL}
            data={districtData}
            metrics={METRICS}
            shade={SHADE}
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
            כמו במפת הרובעים: עיגול כהה הוא רחוב עם ציון גבוה שנשען על הרבה
            קולות. המספר בעיגול הוא הציון הממוצע.
          </p>
          <MapView
            center={CITY.center}
            zoom={CITY.zoom}
            canCalibrate={staff}
            lockMode="street"
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
                ballots: ballotsByStreet.get(s.street.id) ?? [],
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
