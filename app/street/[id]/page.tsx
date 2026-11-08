import { notFound } from "next/navigation";
import Link from "next/link";
import { CRITERION_MAP, EXAMPLES, QUESTIONS, TYPOLOGY_MAP, STATUS_MAP } from "@/lib/city";
import type { CriterionKey } from "@/lib/city";
import { getStore } from "@/lib/store";
import { buildStreetStats, voteScore } from "@/lib/stats";
import { isStaff } from "@/lib/session";
import { parseSegmentCode } from "@/lib/segments";
import { isPublicPhoto } from "@/lib/types";
import type { Photo } from "@/lib/types";
import { confirmedTheme } from "@/lib/themes";
import {
  Card,
  DemoBanner,
  ScoreBar,
  Section,
  StatusBadge,
} from "@/components/ui";
import StatusEditor from "@/components/StatusEditor";
import PhotoDecision, { PhotoStatusBadge } from "@/components/PhotoDecision";
import StreetPhotoActions from "@/components/StreetPhotoActions";
import { StreetTile } from "@/components/StreetTile";
import StreetSection from "@/components/StreetSection";
import StreetWalk from "@/components/StreetWalk";
import { layerReadings } from "@/lib/street-layers";
import { QUESTION_ICONS } from "@/components/icons";
import { LOCAL_QUESTION_KEYS, CITY } from "@/lib/city";
import { scoreLabel } from "@/lib/hebrew";
import { summarise } from "@/lib/summary";
import MyPendingPhoto from "@/components/MyPendingPhoto";
import Rich from "@/components/Rich";
import QuarterIcon from "@/components/QuarterIcon";
import StreetNameWiki from "@/components/StreetNameWiki";
import RateCta from "@/components/RateCta";
import { FamilyMark, criterionFill } from "@/components/CriteriaMark";
import BenchmarkModel, { deviation, parseMetersRange } from "@/components/BenchmarkModel";
import { CANONICAL_STREETS } from "@/lib/streets";
import { parseRatioRange, FLOOR_HEIGHT_M } from "@/lib/street-section";
import { GIS_TYPOLOGY } from "@/lib/gis-typology.generated";

export const dynamic = "force-dynamic";

