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
import { loadBikePaths, loadStreetLines, streetLinesAvailable } from "@/lib/geo";
import { scoreOutOfTen, toTen } from "@/lib/score";
import { getStore } from "@/lib/store";
import { voteScore } from "@/lib/stats";
import { isStaff } from "@/lib/session";
import { DemoBanner } from "@/components/ui";
import QuarterIcon from "@/components/QuarterIcon";
import MapSearch from "@/components/MapSearch";
import { CANONICAL_STREETS } from "@/lib/streets";
import "./map.css";

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

  /*
   * הממוצע העירוני, משוקלל לפי קולות (בסולם השמור 1–5). אין עדיין היסטוריה
   * לפי תקופות, ולכן "השינוי" שמוצג ליד כל ציון הוא ההפרש מהממוצע הזה,
   * וכך זה גם כתוב במסך.
   */
  const rated = streetStats.filter((s) => s.votes > 0 && s.avgScore !== null);
  const voteSum = rated.reduce((n, s) => n + s.votes, 0);
  const cityAverage =
    voteSum > 0 ? rated.reduce((n, s) => n + (s.avgScore as number) * s.votes, 0) / voteSum : null;
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
        // ההפרש מהממוצע העירוני, בסולם 0–10. מוצג גם כשהוא קטן.
        delta:
          score === null || cityAverage === null
            ? null
            : Number((score - toTen(cityAverage)).toFixed(2)),
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
        photoId: s.latestPhotoId,
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
  // רחוב בשכבה העירונית מפוצל לקטעים (שד' בני ברית: 22). כולם נכנסים למפה.
  const linesByCode = new Map<string, [number, number][][]>();
  for (const l of loadStreetLines()) {
    const list = linesByCode.get(l.code) ?? [];
    list.push(l.line);
    linesByCode.set(l.code, list);
  }
  const longest = (lines?: [number, number][][]) =>
    lines?.reduce((a, b) => (b.length > a.length ? b : a));

  /* הבורר יושב על המפה עצמה, בפינה, ולא מעליה (ענת, 09.11.2026). */
  const viewToggle = (
    <nav className="map-seg" aria-label="מה מוצג על המפה">
      {(
        [
          ["districts", "לפי רובע", "/map"],
          ["streets", "לפי רחוב", "/map?view=streets"],
        ] as const
      ).map(([value, label, href]) => (
        <Link key={value} href={href} aria-current={view === value ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );

  const iconIds = Object.fromEntries(Object.entries(ROVA_CODE_TO_QUARTER));

  // חיפוש אחד לרובע ולרחוב, באותו מקום בשתי התצוגות.
  const rovaCodeOf = new Map(Object.entries(ROVA_CODE_TO_QUARTER).map(([code, id]) => [id, code]));
  const synonymsOf = new Map(CANONICAL_STREETS.map((c) => [c.code, c.synonyms]));
  const searchQuarters = quarters.map((q) => ({
    id: q.id,
    name: q.name,
    rovaCode: rovaCodeOf.get(q.id) ?? null,
  }));
  const searchStreets = streetStats
    .filter((s) => s.votes > 0 || staff)
    .map((s) => ({
      id: s.street.id,
      name: s.street.name,
      synonyms: (s.street.code && synonymsOf.get(s.street.code)) || [],
      quarterName: s.quarterName,
      votes: s.votes,
      photoId: s.latestPhotoId,
    }));
  const pickQuarter = typeof params.quarter === "string" ? params.quarter : null;
  const pickStreet = typeof params.street === "string" ? params.street : null;

  return (
    <>
      <DemoBanner demoVotes={totals.demoVotes} totalVotes={totals.votes} />

      <h1 className="map-title">
        <QuarterIcon id="city" size={36} className="text-accent" />
        מפה
      </h1>

      <MapSearch quarters={searchQuarters} streets={searchStreets} />

      {view === "districts" ? (
        <>
          <p className="map-how mb-3">
            רובע כהה הוא רובע עם ציון גבוה שנשען על הרבה קולות.
            <br />
            המספר בכתב יד הוא הציון של התושבים: גדול וכהה יותר כשהוא גבוה יותר.
            <br />
            ריחוף או לחיצה על רובע מציגים את הרחובות שדורגו בו.
          </p>
          <DistrictMap
            geojsonUrl={DISTRICT_GEOJSON_URL}
            data={districtData}
            metrics={METRICS}
            shade={SHADE}
            center={CITY.center}
            zoom={CITY.zoom}
            iconIds={iconIds}
            overlay={viewToggle}
            initialSelected={pickQuarter}
            delta={{
              key: "delta",
              metric: "score",
              note: `המספר הקטן ליד כל ציון הוא ההפרש מהממוצע העירוני${
                cityAverage === null ? "" : ` (${toTen(cityAverage).toFixed(1)})`
              }: + מעליו, − מתחתיו. אין עדיין היסטוריה לפי תקופות, ולכן זה הפרש מהממוצע ולא שינוי בזמן.`,
            }}
          />
          <footer className="sources">
            <p className="sources-title">מקורות ואימות</p>
            <p>גבולות הרובעים: קובץ הרובעים של העירייה. לרובע ז׳ ולרובע י״ד עדיין אין גבול בקובץ, ולכן הם מופיעים בדירוג בלבד.</p>
            <p>אייקון הרובע: קו המתאר שלו והצירים הראשיים והמשניים משכבת הרחובות של העירייה. אייקון בקו מקווקו הוא מתאר משוער, לפי הרחובות.</p>
            <p>מפת הרקע: OpenStreetMap (רישיון ODbL).</p>
          </footer>
        </>
      ) : (
        <>
          <p className="map-how mb-3">
            כמו במפת הרובעים: עיגול כהה הוא רחוב עם ציון גבוה שנשען על הרבה קולות.
            <br />
            המספר בעיגול, בכתב יד, הוא הציון של התושבים.
          </p>
          <MapView
            center={CITY.center}
            zoom={CITY.zoom}
            canCalibrate={staff}
            lockMode="street"
            cityAverage={cityAverage}
            overlay={viewToggle}
            initialStreet={pickStreet}
            streetLinesAvailable={streetLinesAvailable()}
            bikePaths={loadBikePaths()}
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
                line: s.street.code ? longest(linesByCode.get(s.street.code)) : undefined,
                lines: s.street.code ? linesByCode.get(s.street.code) : undefined,
                center: s.street.center ?? undefined,
                centerSource: s.street.centerSource,
                ballots: ballotsByStreet.get(s.street.id) ?? [],
                photoId: s.latestPhotoId,
              }))}
          />
          <footer className="sources">
            <p className="sources-title">מקורות ואימות</p>
            <p>קווי הרחובות: שכבת הרחובות של העירייה. רחוב בלי קו בשכבה ממוקם לפי OpenStreetMap, כנקודה אחת לפי השם.</p>
            <p>שבילי אופניים: שכבת העירייה. מפת הרקע: OpenStreetMap (רישיון ODbL).</p>
          </footer>
        </>
      )}
    </>
  );
}
