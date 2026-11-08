import ChooseFlow from "@/components/ChooseFlow";
import { QUESTIONS, TYPOLOGIES, TYPOLOGY_MAP, criteriaForQuestion } from "@/lib/city";
import { CANONICAL_STREETS, STREET_REGISTRY_SOURCE } from "@/lib/streets";
import { getStore } from "@/lib/store";
import { isCrossingStreet, segmentQuarters } from "@/lib/segments";
import { imageSlot } from "@/lib/content-images";
import { GIS_TYPOLOGY } from "@/lib/gis-typology.generated";

export const dynamic = "force-dynamic";

export default async function ChoosePage({
  searchParams,
}: {
  searchParams: Promise<{ street?: string; quarter?: string }>;
}) {
  const { street: streetCode, quarter: quarterParam } = await searchParams;
  // Street types are staff knowledge; the flow shows them read-only, so the
  // page carries the assignments already made.
  const store = getStore();
  const [known, imageSlots] = await Promise.all([
    store.listStreets().catch(() => []),
    store.listContentImageSlots().catch(() => [] as string[]),
  ]);
  const hasImage = new Set(imageSlots);
  const byCode = new Map(known.filter((s) => s.code).map((s) => [s.code as string, s]));

  /*
   * סיווג הצוות גובר תמיד. בלעדיו — הערכה משכבת הרחובות העירונית
   * (scripts/build-gis-typology.mjs), שמוצגת לתושב כהערכה ולא כעובדה.
   */
  const options = CANONICAL_STREETS.map((s) => {
    const row = byCode.get(s.code);
    const staffType = row?.typology ?? null;
    const gisType = GIS_TYPOLOGY[s.code] ?? null;
    return {
      code: s.code,
      name: s.name,
      synonyms: s.synonyms,
      typology: staffType ?? gisType,
      typologySource: (staffType ? "staff" : gisType ? "gis" : null) as "staff" | "gis" | null,
      crossing: isCrossingStreet(s.code),
      center: row?.center ?? null,
    };
  });

  const quarters = segmentQuarters();

  // A code that no longer exists simply opens the normal search, never an error.
  const initialStreet = streetCode
    ? (options.find((s) => s.code === streetCode) ?? null)
    : null;

  return (
    <ChooseFlow
      streets={options}
      segmentQuarters={quarters}
      initialStreet={initialStreet}
      initialQuarterId={
        quarterParam && quarters.some((q) => q.id === quarterParam)
          ? quarterParam
          : ""
      }
      typologies={TYPOLOGIES.map((t) => ({
        key: t.key,
        label: t.label,
        description: t.description,
      }))}
      typologyLabels={Object.fromEntries(
        Object.entries(TYPOLOGY_MAP).map(([k, v]) => [k, v.label]),
      )}
      questions={QUESTIONS.map((q) => ({
        key: q.key,
        label: q.label,
        help: q.help,
        criteria: criteriaForQuestion(q.key).map((c) => ({
          key: c.key,
          name: c.name,
          text: c.text,
        })),
        hasImage: hasImage.has(imageSlot("question", q.key)),
      }))}
      registrySource={STREET_REGISTRY_SOURCE}
    />
  );
}
