import Link from "next/link";
import {
  CRITERIA_FAMILIES,
  CRITERION_MAP,
  EXAMPLES,
  FAMILY_MAP,
  PHOTO_POLICY,
  TYPOLOGY_MAP,
  TYPOLOGIES,
  WORLD_EXAMPLES,
  criterionHref,
} from "@/lib/city";
import type { CriterionKey, Example, TypologyKey, WorldExample } from "@/lib/city";
import { Notice } from "@/components/ui";
import { getStore } from "@/lib/store";
import ImageFrame from "@/components/ImageFrame";
import { imageSlot } from "@/lib/content-images";
import { isAdmin } from "@/lib/session";
import { isPublicPhoto } from "@/lib/types";
import "./examples.css";

export const dynamic = "force-dynamic";

export const metadata = { title: "דוגמאות — הרחובות הטובים של אשדוד" };

function label(count: number): string {
  if (count === 0) return "אין דוגמאות שתואמות לסינון";
  return `${count} ${count === 1 ? "דוגמה" : "דוגמאות"}`;
}

/** כל משפט בשורה משלו: פיצול אחרי נקודה, סימן שאלה או קריאה. */
function Sentences({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(?<=[.?!])\s+/).filter(Boolean);
  return (
    <p className={className}>
      {parts.map((part, i) => (
        <span key={i} className="block">
          {part}
        </span>
      ))}
    </p>
  );
}

/** שם הרחוב בעברית, ומתחתיו השם המלא בלועזית. */
function PlaceName({ place }: { place: string }) {
  const [he, en] = place.split(" — ");
  return (
    <>
      <span className="ex-place-he">{he}</span>
      {en ? (
        <bdi className="ex-place-en" dir="ltr">
          {en}
        </bdi>
      ) : null}
    </>
  );
}

