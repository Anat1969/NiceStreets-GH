import Link from "next/link";
import {
  CRITERIA_FAMILIES,
  CRITERION_MAP,
  EXAMPLES,
  FAMILY_MAP,
  PHOTO_POLICY,
  TYPOLOGY_MAP,
  TYPOLOGIES,
  criterionHref,
} from "@/lib/city";
import type { CriterionKey, TypologyKey } from "@/lib/city";
import { Card, Notice } from "@/components/ui";
import { getStore } from "@/lib/store";
import ImageFrame from "@/components/ImageFrame";
import { imageSlot } from "@/lib/content-images";
import { isAdmin } from "@/lib/session";
import { isPublicPhoto } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "דוגמאות — הרחובות הטובים של אשדוד" };

function label(count: number): string {
  if (count === 0) return "אין דוגמאות שתואמות לסינון";
  return `${count} ${count === 1 ? "דוגמה" : "דוגמאות"}`;
}

export default async function ExamplesPage({
  searchParams,
}: {
  searchParams: Promise<{ criterion?: string; typology?: string }>;
}) {
  const params = await searchParams;

  const store = getStore();
  const [slots, admin] = await Promise.all([
    store.listContentImageSlots().catch(() => [] as string[]),
    isAdmin(),
  ]);
  const [allPhotos, streets] = await Promise.all([
    store.listPhotos().catch(() => []),
    store.listStreets().catch(() => []),
  ]);

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

  const results = EXAMPLES.filter(
    (e) =>
      (!criterion || e.criterionKeys.includes(criterion)) &&
      (!typology || e.typology === typology),
  );

  const field =
    "mt-1 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[15px] text-ink";

  return (
    <>
      <h1 className="mb-1 text-[24px] font-bold text-ink">דוגמאות</h1>
      <p className="mb-4 text-[15px] text-ink-soft">
        רחובות מהארץ ומהעולם שממחישים קריטריון אחד או יותר. אפשר לסנן לפי קריטריון
        או לפי סוג רחוב.
      </p>

      {/* A plain GET form: the filter is always in the address, so a filtered
          view can be sent to someone else as a link. */}
      <form
        method="get"
        action="/examples"
        aria-labelledby="examples-filter-heading"
        className="mb-5 rounded-[14px] border border-line bg-accent-soft/60 p-4"
      >
        <h2
          id="examples-filter-heading"
          className="mb-3 text-[17px] font-semibold text-ink"
        >
          סינון
        </h2>

        <div className="grid gap-3">
          <label className="text-[13px] text-ink-soft">
            קריטריון
            <select name="criterion" defaultValue={criterion} className={field}>
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

          <label className="text-[13px] text-ink-soft">
            סוג רחוב
            <select name="typology" defaultValue={typology} className={field}>
              <option value="">כל הסוגים</option>
              {TYPOLOGIES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 rounded-[12px] bg-accent px-3 py-2 text-[15px] font-medium text-white"
            >
              סינון
            </button>
            <Link
              href="/examples"
              className="flex flex-1 items-center justify-center rounded-[12px] border border-line bg-surface px-3 py-2 text-[15px] text-ink"
            >
              איפוס
            </Link>
          </div>
        </div>
      </form>

      <p role="status" className="mb-2 text-[14px] text-ink-soft">
        {label(results.length)}
        {criterion ? ` · ${CRITERION_MAP[criterion].name}` : ""}
        {typology ? ` · ${TYPOLOGY_MAP[typology].label}` : ""}
      </p>

      {/*
        רחובות מאשדוד. הסינון לפי קריטריון אינו חל עליהם — לרחוב אמיתי אין
        תג קריטריון אחד — ולכן בסינון כזה החלק הזה נסגר, ובסינון לפי סוג
        רחוב הוא מצטמצם לסוג שנבחר.
      */}
      {!criterion ? (
        <section aria-labelledby="city-streets" className="mb-5">
          <h2 id="city-streets" className="mb-1 text-[17px] font-semibold text-ink">
            רחובות מאשדוד
          </h2>
          <p className="mb-2 text-[13px] text-ink-faint">
            רחוב נכנס לכאן אחרי {PHOTO_POLICY.photosForExample} תמונות שהצוות אישר,
            כדי שמה שרואים יהיה הרחוב ולא רגע אחד בו.
          </p>
          {cityStreetRows.length === 0 ? (
            <Notice>
              עדיין אין רחוב באשדוד עם {PHOTO_POLICY.photosForExample} תמונות מאושרות.
              כל תמונה שתושב מצרף לקול שלו מקרבת רחוב לכאן.
            </Notice>
          ) : (
            <ul className="grid gap-2">
              {cityStreetRows.map(({ street, shown }) => (
                <li key={street.id} className="overflow-hidden rounded-[12px] border border-line">
                  <ul className="flex">
                    {shown.slice(0, 3).map((photo) => (
                      <li key={photo.id} className="min-w-0 flex-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/photos/${photo.id}`}
                          alt={`${street.name}, אשדוד`}
                          className="h-28 w-full object-cover"
                        />
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-baseline justify-between gap-2 px-3 py-2">
                    <Link
                      href={`/street/${street.id}`}
                      className="inline-link text-[15px] font-medium text-accent underline underline-offset-2"
                    >
                      {street.name}
                    </Link>
                    <span className="text-[13px] text-ink-faint">
                      {shown.length}{" "}
                      {shown.length === 1 ? "תמונה מאושרת" : "תמונות מאושרות"}
                      {street.typology ? ` · ${TYPOLOGY_MAP[street.typology].label}` : ""}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <div className="grid gap-3">
        {results.map((example) => (
          <Card key={example.key}>
            <ImageFrame
              className="mb-2"
              slot={imageSlot("example", example.key)}
              alt={`${example.title} — ${example.place}`}
              hasImage={slots.includes(imageSlot("example", example.key))}
              canEdit={admin}
              ratio="16 / 9"
              emptyLabel="אין עדיין תמונה לדוגמה"
              fallbackSrc={`/examples/${example.key}.jpg`}
              credit={example.source}
              caption={
                <>
                  <span className="block text-[17px] font-bold leading-tight">
                    {example.place.split(" — ")[0]}
                  </span>
                  <span className="block text-[12px] opacity-90">
                    {example.place.split(" — ")[1] ?? ""}
                  </span>
                </>
              }
            />
            <p className="text-[16px] font-semibold text-ink">{example.title}</p>
            <p className="mt-1 text-[14px] text-ink-soft">{example.text}</p>

            <p className="mt-2 text-[13px] text-ink-faint">
              משפחה: {FAMILY_MAP[example.family].title}
              {example.typology
                ? ` · סוג רחוב: ${TYPOLOGY_MAP[example.typology].label}`
                : ""}
            </p>

            <p className="mt-1 text-[13px] text-ink-soft">
              {example.criterionKeys.map((key, i) => (
                <span key={key}>
                  {i > 0 ? " · " : ""}
                  <Link
                    href={criterionHref(key)}
                    className="inline-link text-accent underline underline-offset-2"
                  >
                    {CRITERION_MAP[key].name}
                  </Link>
                </span>
              ))}
            </p>
          </Card>
        ))}
      </div>

      {results.length === 0 ? (
        <Card>
          <p className="text-[15px] text-ink-soft">
            הספרייה עדיין קטנה. אפשר לאפס את הסינון ולראות את כל הדוגמאות.
          </p>
        </Card>
      ) : null}

      <div className="mt-5">
        <Notice>
          כל דוגמה מתויגת רק לקריטריונים שהתיאור שלה מזכיר במפורש, וסוג הרחוב נרשם רק
          כשהוא נאמר. לכן חלק מהקריטריונים עדיין בלי דוגמה.
        </Notice>
      </div>
    </>
  );
}
