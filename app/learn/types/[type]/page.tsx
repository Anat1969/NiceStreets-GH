import Link from "next/link";
import { notFound } from "next/navigation";
import { EXAMPLES, TYPOLOGIES, TYPOLOGY_MAP } from "@/lib/city";
import type { TypologyKey } from "@/lib/city";
import { TYPOLOGY_ICONS } from "@/components/icons";
import { BackLink, PrevNext } from "@/components/learn-nav";
import { Card } from "@/components/ui";
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
  const hasExamples = EXAMPLES.some((e) => e.typology === typology.key);

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
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[13px]">
          {[
            ["רוחב זכות דרך", typology.benchmarks.rowWidth],
            ["חלק המדרכה", typology.benchmarks.sidewalk],
            ["יחס רוחב לגובה", typology.benchmarks.ratio],
            ["מפגש עם הרחוב", typology.benchmarks.frontage],
            ["בניינים ל-100 מ'", typology.benchmarks.buildings],
            ["חופת עצים", typology.benchmarks.canopy],
            ["מרחק בין צמתים", typology.benchmarks.intersections],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-ink-faint">{label}</dt>
              <dd className="text-ink">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-[13px] text-ink-faint">
          כל אב טיפוס נגזר משלושה רחובות בלבד — כיוון, לא תקן. מקור: מינהל
          התכנון, &quot;הרחובות הטובים&quot;, 2026, עמ&apos; 9 ופרקי הטיפולוגיות.
        </p>
      </Card>

      <p className="mt-3 text-[13px]">
        {hasExamples ? (
          <Link
            href={`/examples?typology=${typology.key}`}
            className="inline-link text-accent underline underline-offset-2"
          >
            דוגמאות לרחובות מהסוג הזה
          </Link>
        ) : (
          <span className="text-ink-faint">אין עדיין דוגמה בספרייה לסוג הזה.</span>
        )}
      </p>

      <PrevNext
        prev={prev ? { href: `/learn/types/${prev.key}`, label: prev.label } : undefined}
        next={next ? { href: `/learn/types/${next.key}`, label: next.label } : undefined}
      />
    </>
  );
}