export default async function StreetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;
  const store = getStore();

  // Each read degrades on its own, so one failing table cannot blank the card.
  const [street, votes, photos, statuses, quarters, staff] = await Promise.all([
    store.getStreet(id).catch(() => null),
    store.listVotes({ streetId: id }).catch(() => []),
    store.listPhotos({ streetId: id }).catch(() => []),
    store.listStreetStatuses().catch(() => []),
    store.listQuarters().catch(() => []),
    isStaff(),
  ]);
  if (!street) notFound();

  const [stats] = buildStreetStats([street], votes, photos, statuses, quarters);
  const visiblePhotos = photos
    .filter((p) => isPublicPhoto(p) || staff)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  /*
   * קול שיש לו תמונה עולה לראש.
   *
   * המילים והתמונה הן אותה עדות, ומי שטרח לצלם נתן את החלק שאפשר
   * לראות. בתוך כל קבוצה הסדר הוא הקול האחרון קודם.
   */
  const voteIdsWithPhoto = new Set(
    photos.filter(isPublicPhoto).map((p) => p.voteId).filter(Boolean),
  );
  const reasons = votes
    .filter((v) => v.reason.trim().length > 0)
    .sort((a, b) => {
      const pa = voteIdsWithPhoto.has(a.id);
      const pb = voteIdsWithPhoto.has(b.id);
      if (pa !== pb) return pa ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    })
    .slice(0, 8);
  // סיווג הצוות, ובלעדיו ההערכה משכבת הרחובות העירונית — מסומנת כהערכה.
  const gisType = !street.typology && street.code ? GIS_TYPOLOGY[street.code] : undefined;
  const typology = street.typology
    ? TYPOLOGY_MAP[street.typology]
    : gisType
      ? TYPOLOGY_MAP[gisType as keyof typeof TYPOLOGY_MAP]
      : null;
  const typologyIsEstimate = !street.typology && Boolean(typology);
  /*
   * מה נמדד ברחוב עצמו: חתך שהצוות אישר, ובלעדיו ערך ה-GIS העירוני.
   * יחס = רוחב לגובה 1, כמו ערכי הייחוס. גובה = ממוצע הקומות בשני הצדדים.
   */
  const section = street.gis?.section ?? null;
  const measuredWidth = section?.facadeWidthM ?? street.gis?.rowWidthM ?? null;
  const measuredHeight = section ? ((section.floorsA + section.floorsB) / 2) * FLOOR_HEIGHT_M : null;
  const measuredRatio =
    section && measuredHeight ? section.facadeWidthM / measuredHeight
    : street.gis?.heightToWidth ? 1 / street.gis.heightToWidth
    : null;
  const summary = summarise(stats, reasons.length);
  /* התמונה שפותחת את הדף: החדשה מבין המאושרות. */
  const heroPhoto = visiblePhotos.filter(isPublicPhoto)[0] ?? null;

  /*
   * התמונה של כל קול, לפי מזהה הקול. רק תמונות שהציבור רשאי לראות:
   * נימוק שמוצג לכולם לא ייצמד לתמונה שממתינה לאישור.
   */
  const typeExampleCount = street.typology
    ? EXAMPLES.filter((e) => e.typology === street.typology).length
    : 0;

  /*
   * התמונה של כל קול. אחת, ולא יותר: המסד אוכף את זה באינדקס ייחודי,
   * ושליחה חוזרת של הדירוג מחליפה את התמונה במקום להוסיף לה.
   * ראו supabase/migrations/20261001150000_one_photo_per_vote.sql.
   */
  const photoByVote = new Map<string, Photo>();
  for (const photo of photos.filter(isPublicPhoto)) {
    if (photo.voteId) photoByVote.set(photo.voteId, photo);
  }

  /*
   * הקול שכל תמונה הגיעה איתו, לפי מזהה. כך כל תמונה בגלריה נושאת את
   * הנימוק ואת הציון שנשלחו יחד איתה, ולא רק את שם הרחוב.
   */
  const voteById = new Map(votes.map((v) => [v.id, v]));

  /*
   * A stretch of a crossing boulevard carries its quarter inside the code
   * ("189#q-b"), so the rating link has to hand both back separately: a "#"
   * in an address is a fragment, not a value.
   */
  // "הידעת?" — only where the quarter's naming theme is settled. See lib/themes.ts.
  const theme = confirmedTheme(street.quarterId);

  const segment = street.code ? parseSegmentCode(street.code) : null;
  const rateHref = segment
    ? `/choose?street=${segment.code}&quarter=${segment.quarterId}`
    : street.code
      ? `/choose?street=${street.code}`
      : "/choose";

  return (
    <>
      {saved ? (
        <div role="status" className="output-panel mb-4">
          <p className="output-label">התוצאה</p>
          <p className="output-value">הדירוג שלכם נשמר. תודה.</p>
          <p className="next-step-label mt-1">השלב הבא: לגלול ולראות איך התושבים האחרים דירגו את הרחוב.</p>
        </div>
      ) : null}

      <DemoBanner demoVotes={stats.demoVotes} totalVotes={stats.votes} />
      <MyPendingPhoto streetId={street.id} />

      {/*
        כותרת הרחוב היא התמונה שלו. השם יושב עליה על גרדיאנט שיוצא
        מהמסגרת, ולכן קודם רואים את הרחוב ורק אחר כך קוראים עליו.
        כשאין עדיין תמונה, נשארת כותרת טקסט רגילה ולא מסגרת ריקה.
      */}
      {/*
        לרחוב יש תמיד פנים בראש הדף, גם בלי תמונה. כשאין — האריח נבנה
        מהנתונים שלו, ומתחתיו הזמנה מפורשת לצלם: זה הרגע שבו התושב
        קורא על הרחוב, ולכן זה גם הרגע שבו כדאי לבקש ממנו תמונה.
      */}
      <StreetTile
        className="mb-3 block aspect-[16/10] w-full rounded-[16px] border border-line"
        name={street.name}
        quarterName={stats.quarterName}
        avgScore={stats.avgScore}
        photoId={heroPhoto?.id ?? null}
        size="hero"
      />

      <p className="street-meta">
        {street.quarterId ? <QuarterIcon id={street.quarterId} size={22} className="text-accent" /> : null}
        <span>{stats.quarterName}</span>
        <span aria-hidden="true">·</span>
        <span>
          {typology ? typology.label : "סוג טרם נקבע"}
          {typologyIsEstimate ? <span className="chip ms-1">הערכה</span> : null}
        </span>
      </p>

      <StreetNameWiki
        name={street.name}
        synonyms={CANONICAL_STREETS.find((c) => c.code === street.code)?.synonyms ?? []}
      />

      {!heroPhoto && !saved ? (
        <p className="mb-2 text-[14px] text-ink-soft">
          אין עדיין תמונה של {street.name}. התמונה הראשונה שתאושר תופיע כאן,
          בראש הדף.
        </p>
      ) : null}

      {/* אחרי שמירה — לא מבקשים שוב תמונה: היא כבר נשלחה וממתינה לצוות. */}
      {saved ? null : (
        <StreetPhotoActions streetId={street.id} streetName={street.name} city={CITY.name} />
      )}

      <div className="mb-4 flex gap-2">
        <div className="card flex-1 p-3 text-center">
          <div className="text-[24px] font-bold tabular-nums text-accent">
            {stats.votes.toLocaleString("he-IL")}
          </div>
          <div className="text-[13px] font-medium text-ink">קולות</div>
          <div className="mt-1 text-[11px] text-ink-faint">תושבים שדירגו</div>
        </div>
        <div className="card flex-1 p-3 text-center">
          <div className="score-hand text-[34px]">{scoreLabel(stats.avgScore)}</div>
          <div className="text-[13px] font-medium text-ink">ציון ממוצע</div>
          <div className="mt-1 text-[11px] text-ink-faint">מתוך 10</div>
        </div>
        <div className="card flex-1 p-3 text-center">
          <div className="text-[24px] font-bold tabular-nums text-accent">
            {visiblePhotos.filter(isPublicPhoto).length.toLocaleString("he-IL")}
          </div>
          <div className="text-[13px] font-medium text-ink">תמונות</div>
          <div className="mt-1 text-[11px] text-ink-faint">מאושרות</div>
        </div>
      </div>

      {/*
        לא כל תמונה הגיעה עם דירוג: מכרטיס הרחוב אפשר לצלם בלי לדרג,
        ואלה תמונות של הרחוב בלי קול מאחוריהן. בלי השורה הזאת נראה
        כאילו מספר התמונות ומספר הקולות אמורים להיות שווים.
      */}
      {stats.photos > photoByVote.size ? (
        <p className="-mt-2 mb-4 text-[12px] text-ink-faint">
          מתוך {stats.photos} התמונות, {photoByVote.size} צורפו לקול
          ו-{stats.photos - photoByVote.size} צולמו בלי דירוג.
        </p>
      ) : null}

      {/*
        סיכום במשפטים: מי שמגיע לכאן מרשימת המובילים רוצה לדעת מה חשבו
        על הרחוב, לא לקרוא שבעה מדדים ולהרכיב את התמונה בעצמו.
      */}
      <section className="voices mb-6" aria-labelledby="voices-title">
        <h2 id="voices-title" className="voices-title">מה התושבים חושבים על {street.name}</h2>
        <Rich as="p" className="voices-summary">{summary}</Rich>
        {reasons.length > 0 ? (
          <ul className="voices-quotes">
            {reasons.slice(0, 3).map((vote) => (
              <li key={vote.id}>
                <blockquote className="resident-voice">{vote.reason}</blockquote>
                <span className="voices-score">
                  <span className="score-hand">{scoreLabel(voteScore(vote))}</span> מ-10
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="how">עדיין אין מילים מהתושבים. הדירוג הבא יכול להיות הראשון.</p>
        )}
      </section>

      {street.center ? (
        <Section
          title="חתך הרחוב"
          note="כמה רחב הרחוב ביחס לגובה הבניינים. היחס הזה קובע אם הרחוב מרגיש כמו חדר או כמו מגרש פתוח."
        >
          <StreetSection
            streetId={street.id}
            saved={street.gis?.section ?? null}
            staff={staff}
            streetName={street.name}
            center={street.center}
            typologyLabel={typology?.label ?? null}
            benchmark={typology?.benchmarks.ratio ?? null}
            gisHeightToWidth={street.gis?.heightToWidth ?? null}
          />
        </Section>
      ) : null}

      {street.center ? (
        <Section
          title="הליכה ברחוב"
          note="120 מטר בגובה העיניים, בין תוואי הבניינים האמיתיים. כל רבע מהדרך מדליק שכבה: שלד, חתך, דופן, מרקם, עם הציונים של הרחוב."
        >
          <StreetWalk
            streetId={street.id}
            streetName={street.name}
            center={street.center}
            layers={layerReadings(street, stats.perQuestion, stats.votes)}
            photoId={heroPhoto?.id ?? null}
          />
        </Section>
      ) : null}

      {theme ? (
        <div className="mb-5 rounded-[14px] border border-line bg-accent-soft/60 p-4">
          <p className="mb-1 text-[15px] font-semibold text-accent">הידעת?</p>
          <p className="text-[15px] text-ink">
            רוב שמות הרחובות ב{stats.quarterName} נקבעו סביב נושא אחד:{" "}
            <span className="font-semibold">{theme}</span>.
          </p>
          <p className="mt-1 text-[14px] text-ink-soft">
            גרעין של רחובות ברובע נקרא סביב הנושא הזה.
            <br />
            עם השנים נוספו שמות אחרים, לזכרם של אנשים ואירועים, והם שכבה נוספת בסיפור של המקום.
          </p>
        </div>
      ) : null}

      <Section
        title="פילוח לפי שאלות"
        note="כל שבע השאלות נענות על ידי התושבים, באותו סולם 1 עד 5. ההבדל בין שתי הקבוצות הוא במה שאפשר להשוות אליו."
      >
        <Card>
          <p className="mb-1 text-[13px] font-semibold text-ink">
            יש להן גם מדידה מקצועית
          </p>
          <p className="mb-2 text-[12px] text-ink-faint">
            לצד ציון התושבים יש למסמך מדד וערך ייחוס לסוג הרחוב, ולכן אפשר
            לבדוק אם התחושה והמדידה מסכימות.
          </p>
          {QUESTIONS.filter((q) => !LOCAL_QUESTION_KEYS.includes(q.key)).map((question) => {
            const Mark = QUESTION_ICONS[question.key];
            return (
              <ScoreBar
                key={question.key}
                label={question.label}
                value={stats.perQuestion[question.key]}
                icon={Mark ? <Mark /> : undefined}
              />
            );
          })}

          {/*
            אפור אינו "פחות חשוב" ואינו "לא מנוקד": הציון מגיע מהתושבים
            כמו בכל השאר. הוא מסמן שאין ערך ייחוס מקצועי להשוות אליו.
          */}
          <p className="mb-1 mt-4 border-t border-line pt-3 text-[13px] font-semibold text-ink">
            ציון התושבים בלבד
          </p>
          <p className="mb-2 text-[12px] text-ink-faint">
            הציון כאן מגיע מהתושבים בדיוק כמו למעלה. מה שאין לו הוא מדד
            מקצועי וערך ייחוס במסמך — ולכן אין למה להשוות אותו. דווקא אלה
            הדברים שהעירייה יכולה לשפר מהר.
          </p>
          {QUESTIONS.filter((q) => LOCAL_QUESTION_KEYS.includes(q.key)).map((question) => {
            const Mark = QUESTION_ICONS[question.key];
            return (
              <ScoreBar
                key={question.key}
                label={question.label}
                value={stats.perQuestion[question.key]}
                icon={Mark ? <Mark /> : undefined}
                muted
              />
            );
          })}
        </Card>
        <p className="mt-2 text-[13px] text-ink-faint">
          כל שאלה מייצגת קריטריונים מקצועיים.{" "}
          <Link href="/learn" className="inline-link text-accent underline underline-offset-2">
            מה עומד מאחורי השאלות
          </Link>
        </p>
      </Section>

      {typology ? (
        <Section
          title={`ערכי ייחוס ל${typology.label}${typologyIsEstimate ? " (סוג מוערך)" : ""}`}
          note={typology.description}
        >
          <BenchmarkModel
            rowWidth={typology.benchmarks.rowWidth}
            ratio={typology.benchmarks.ratio}
            typologyLabel={typology.label}
            measured={{ widthM: measuredWidth, heightM: measuredHeight }}
          />
          <table className="param-table">
            <thead>
              <tr>
                <th scope="col">פרמטר</th>
                <th scope="col">ערך ייחוס</th>
                <th scope="col">נמדד ברחוב</th>
                <th scope="col">סטייה</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["רוחב זכות דרך", typology.benchmarks.rowWidth, "row_width", measuredWidth, parseMetersRange(typology.benchmarks.rowWidth), " מ'"],
                  ["יחס רוחב לגובה", typology.benchmarks.ratio, "proportions", measuredRatio, parseRatioRange(typology.benchmarks.ratio), ""],
                  ["חלק המדרכה", typology.benchmarks.sidewalk, "row_split", null, null, ""],
                  ["בניינים ל-100 מ'", typology.benchmarks.buildings, "building_rhythm", null, null, ""],
                  ["חופת עצים", typology.benchmarks.canopy, "tree_canopy", street.gis?.canopyPct ?? null, parseMetersRange(typology.benchmarks.canopy), "%"],
                  ["מרחק בין צמתים", typology.benchmarks.intersections, "intersection_density", street.gis?.intersectionDistanceM ?? null, parseMetersRange(typology.benchmarks.intersections), " מ'"],
                ] as [string, string, CriterionKey, number | null, [number, number] | null, string][]
              ).map(([label, value, criterionKey, measured, range, unit]) => {
                const dev = deviation(measured, range);
                return (
                  <tr key={label}>
                    <th scope="row">
                      <span className="param-icon" aria-hidden="true">
                        <FamilyMark family={CRITERION_MAP[criterionKey].familyKey} fill={criterionFill(criterionKey)} size={16} />
                      </span>
                      {label}
                    </th>
                    <td className="num">{value}</td>
                    <td className="num">
                      {measured === null ? (
                        <span className="text-ink-faint">טרם נמדד</span>
                      ) : (
                        <span className="score-hand text-[19px]">
                          {unit === "" ? `1:${measured.toFixed(1)}` : `${measured.toFixed(measured < 10 ? 1 : 0)}${unit}`}
                        </span>
                      )}
                    </td>
                    <td data-dev={dev === "בטווח" ? "ok" : dev === "—" ? "none" : "off"}>{dev}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[13px]">
            {typeExampleCount > 0 ? (
              <Link href={`/examples?typology=${typology.key}`} className="inline-link text-accent underline underline-offset-2">
                {typeExampleCount} דוגמאות ל{typology.label}
              </Link>
            ) : (
              <Link href="/examples" className="inline-link text-accent underline underline-offset-2">
                ספריית הדוגמאות
              </Link>
            )}
          </p>
        </Section>
      ) : null}

      <Section
        title="גלריה"
        note={
          staff
            ? "הצוות רואה גם תמונות שממתינות לאישור, ומכריע מתחת לכל אחת."
            : "תמונות שתושבים צילמו ברחוב, אחרי אישור הצוות."
        }
      >
        {stats.photosPending > 0 && !staff ? (
          <p className="mb-2 text-[13px] text-ink-soft">
            {stats.photosPending} {stats.photosPending === 1 ? "תמונה ממתינה" : "תמונות ממתינות"} לאישור הצוות ויפורסמו לאחר בדיקה.
          </p>
        ) : null}
        {visiblePhotos.length === 0 ? (
          <Card>
            <p className="text-[14px] text-ink-soft">
              עדיין אין תמונות מאושרות לרחוב הזה. אם אתם שם עכשיו, הכפתור
              בראש הדף פותח את המצלמה, והתמונה תגיע לאישור הצוות.
            </p>
          </Card>
        ) : (
          /*
            תמונה ברוחב מלא, כמו כל מסגרת אחרת בעמוד, ולא שתיים בשורה
            שנחתכות לריבועים. הכיתוב יושב על התמונה עם גרדיאנט שיוצא
            מהמסגרת, וההכרעה של הצוות היא שבב קטן בפינה — היא לא
            מתחרה בתמונה, וגם לא מכסה אותה.
          */
          /*
            כל תמונה במסגרת משלה, עם רווח ביניהן, והמילים של התושב
            כתת־כותרת מתחתיה (ענת, 08.11.2026: "נראות כמו תמונה אחת").
          */
          <ul className="photo-grid">
            {visiblePhotos.map((photo, index) => {
              const vote = photo.voteId ? voteById.get(photo.voteId) : undefined;
              const reason = vote?.reason?.trim();
              return (
                <li key={photo.id}>
                  <figure className="photo-card">
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/photos/${photo.id}`}
                        alt={reason ? `${street.name}: ${reason}` : `תמונה מהרחוב ${street.name}`}
                        loading={index === 0 ? undefined : "lazy"}
                      />
                      {staff ? (
                        <span className="absolute end-2 top-2">
                          <PhotoStatusBadge status={photo.status} source={photo.source} />
                        </span>
                      ) : null}
                    </div>
                    <figcaption>
                      {reason ? (
                        <p className="resident-voice">{reason}</p>
                      ) : (
                        <p className="text-[14px] text-ink-faint">בלי מילים מהצלם.</p>
                      )}
                      <p className="meta">
                        {vote ? `ציון ${scoreLabel(voteScore(vote))} מתוך 10 · ` : ""}
                        {new Date(photo.createdAt).toLocaleDateString("he-IL")}
                      </p>
                      {staff ? (
                        <div className="mt-2 border-t border-line pt-2">
                          <PhotoDecision photoId={photo.id} status={photo.status} />
                        </div>
                      ) : null}
                    </figcaption>
                  </figure>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="מה התושבים כתבו">
        {reasons.length === 0 ? (
          <Card>
            <p className="text-[14px] text-ink-soft">עדיין אין נימוקים.</p>
          </Card>
        ) : (
          /*
            התמונה שהתושב צירף לקול שלו מוצגת עם המילים שלו, ולא רק
            בגלריה. תמונה בלי המשפט שבא איתה מאבדת את מה שהתושב ניסה
            להגיד; משפט בלי התמונה מאבד את ההוכחה.
          */
          <ul className="grid gap-3">
            {reasons.map((vote) => {
              const votePhoto = photoByVote.get(vote.id) ?? null;
              return (
                <li key={vote.id} className="card overflow-hidden">
                  {votePhoto ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={`/api/photos/${votePhoto.id}`}
                      alt={`תמונה שצורפה לקול על ${street.name}`}
                      className="aspect-[16/10] w-full object-cover"
                      loading="lazy"
                    />
                  ) : null}
                  <div className="p-3">
                    <p className="resident-voice">{vote.reason}</p>
                    <p className="mt-1 text-[12px] text-ink-faint">
                      ציון הקול: {scoreLabel(voteScore(vote))} מתוך 10 ·{" "}
                      {new Date(vote.updatedAt).toLocaleDateString("he-IL")}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section
        title="סטטוס עירוני"
        note="מה אגף אדריכלות העיר עושה עם הרחוב הזה. שלושה שלבים בלבד."
      >
        <Card>
          <StatusBadge status={stats.status?.status ?? null} />
          {/* מה נבדק בשלב הזה — לא רק שם השלב. */}
          {stats.status && STATUS_MAP[stats.status.status] ? (
            <p className="mt-2 text-[14px] text-ink-soft">
              {STATUS_MAP[stats.status.status].meaning}
            </p>
          ) : (
            <p className="mt-2 text-[14px] text-ink-soft">
              הרחוב עדיין לא נכנס לבדיקה. האגף עובר על הרחובות שקיבלו קולות
              לפי סדר, ומעדכן כאן.
            </p>
          )}
          {stats.status?.publicNote ? (
            <p className="mt-2 text-[15px] text-ink">{stats.status.publicNote}</p>
          ) : null}
          {stats.status ? (
            <p className="mt-1 text-[12px] text-ink-faint">
              עודכן ב־{new Date(stats.status.updatedAt).toLocaleDateString("he-IL")}
            </p>
          ) : null}
          {staff ? (
            <div className="mt-3 border-t border-line pt-3">
              <StatusEditor
                streetId={street.id}
                current={stats.status?.status ?? null}
                note={stats.status?.publicNote ?? ""}
              />
            </div>
          ) : null}
        </Card>
      </Section>

      <div className="next-step mb-6">
        <RateCta streetId={street.id} streetName={street.name} rateHref={rateHref} justSaved={Boolean(saved)} />
        <div className="flex flex-wrap gap-x-4">
          <Link href={`/report?street=${street.id}`} className="link-btn">
            לדווח לעירייה על תקלה ברחוב
          </Link>
          <Link
            href={street.quarterId ? `/streets?quarter=${street.quarterId}&minVotes=0` : "/streets"}
            className="link-btn"
          >
            {street.quarterId ? `רחובות נוספים ב${stats.quarterName}` : "לרשימת הרחובות"}
          </Link>
        </div>
      </div>

      <footer className="sources">
        <p className="sources-title">מקורות ואימות</p>
        <p>
          סוג הרחוב:{" "}
          {street.typology
            ? "צוות אדריכלות העיר."
            : typology
              ? "הערכה לפי שכבת הרחובות של עיריית אשדוד (מידרג וסוג), עד לאישור הצוות."
              : "טרם נקבע."}
        </p>
        <p>מיקום הרחוב וחתך הרחוב: OpenStreetMap.</p>
        <p>דירוגים ותמונות: תושבים. תמונות מתפרסמות אחרי אישור הצוות.</p>
        {!street.verified ? <p>הרחוב טרם אומת מול שכבת ה־GIS העירונית.</p> : null}
      </footer>
    </>
  );
}
