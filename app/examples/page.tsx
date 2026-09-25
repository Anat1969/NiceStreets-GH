import Link from "next/link";
import {
  CRITERIA_FAMILIES,
  CRITERION_MAP,
  EXAMPLES,
  FAMILY_MAP,
  TYPOLOGY_MAP,
  TYPOLOGIES,
} from "@/lib/city";
import type { CriterionKey, TypologyKey } from "@/lib/city";
import { Card, Notice } from "@/components/ui";

export const metadata = { title: "דוגמאות — הרחובות הטובים של אשדוד" };

function label(count: number): string {
  if (count === 0) return "אין דוגמאות שתואמות לסינון";
  if (count === 1) return "דוגמה אחת";
  if (count === 2) return "שתי דוגמאות";
  return `${count} דוגמאות`;
}

export default async function ExamplesPage({
  searchParams,
}: {
  searchParams: Promise<{ criterion?: string; typology?: string }>;
}) {
  const params = await searchParams;

  const criterion =
    params.criterion && params.criterion in CRITERION_MAP
      ? (params.criterion as CriterionKey)
      : "";
  const typology =
    params.typology && params.typology in TYPOLOGY_MAP
      ? (params.typology as TypologyKey)
      : "";

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

      <div className="grid gap-3">
        {results.map((example) => (
          <Card key={example.key}>
            <p className="text-[16px] font-medium text-ink">{example.title}</p>
            <p className="text-[13px] text-ink-faint">{example.place}</p>
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
                    href={`/learn?criterion=${key}`}
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
