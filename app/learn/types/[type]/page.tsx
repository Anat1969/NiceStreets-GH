import Link from "next/link";
import { notFound } from "next/navigation";
import { EXAMPLES, TYPOLOGIES, TYPOLOGY_MAP } from "@/lib/city";
import type { TypologyKey } from "@/lib/city";
import { CRITERION_ICONS, TYPOLOGY_ICONS } from "@/components/icons";
import type { CriterionKey } from "@/lib/city";
import { BackLink, PrevNext } from "@/components/learn-nav";
import { Card, Datum } from "@/components/ui";
import ImageFrame from "@/components/ImageFrame";
import { getStore } from "@/lib/store";
import { imageSlot } from "@/lib/content-images";
import { isAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

/* נבנה בכל בקשה, מאותה סיבה כמו עמוד הקריטריונים. */

export default async function TypePage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type: key } = await params;
  const typology = TYPOLOGY_MAP[key as TypologyKey];
  if (!typology) notFound();

  const [slots, admin] = await Promise.all([
    getStore()
      .listContentImageSlots()
      .catch(() => [] as string[]),
    isAdmin(),
  ]);
  const slot = imageSlot("typology", typology.key);

  const Glyph = TYPOLOGY_ICONS[typology.key];
  const index = TYPOLOGIES.findIndex((t) => t.key === typology.key);
  const prev = TYPOLOGIES[index - 1];
  const next = TYPOLOGIES[index + 1];
  // הדוגמאות של הסוג הזה מוצגות כאן עצמן, לא רק כקישור לרשימה מסוננת.
  const typeExamples = EXAMPLES.filter((e) => e.typology === typology.key);

  return (
    <>
      <BackLink href="/learn/types" label="סוגי רחובות" />
      <div className="mb-1 flex items-center gap-3">
        <span className="text-accent">
          <Glyph />
        </span>
        <h1 className="text-[24px] font-bold text-ink">{typology.label}</h1>
      </div>
      <p className="mb-4 text-[15px] text-ink-soft">{typology.description}</p>

      <ImageFrame
        className="mb-4"
        slot={slot}
        alt={`${typology.label} — תמונה להמחשה`}
        hasImage={slots.includes(slot)}
        canEdit={admin}
        ratio="16 / 9"
        emptyLabel="אין עדיין תמונה לסוג הזה"
      />

      <Card>
        <p className="mb-2 text-[15px] font-medium text-ink">אב הטיפוס במספרים</p>
        {/*
          לכל ערך ייחוס האייקון של הקריטריון שהוא מודד — אותו אייקון בדיוק
          שמופיע בעמוד הקריטריונים, כדי שהזיכרון החזותי יעבוד בין המסכים.
          הבולט הוא הנתון: כאן משווים מספרים, לא לומדים מה נמדד.
        */}
        <dl className="grid grid-cols-2 gap-x-3 gap-y-3 [&_svg]:h-4 [&_svg]:w-4">
          {(
            [
              ["רוחב זכות דרך", typology.benchmarks.rowWidth, "row_width"],
              ["חלק המדרכה", typology.benchmarks.sidewalk, "row_split"],
              ["יחס רוחב לגובה", typology.benchmarks.ratio, "proportions"],
              ["מפגש עם הרחוב", typology.benchmarks.frontage, "plot_street_meeting"],
              ["בניינים ל-100 מ'", typology.benchmarks.buildings, "building_rhythm"],
              ["חופת עצים", typology.benchmarks.canopy, "tree_canopy"],
              ["מרחק בין צמתים", typology.benchmarks.intersections, "intersection_density"],
            ] as [string, string, CriterionKey][]
          ).map(([label, value, criterionKey]) => {
            const Mark = CRITERION_ICONS[criterionKey];
            return (
              <Datum key={label} label={label} value={value} icon={<Mark />} />
            );
          })}
        </dl>
        <p className="mt-2 text-[13px] text-ink-faint">
          כל אב טיפוס נגזר משלושה רחובות בלבד — כיוון, לא תקן. מקור: מינהל
          התכנון, &quot;הרחובות הטובים&quot;, 2026, עמ&apos; 9 ופרקי הטיפולוגיות.
        </p>
      </Card>

      <section className="mt-5">
        <h2 className="mb-2 text-[17px] font-semibold text-ink">
          דוגמאות לרחובות מהסוג הזה
        </h2>
        {typeExamples.length === 0 ? (
          <p className="text-[14px] text-ink-faint">
            המסמך אינו מסווג את רחובות הדוגמה שלו לטיפולוגיות, ולכן אין כאן עדיין
            דוגמה לסוג הזה.{" "}
            <Link
              href="/examples"
              className="inline-link text-accent underline underline-offset-2"
            >
              כל הדוגמאות
            </Link>
          </p>
        ) : (
          <>
            <ul className="grid gap-3">
              {typeExamples.map((example) => (
                <li key={example.key} className="card overflow-hidden p-0">
                  <Link href={`/examples?criterion=${example.key}`} className="block">
                    <span className="relative block aspect-[16/9] overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/examples/${example.key}.jpg`}
                        alt={example.place}
                        className="h-full w-full object-cover"
                      />
                      <span className="photo-scrim" aria-hidden="true" />
                      <span className="absolute inset-x-0 bottom-0 px-3 pb-2 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
                        <span className="block text-[17px] font-bold leading-tight">
                          {example.place.split(" — ")[0]}
                        </span>
                        <span className="block text-[12px] opacity-90">
                          {example.title}
                        </span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[13px]">
              <Link
                href={`/examples?typology=${typology.key}`}
                className="inline-link text-accent underline underline-offset-2"
              >
                לראות אותן בספריית הדוגמאות, עם המספרים
              </Link>
            </p>
          </>
        )}
      </section>

      <PrevNext
        prev={prev ? { href: `/learn/types/${prev.key}`, label: prev.label } : undefined}
        next={next ? { href: `/learn/types/${next.key}`, label: next.label } : undefined}
      />
    </>
  );
}
