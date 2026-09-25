import ChooseFlow from "@/components/ChooseFlow";
import { QUESTIONS, TYPOLOGIES, TYPOLOGY_MAP } from "@/lib/city";
import { CANONICAL_STREETS, STREET_REGISTRY_SOURCE } from "@/lib/streets";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ChoosePage() {
  // Street types are staff knowledge; the flow shows them read-only, so the
  // page carries the assignments already made.
  const known = await getStore()
    .listStreets()
    .catch(() => []);
  const typologyByCode = Object.fromEntries(
    known
      .filter((s) => s.code && s.typology)
      .map((s) => [s.code as string, s.typology as string]),
  );

  return (
    <ChooseFlow
      streets={CANONICAL_STREETS.map((s) => ({
        code: s.code,
        name: s.name,
        synonyms: s.synonyms,
        typology: typologyByCode[s.code] ?? null,
      }))}
      typologies={TYPOLOGIES.map((t) => ({
        key: t.key,
        label: t.label,
        description: t.description,
      }))}
      typologyLabels={Object.fromEntries(
        Object.entries(TYPOLOGY_MAP).map(([k, v]) => [k, v.label]),
      )}
      questions={QUESTIONS.map((q) => ({ key: q.key, label: q.label, help: q.help }))}
      registrySource={STREET_REGISTRY_SOURCE}
    />
  );
}