/** עמודת הטקסט של כרטיס: כותרת, מה רואים, הידעת, ותגיות. */
function ExampleBody({ example }: { example: Example }) {
  return (
    <div className="ex-body">
      <p className="ex-eyebrow">
        {FAMILY_MAP[example.family].title}
        {example.typology ? ` · ${TYPOLOGY_MAP[example.typology].label}` : ""}
      </p>
      <h3 className="ex-title">{example.title}</h3>
      <Sentences text={example.text} className="ex-text" />

      {example.fact ? (
        <aside className="ex-fact" aria-label="הידעת?">
          <p className="ex-fact-label">הידעת?</p>
          <Sentences text={example.fact} className="ex-fact-text" />
        </aside>
      ) : null}

      <ul className="ex-tags" aria-label="קריטריונים">
        {example.criterionKeys.map((key) => (
          <li key={key}>
            <Link href={criterionHref(key)} className="ex-tag">
              {CRITERION_MAP[key].name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function ExamplesPage({
  searchParams,
}: {
  searchParams: Promise<{
    criterion?: string;
    typology?: string;
    cat?: string;
    sort?: string;
    all?: string;
  }>;
}) {
  const params = await searchParams;

  /*
   * שלוש קטגוריות שאפשר להדליק ולכבות (ענת, 09.11.2026, סעיף 11):
   * כמה דלוקות — עד 3 מכל אחת, שורה לכל קטגוריה. אחת בלבד — עד 5, בתמונות
   * גדולות. "הכול" — כל הדוגמאות, בשורות ובתמונות גדולות. המצב כולו בכתובת,
   * כדי שאפשר יהיה לשלוח תצוגה כקישור.
   */
  const CATS = ["ashdod", "israel", "world"] as const;
  type Cat = (typeof CATS)[number];
  const CAT_LABEL: Record<Cat, string> = {
    ashdod: "רחובות באשדוד",
    israel: "מהארץ",
    world: "מהעולם",
  };
  const parsedCats = (params.cat ?? "")
    .split(",")
    .filter((c): c is Cat => (CATS as readonly string[]).includes(c));
  const cats = new Set<Cat>(parsedCats.length ? parsedCats : CATS);
  const sortByName = params.sort === "name";
  const showAll = params.all === "1";
  const single = cats.size === 1;
  const cap = showAll ? Infinity : single ? 5 : 3;
  const compact = !showAll && !single;

  const store = getStore();
  const [slots, admin, allPhotos, streets, votes] = await Promise.all([
    store.listContentImageSlots().catch(() => [] as string[]),
    isAdmin(),
    store.listPhotos().catch(() => []),
    store.listStreets().catch(() => []),
    store.listVotes().catch(() => []),
  ]);
  const reasonByVote = new Map(votes.map((v) => [v.id, v.reason.trim()]));

  /*
   * רחובות מאשדוד שנכנסו לספריית הדוגמאות.
   *
   * תמונה אחת מאושרת היא רגע — מישהו עבר שם פעם אחת וצילם. לכן רחוב
   * נכנס לכאן רק אחרי PHOTO_POLICY.photosForExample תמונות מאושרות,
   * או כשהמנהלת העלתה לו תמונה כדוגמה: העלאה כזאת היא החלטה של האגף
   * ולא צבירה של קולות, והסף אינו חל עליה.
   */
  const cityStreets = streets
    .map((street) => {
      const shown = allPhotos
        .filter((p) => p.streetId === street.id && isPublicPhoto(p))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const curated = shown.some((p) => p.source === "example");
      return { street, shown, curated };
    })
    .filter(
      (row) => row.curated || row.shown.length >= PHOTO_POLICY.photosForExample,
    )
    .sort((a, b) => b.shown.length - a.shown.length);

  const criterion =
    params.criterion && params.criterion in CRITERION_MAP
      ? (params.criterion as CriterionKey)
      : "";
  const typology =
    params.typology && params.typology in TYPOLOGY_MAP
      ? (params.typology as TypologyKey)
      : "";

  const cityStreetRows = typology
    ? cityStreets.filter((row) => row.street.typology === typology)
    : cityStreets;

  const matches = (e: Example) =>
    (!criterion || e.criterionKeys.includes(criterion)) &&
    (!typology || e.typology === typology);
  const byPlace = <T extends { place: string }>(list: T[]) =>
    sortByName ? [...list].sort((a, b) => a.place.localeCompare(b.place, "he")) : list;
  const allIsrael = byPlace(EXAMPLES.filter(matches));
  const allWorld = byPlace(WORLD_EXAMPLES.filter(matches));
  const allCity = sortByName
    ? [...cityStreetRows].sort((a, b) => a.street.name.localeCompare(b.street.name, "he"))
    : cityStreetRows;
  const results = cats.has("israel") ? allIsrael.slice(0, cap) : [];
  const worldResults = cats.has("world") ? allWorld.slice(0, cap) : [];
  const cityShown = cats.has("ashdod") && !criterion ? allCity.slice(0, cap) : [];
  const total = results.length + worldResults.length + cityShown.length;
  const available: Record<Cat, number> = {
    ashdod: criterion ? 0 : allCity.length,
    israel: allIsrael.length,
    world: allWorld.length,
  };

  /** כתובת שמשמרת את הסינון, ומשנה רק את מה שביקשו. */
  const href = (next: { cats?: Set<Cat>; sort?: boolean; all?: boolean }) => {
    const q = new URLSearchParams();
    if (criterion) q.set("criterion", criterion);
    if (typology) q.set("typology", typology);
    const c = next.cats ?? cats;
    if (c.size < CATS.length) q.set("cat", CATS.filter((x) => c.has(x)).join(","));
    if (next.sort ?? sortByName) q.set("sort", "name");
    if (next.all ?? showAll) q.set("all", "1");
    const s = q.toString();
    return s ? `/examples?${s}` : "/examples";
  };
  const toggle = (c: Cat) => {
    const n = new Set(cats);
    if (n.has(c)) n.delete(c);
    else n.add(c);
    return n.size === 0 ? new Set<Cat>([c]) : n;
  };
  const more = (c: Cat) =>
    available[c] > cap ? (
      <Link href={href({ cats: new Set<Cat>([c]) })} className="ex-more">
        לכל {available[c]} הדוגמאות ב{CAT_LABEL[c]}
      </Link>
    ) : null;

  return (
    <>
      <h1 className="mb-1 text-[24px] font-bold text-ink">דוגמאות</h1>
      <p className="mb-4 text-[15px] text-ink-soft">
        <span className="block">רחובות מאשדוד, מהארץ ומהעולם, שממחישים קריטריון אחד או יותר.</span>
        <span className="block">אפשר לסנן לפי קריטריון או לפי סוג רחוב.</span>
      </p>

      {/* A plain GET form: the filter is always in the address, so a filtered
          view can be sent to someone else as a link. */}
      <form
        method="get"
        action="/examples"
        aria-labelledby="examples-filter-heading"
        className="ex-filter"
      >
        <h2 id="examples-filter-heading" className="sr-only">
          סינון
        </h2>
        <label className="ex-filter-field">
          <span>קריטריון</span>
          <select name="criterion" defaultValue={criterion}>
            <option value="">כל הקריטריונים</option>
            {CRITERIA_FAMILIES.map((family) => (
              <optgroup key={family.key} label={family.title}>
                {family.criteria.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label className="ex-filter-field">
          <span>סוג רחוב</span>
          <select name="typology" defaultValue={typology}>
            <option value="">כל הסוגים</option>
            {TYPOLOGIES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        {cats.size < CATS.length ? (
          <input type="hidden" name="cat" value={CATS.filter((x) => cats.has(x)).join(",")} />
        ) : null}
        {sortByName ? <input type="hidden" name="sort" value="name" /> : null}
        {showAll ? <input type="hidden" name="all" value="1" /> : null}
        <div className="ex-filter-actions">
          <button type="submit" className="ex-btn ex-btn-primary">
            סינון
          </button>
          <Link href="/examples" className="ex-btn">
            איפוס
          </Link>
        </div>
      </form>

      <nav className="ex-cats" aria-label="קטגוריות ותצוגה">
        <div className="ex-cat-group" role="group" aria-label="קטגוריות">
          {CATS.map((c) => (
            <Link
              key={c}
              href={href({ cats: toggle(c), all: false })}
              className="ex-chip"
              aria-pressed={cats.has(c)}
            >
              {CAT_LABEL[c]} <bdi className="num">{available[c]}</bdi>
            </Link>
          ))}
        </div>
        <div className="ex-cat-group" role="group" aria-label="מיון ותצוגה">
          <Link href={href({ sort: !sortByName })} className="ex-chip" aria-pressed={sortByName}>
            {sortByName ? "ממוין לפי שם" : "ללא מיון"}
          </Link>
          <Link href={href({ all: !showAll })} className="ex-chip" aria-pressed={showAll}>
            הכול
          </Link>
        </div>
      </nav>
      <p className="how mb-3">
        {showAll
          ? "כל הדוגמאות בקטגוריות שנבחרו, בתמונות גדולות."
          : single
            ? "קטגוריה אחת: עד 5 דוגמאות, בתמונות גדולות. לחיצה על קטגוריה נוספת מחזירה לשורות."
            : "עד 3 דוגמאות מכל קטגוריה, שורה לכל אחת. לחיצה על קטגוריה מדליקה או מכבה אותה; קטגוריה אחת לבד מציגה 5 בגדול."}
      </p>

      <p role="status" className="mb-4 text-[14px] text-ink-soft">
        <span className="font-semibold text-ink">{label(total)}</span>
        {criterion ? ` · ${CRITERION_MAP[criterion].name}` : ""}
        {typology ? ` · ${TYPOLOGY_MAP[typology].label}` : ""}
      </p>

      {/*
        רחובות מאשדוד. הסינון לפי קריטריון אינו חל עליהם — לרחוב אמיתי אין
        תג קריטריון אחד — ולכן בסינון כזה החלק הזה נסגר, ובסינון לפי סוג
        רחוב הוא מצטמצם לסוג שנבחר.
      */}
      {cats.has("ashdod") && !criterion ? (
        <section aria-labelledby="city-streets" className="ex-section">
          <h2 id="city-streets" className="ex-section-title">
            רחובות מאשדוד
          </h2>
          <p className="ex-section-note">
            רחוב נכנס לכאן אחרי {PHOTO_POLICY.photosForExample} תמונות שהצוות אישר.
          </p>
          {cityShown.length === 0 ? (
            <Notice>
              עדיין אין רחוב באשדוד עם {PHOTO_POLICY.photosForExample} תמונות מאושרות.
              כל תמונה שתושב מצרף לקול שלו מקרבת רחוב לכאן.
            </Notice>
          ) : (
            <ul className={compact ? "ex-grid ex-grid-compact" : "grid gap-5"}>
              {cityShown.map(({ street, shown }) => (
                <li key={street.id}>
                  <p className="mb-2 flex items-baseline justify-between gap-2">
                    <Link href={`/street/${street.id}`} className="ex-street-link">
                      {street.name}
                    </Link>
                    <span className="text-[13px] text-ink-faint">
                      {shown.length}{" "}
                      {shown.length === 1 ? "תמונה מאושרת" : "תמונות מאושרות"}
                      {street.typology ? ` · ${TYPOLOGY_MAP[street.typology].label}` : ""}
                    </span>
                  </p>
                  {/* כל תמונה במסגרת משלה, והמילים של התושב מתחתיה. */}
                  <ul className={compact ? "ex-photos ex-photos-one" : "ex-photos"}>
                    {shown.slice(0, compact ? 1 : 3).map((photo) => {
                      const reason = photo.voteId ? reasonByVote.get(photo.voteId) : "";
                      return (
                        <li key={photo.id}>
                          <figure className="ex-photo">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/photos/${photo.id}`}
                              alt={reason ? `${street.name}: ${reason}` : `${street.name}, אשדוד`}
                              loading="lazy"
                            />
                            <figcaption>
                              {reason ? (
                                <span className="resident-voice ex-voice">{reason}</span>
                              ) : (
                                <span className="text-ink-faint">בלי מילים מהתושב</span>
                              )}
                              <span className="ex-photo-date">
                                {new Date(photo.createdAt).toLocaleDateString("he-IL")}
                              </span>
                            </figcaption>
                          </figure>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
          {more("ashdod")}
        </section>
      ) : null}

      {results.length > 0 ? (
        <section aria-labelledby="israel-examples" className="ex-section">
          <h2 id="israel-examples" className="ex-section-title">
            מהארץ
          </h2>
          <p className="ex-section-note">18 רחובות שנותחו בסקר של מינהל התכנון.</p>
          <ul className={compact ? "ex-grid ex-grid-compact" : "grid gap-4 ex-grid-large"}>
            {results.map((example) => (
              <li key={example.key} className="ex-card">
                <figure className="ex-media">
                  <ImageFrame
                    slot={imageSlot("example", example.key)}
                    alt={`${example.title} — ${example.place}`}
                    hasImage={slots.includes(imageSlot("example", example.key))}
                    canEdit={admin}
                    ratio="3 / 2"
                    emptyLabel="אין עדיין תמונה לדוגמה"
                    fallbackSrc={`/examples/${example.key}.jpg`}
                  />
                  <figcaption className="ex-caption">
                    <PlaceName place={example.place} />
                  </figcaption>
                </figure>
                <ExampleBody example={example} />
              </li>
            ))}
          </ul>
          {more("israel")}
        </section>
      ) : null}

      {worldResults.length > 0 ? (
        <section aria-labelledby="world-examples" className="ex-section">
          <h2 id="world-examples" className="ex-section-title">
            מהעולם
          </h2>
          <p className="ex-section-note">
            <span className="block">רחובות שנבחרו בספר או בסקר מוכר על רחובות טובים.</span>
            <span className="block">מי בחר בכל רחוב כתוב מתחת לתמונה.</span>
          </p>
          <ul className={compact ? "ex-grid ex-grid-compact" : "grid gap-4 ex-grid-large"}>
            {worldResults.map((example: WorldExample) => (
              <li key={example.key} className="ex-card">
                <figure className="ex-media">
                  <div className="ex-world-frame">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={example.image.src}
                      alt={`${example.title} — ${example.place}`}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <figcaption className="ex-caption">
                    <PlaceName place={example.place} />
                    <span className="ex-survey">נבחר ב: {example.survey}</span>
                    <span className="ex-credit">
                      צילום:{" "}
                      <a href={example.image.page} target="_blank" rel="noopener noreferrer">
                        {example.image.author}
                      </a>
                      , <bdi dir="ltr">{example.image.license}</bdi>, ויקימדיה קומונס
                    </span>
                  </figcaption>
                </figure>
                <ExampleBody example={example} />
              </li>
            ))}
          </ul>
          {more("world")}
        </section>
      ) : null}

      {total === 0 ? (
        <Notice>הספרייה עדיין קטנה. אפשר לאפס את הסינון ולראות את כל הדוגמאות.</Notice>
      ) : null}

      {/* מקורות ואימות: תמיד בקטן, בסוף הדף. */}
      <footer className="sources ex-sources">
        <p>
          <span className="block">
            כל דוגמה מתויגת רק לקריטריונים שהתיאור שלה מזכיר במפורש, וסוג הרחוב נרשם רק כשהוא נאמר
            בשם הרחוב.
          </span>
          <span className="block">לכן חלק מהקריטריונים עדיין בלי דוגמה.</span>
        </p>
        <p className="mt-2 font-semibold">מקורות — מהארץ</p>
        <ul>
          {allIsrael.map((e) => (
            <li key={e.key}>
              {e.place.split(" — ")[0]}: {e.source}
            </li>
          ))}
        </ul>
        <p className="mt-2 font-semibold">מקורות — מהעולם</p>
        <ul>
          {allWorld.map((e) => (
            <li key={e.key}>
              {e.place.split(" — ")[0]}: {e.survey}. נתונים:{" "}
              <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer">
                {e.source}
              </a>
              . תמונה:{" "}
              <a href={e.image.page} target="_blank" rel="noopener noreferrer">
                {e.image.author}, {e.image.license}
              </a>
              .
            </li>
          ))}
        </ul>
      </footer>
    </>
  );
}
