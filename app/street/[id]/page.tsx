import { notFound } from "next/navigation";
import Link from "next/link";
import { EXAMPLES, QUESTIONS, TYPOLOGY_MAP, STATUS_MAP } from "@/lib/city";
import type { CriterionKey } from "@/lib/city";
import { getStore } from "@/lib/store";
import { buildStreetStats, voteScore } from "@/lib/stats";
import { isStaff } from "@/lib/session";
import { parseSegmentCode } from "@/lib/segments";
import { isPublicPhoto } from "@/lib/types";
import { confirmedTheme } from "@/lib/themes";
import {
  Card,
  Datum,
  DemoBanner,
  Notice,
  ScoreBar,
  Section,
  StatusBadge,
} from "@/components/ui";
import StatusEditor from "@/components/StatusEditor";
import PhotoDecision, { PhotoStatusBadge } from "@/components/PhotoDecision";
import StreetPhotoActions from "@/components/StreetPhotoActions";
import { StreetTile } from "@/components/StreetTile";
import { QUESTION_ICONS, CRITERION_ICONS } from "@/components/icons";
import { LOCAL_QUESTION_KEYS, CITY } from "@/lib/city";
import { scoreLabel } from "@/lib/hebrew";
import { summarise } from "@/lib/summary";

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
  const reasons = votes
    .filter((v) => v.reason.trim().length > 0)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 8);
  const typology = street.typology ? TYPOLOGY_MAP[street.typology] : null;
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

  const photoByVote = new Map(
    photos.filter(isPublicPhoto).map((p) => [p.voteId, p]),
  );

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
        <p role="status" className="mb-4 rounded-[12px] bg-accent-soft px-3 py-2 text-[15px] text-accent">
          הקול שלכם נשמר. תודה.
        </p>
      ) : null}

      <DemoBanner demoVotes={stats.demoVotes} totalVotes={stats.votes} />

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
        quarterName={`${stats.quarterName} · ${typology?.label ?? "טרם סווג"}`}
        avgScore={stats.avgScore}
        photoId={heroPhoto?.id ?? null}
        size="hero"
      />

      {!heroPhoto ? (
        <p className="mb-2 text-[14px] text-ink-soft">
          אין עדיין תמונה של {street.name}. התמונה הראשונה שתאושר תופיע כאן,
          בראש הדף.
        </p>
      ) : null}

      <StreetPhotoActions
        streetId={street.id}
        streetName={street.name}
        city={CITY.name}
      />

      <div className="mb-4 flex gap-2">
        <div className="card flex-1 p-3 text-center">
          <div className="text-[24px] font-bold tabular-nums text-accent">
            {stats.votes.toLocaleString("he-IL")}
          </div>
          <div className="text-[13px] font-medium text-ink">קולות</div>
          <div className="mt-1 text-[11px] text-ink-faint">תושבים שדירגו</div>
        </div>
        <div className="card flex-1 p-3 text-center">
          <div className="text-[24px] font-bold tabular-nums text-accent">
            {scoreLabel(stats.avgScore)}
          </div>
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
        סיכום במשפטים: מי שמגיע לכאן מרשימת המובילים רוצה לדעת מה חשבו
        על הרחוב, לא לקרוא שבעה מדדים ולהרכיב את התמונה בעצמו.
      */}
      <Card className="mb-5">
        <p className="mb-1 text-[13px] font-semibold text-ink-faint">
          מה התושבים חושבים על הרחוב
        </p>
        <p className="text-[15px] leading-relaxed text-ink">{summary}</p>
      </Card>

      {theme ? (
        <div className="mb-5 rounded-[14px] border border-line bg-accent-soft/60 p-4">
          <p className="mb-1 text-[15px] font-semibold text-accent">הידעת?</p>
          <p className="text-[15px] text-ink">
            רוב שמות הרחובות ב{stats.quarterName} נקבעו סביב נושא אחד:{" "}
            <span className="font-semibold">{theme}</span>.
          </p>
          <p className="mt-1 text-[13px] text-ink-soft">
            זה הכלל, לא חוק: כמעט בכל רובע יש רחוב אחד או שניים שנקראו על שם
            אחר — לרוב מוקדם יותר מקביעת הנושא, או לציון אדם או אירוע שהעירייה
            ביקשה להנציח. רחוב שאינו מתאים לנושא אינו טעות; הוא בדרך כלל
            הסיפור המעניין יותר.
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
        <Section title={`ערכי ייחוס ל${typology.label}`} note={typology.description}>
          <Card>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-3 [&_svg]:h-4 [&_svg]:w-4">
              {(
                [
                  ["רוחב זכות דרך", typology.benchmarks.rowWidth, "row_width"],
                  ["חלק המדרכה", typology.benchmarks.sidewalk, "row_split"],
                  ["יחס רוחב לגובה", typology.benchmarks.ratio, "proportions"],
                  ["בניינים ל-100 מ'", typology.benchmarks.buildings, "building_rhythm"],
                  ["חופת עצים", typology.benchmarks.canopy, "tree_canopy"],
                  [
                    "מרחק בין צמתים",
                    typology.benchmarks.intersections,
                    "intersection_density",
                  ],
                ] as [string, string, CriterionKey][]
              ).map(([label, value, criterionKey]) => {
                const Mark = CRITERION_ICONS[criterionKey];
                return <Datum key={label} label={label} value={value} icon={<Mark />} />;
              })}
            </dl>
            {street.gis ? (
              <p className="mt-2 border-t border-line pt-2 text-[13px] text-ink-soft">
                נתוני GIS לרחוב:
                {street.gis.rowWidthM ? ` רוחב ${street.gis.rowWidthM} מ'` : ""}
                {street.gis.canopyPct ? ` · חופת עצים ${street.gis.canopyPct}%` : ""}
                {street.gis.intersectionDistanceM
                  ? ` · מרחק בין צמתים ${street.gis.intersectionDistanceM} מ'`
                  : ""}
              </p>
            ) : null}
            <p className="mt-2 text-[13px]">
              {/*
                קישור מסונן רק כשיש מה להראות. המסמך אינו מסווג את
                רחובות הדוגמה שלו לטיפולוגיות, ולכן לרוב הסוגים אין
                עדיין דוגמה — ושליחה לעמוד ריק גרועה מאמירה ישרה.
              */}
              {typeExampleCount > 0 ? (
                <Link
                  href={`/examples?typology=${typology.key}`}
                  className="inline-link text-accent underline underline-offset-2"
                >
                  {typeExampleCount} דוגמאות ל{typology.label}
                </Link>
              ) : (
                <Link
                  href="/examples"
                  className="inline-link text-accent underline underline-offset-2"
                >
                  ספריית הדוגמאות
                </Link>
              )}
            </p>
          </Card>
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
          <ul className="grid gap-3">
            {visiblePhotos.map((photo, index) => {
              const vote = photo.voteId ? voteById.get(photo.voteId) : undefined;
              const reason = vote?.reason?.trim();
              return (
                <li key={photo.id} className="card overflow-hidden">
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/photos/${photo.id}`}
                      alt={`תמונה מהרחוב ${street.name}`}
                      className="aspect-[16/10] w-full object-cover"
                      loading={index === 0 ? undefined : "lazy"}
                    />
                    <span className="photo-scrim" aria-hidden="true" />
                    <span className="absolute inset-x-0 bottom-0 p-3 text-[15px] font-semibold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]">
                      {street.name}
                    </span>
                    {/* לצוות בלבד: מצב התמונה, כתווית אחת ברורה בפינה. */}
                    {staff ? (
                      <span className="absolute end-3 top-3">
                        <PhotoStatusBadge status={photo.status} source={photo.source} />
                      </span>
                    ) : null}
                  </div>

                  {/*
                    הנימוק שנשלח עם התמונה, בדיוק כמו בכרטיס של "מה
                    התושבים כתבו": תמונה בלי המשפט שבא איתה מאבדת את מה
                    שהתושב ניסה להגיד.
                  */}
                  <div className="p-3">
                    {reason ? (
                      <p className="text-[15px] text-ink">{reason}</p>
                    ) : (
                      <p className="text-[14px] text-ink-faint">
                        התמונה הועלתה בלי נימוק.
                      </p>
                    )}
                    {vote ? (
                      <p className="mt-1 text-[12px] text-ink-faint">
                        ציון הקול: {scoreLabel(voteScore(vote))} מתוך 10
                      </p>
                    ) : null}

                    {/* ההכרעה יושבת על נייר, מתחת לתמונה, עם פעלים מפורשים. */}
                    {staff ? (
                      <div className="mt-3 border-t border-line pt-3">
                        <PhotoDecision photoId={photo.id} status={photo.status} />
                      </div>
                    ) : null}
                  </div>
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
              const photo = photoByVote.get(vote.id) ?? null;
              return (
                <li key={vote.id} className="card overflow-hidden">
                  {photo ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={`/api/photos/${photo.id}`}
                      alt={`תמונה שצורפה לקול על ${street.name}`}
                      className="aspect-[16/10] w-full object-cover"
                      loading="lazy"
                    />
                  ) : null}
                  <div className="p-3">
                    <p className="text-[15px] text-ink">{vote.reason}</p>
                    <p className="mt-1 text-[12px] text-ink-faint">
                      ציון הקול: {scoreLabel(voteScore(vote))} מתוך 10
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

      <div className="mb-6 grid gap-2">
        {/* The street is already known here, so the flow opens on the questions. */}
        <Link
          href={rateHref}
          className="flex items-center justify-center rounded-[14px] bg-accent px-5 py-3 text-[16px] font-medium text-white"
        >
          לדרג את {street.name}
        </Link>
        <Link
          href={
            street.quarterId
              ? `/streets?quarter=${street.quarterId}&minVotes=0`
              : "/streets"
          }
          className="flex items-center justify-center rounded-[14px] border border-line bg-surface px-5 py-3 text-[16px] text-ink"
        >
          {street.quarterId
            ? `רחובות נוספים ב${stats.quarterName}`
            : "חזרה לרשימת הרחובות"}
        </Link>
      </div>

      {!street.verified ? (
        <Notice>הרחוב טרם אומת מול שכבת ה־GIS העירונית.</Notice>
      ) : null}
    </>
  );
}
