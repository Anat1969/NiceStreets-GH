import Link from "next/link";
import { notFound } from "next/navigation";
import { EXAMPLES, TYPOLOGIES, TYPOLOGY_MAP } from "@/lib/city";
import type { TypologyKey } from "@/lib/city";
import { TYPOLOGY_ICONS } from "@/components/icons";
import { BackLink, PrevNext } from "@/components/learn-nav";
import { Card } from "@/components/ui";

export function generateStaticParams() {
  return TYPOLOGIES.map((typology) => ({ type: typology.key }));
}

export default async function TypePage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type: key } = await params;
  const typology = TYPOLOGY_MAP[key as TypologyKey];
  if (!typology) notFound();

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
      <p className="mb-5 text-[15px] text-ink-soft">{typology.description}</p>

      <Card>
        <p className="mb-2 text-[15px] font-medium text-ink">ערכי ייחוס</p>
        <dl className="grid grid-cols-3 gap-2 text-[13px]">
          <div>
            <dt className="text-ink-faint">רוחב זכות דרך</dt>
            <dd className="text-ink">{typology.benchmarks.rowWidth}</dd>
          </div>
          <div>
            <dt className="text-ink-faint">יחס גובה־רוחב</dt>
            <dd className="text-ink">{typology.benchmarks.ratio}</dd>
          </div>
          <div>
            <dt className="text-ink-faint">חופת עצים</dt>
            <dd className="text-ink">{typology.benchmarks.canopy}</dd>
          </div>
        </dl>
        <p className="mt-2 text-[13px] text-ink-faint">
          טווחי עבודה לצורך השוואה, לא תקן מחייב.
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
