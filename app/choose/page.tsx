import ChooseFlow from "@/components/ChooseFlow";
import { QUARTERS, QUESTIONS, TYPOLOGIES } from "@/lib/city";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ChoosePage() {
  // A data-layer failure must not blank the screen: residents can still type a
  // street name, which is stored for the staff to match against the GIS layer.
  const streets = await getStore()
    .listStreets()
    .catch(() => []);
  return (
    <ChooseFlow
      streets={streets.map((s) => ({
        id: s.id,
        name: s.name,
        quarterId: s.quarterId,
        typology: s.typology,
      }))}
      quarters={QUARTERS.map((q) => ({ id: q.id, name: q.name }))}
      typologies={TYPOLOGIES.map((t) => ({ key: t.key, label: t.label, description: t.description }))}
      questions={QUESTIONS.map((q) => ({ key: q.key, label: q.label, help: q.help }))}
    />
  );
}
