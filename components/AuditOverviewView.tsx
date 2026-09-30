import Link from "next/link";
import { TYPOLOGY_MAP } from "@/lib/city";
import { Notice, Section } from "@/components/ui";
import AuditRunButton from "@/components/AuditRunButton";
import {
  CONFIDENCE_LABELS,
  FAMILY_LABELS,
  GAP_LABELS,
  METHOD_LABELS,
  PROPOSED_STATUS_LABELS,
  STATE_LABELS,
  VERDICT_LABELS,
  fmt,
  targetText,
  type AuditOverview,
  type AuditResult,
  type CriterionRow,
  type StreetAudit,
} from "@/lib/audit";

const VERDICT_TONE: Record<AuditResult["verdict"], string> = {
  meets: "text-accent",
  partial: "text-ink",
  below: "text-warm font-semibold",
  no_data: "text-ink-faint",
};

function dateText(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "numeric" });
}

function counts(audit: StreetAudit) {
  const pub = audit.results.filter((r) => !r.staff_only);
  return {
    meets: pub.filter((r) => r.verdict === "meets").length,
    partial: pub.filter((r) => r.verdict === "partial").length,
    below: pub.filter((r) => r.verdict === "below").length,
    noData: audit.results.filter((r) => r.verdict === "no_data").length,
    gaps: audit.results.filter(
      (r) => r.gap_class === "residents_higher" || r.gap_class === "residents_lower",
    ).length,
  };
}

/** The staff audit screen. Pure: takes the loaded overview, renders it. */
export default function AuditOverviewView({ overview }: { overview: AuditOverview }) {
  const { criteria, latest, streets, error } = overview;

  const byStreet = new Map(latest.map((a) => [a.street_id, a]));
  const criterionMap = new Map(criteria.map((c) => [c.id, c]));

  // ------------------------------------------------ the data gaps, city-wide
  const noGeom = streets.filter((s) => !s.hasGeom);
  const noTypology = streets.filter((s) => !s.typology);
  const withData = new Set(
    latest.flatMap((a) => a.results.filter((r) => r.value !== null).map((r) => r.criterion_id)),
  );
  const neverMeasured = criteria.filter((c) => !withData.has(c.id));
  const byNeed = {
    gis: neverMeasured.filter((c) => (c.method === "gis" || c.method === "remote_sensing") && c.automation_level !== "D"),
    registry: neverMeasured.filter((c) => c.method === "registry"),
    resident: neverMeasured.filter((c) => c.method === "resident" && c.automation_level !== "D"),
    open: neverMeasured.filter((c) => c.automation_level === "D"),
  };
  const enoughVotes = latest.filter((a) => !a.warnings.some((w) => w.code === "few_votes")).length;
  const residentGaps = latest.flatMap((a) =>
    a.results
      .filter((r) => r.gap_class === "residents_higher" || r.gap_class === "residents_lower")
      .map((r) => ({ audit: a, result: r })),
  );
  const placeholder = criteria.some((c) => c.placeholder);

  const ordered = [...streets].sort((a, b) => {
    const A = byStreet.get(a.id);
    const B = byStreet.get(b.id);
    const rank = (x?: StreetAudit) => (!x ? 3 : x.state === "draft" ? 0 : x.state === "blocked" ? 1 : 2);
    return rank(A) - rank(B) || a.name.localeCompare(b.name, "he");
  });

  return (
    <>
      <p className="mb-2 text-[14px]">
        <Link href="/admin" className="inline-link underline underline-offset-2">
          חזרה ללוח הבקרה
        </Link>
      </p>
      <h1 className="mb-1 text-[24px] font-bold text-ink">בדיקה אוטומטית של רחובות</h1>
      <p className="mb-4 text-[14px] text-ink-soft">
        המערכת מודדת ומנסחת טיוטה; הצוות רק מאשר. כל הרצה נשמרת כגרסה חדשה,
        שום דבר לא נדרס, ושום דבר לא מגיע לציבור בלי אישור של איש צוות.
      </p>

      {error ? (
        <div role="alert" className="mb-4 rounded-[12px] border border-warm bg-warm-soft px-3 py-2 text-[14px] text-ink">
          טעינת הבדיקה נכשלה: {error}
        </div>
      ) : null}

      {placeholder ? (
        <Notice>
          הקריטריונים וערכי היעד הם זמניים: הם נלקחו מטבלת הטיפולוגיות במסמך
          (lib/city.ts) וממתינים לרשימה הרשמית של 12 הקריטריונים ויעדיהם לכל סוג
          רחוב.
        </Notice>
      ) : null}

      <div className="my-4">
        <AuditRunButton label="הרצת בדיקה לכל הרחובות" />
      </div>

      <Section
        title="מה חסר כדי שהבדיקה תעבוד"
        note="הפערים בנתונים, ברמת העיר. כל עוד קיימת שגיאה, הרחוב חסום ואין טיוטה לאישור."
      >
        <ul className="grid gap-2 text-[15px] text-ink">
          <GapLine
            bad={noGeom.length > 0}
            title={`${noGeom.length} מתוך ${streets.length} רחובות בלי גיאומטריה`}
            text="זו השגיאה שחוסמת כרגע את כל הטיוטות. נפתרת בשלב 1: טעינת קווי האמצע של הרחובות משכבת ה-GIS העירונית."
          />
          <GapLine
            bad={noTypology.length > 0}
            title={`${noTypology.length} רחובות בלי סוג רחוב`}
            text={noTypology.length ? `חסר ל: ${noTypology.map((s) => s.name).join(", ")}. נקבע בכרטיס הרחוב.` : "לכל הרחובות נקבע סוג."}
          />
          <GapLine
            bad={byNeed.gis.length > 0}
            title={`${byNeed.gis.length} מדדים שצריכים שכבת GIS שעדיין לא נטענה`}
            text={byNeed.gis.map((c) => `${c.name_he} (${c.source})`).join(" · ") || "—"}
          />
          <GapLine
            bad={byNeed.registry.length > 0}
            title="נתוני מוקד 106 לרחובות"
            text={
              byNeed.registry.length
                ? "במאגר של מוקד 106 אין עדיין קבצים חודשיים, ולכן תחזוקה וביטחון מסומנים 'אין נתון'. המספרים האלה לצוות בלבד ולעולם אינם מוצגים לציבור."
                : "נטענו."
            }
          />
          <GapLine
            bad={enoughVotes < streets.length}
            title={`${enoughVotes} מתוך ${streets.length} רחובות עם 10 דירוגים אמיתיים ומעלה`}
            text="מתחת ל-10 דירוגים (בלי נתוני הדגמה) אין השוואה בין המדידה לתושבים."
          />
          <GapLine
            bad={byNeed.open.length > 0}
            title={`${byNeed.open.length} קריטריונים בלי מקור נתונים שנקבע`}
            text={byNeed.open.map((c) => `${c.name_he} — ${c.source}`).join(" · ") || "—"}
          />
        </ul>
      </Section>

      <Section
        title="פערים בין המדידה לדירוג התושבים"
        note="כשהמדידה אומרת דבר אחד והתושבים אחר — זה המקום לבדיקת שטח."
      >
        {residentGaps.length === 0 ? (
          <p className="text-[14px] text-ink-soft">
            אין כרגע פערים שאפשר לקבוע: פער נבדק רק כשיש גם מדידה וגם 10 דירוגים
            אמיתיים לפחות באותו רחוב.
          </p>
        ) : (
          <ul className="grid gap-2 text-[15px]">
            {residentGaps.map(({ audit, result }) => {
              const street = streets.find((s) => s.id === audit.street_id);
              return (
                <li key={`${audit.id}-${result.criterion_id}`} className="card p-3">
                  <span className="font-semibold">{street?.name}</span> ·{" "}
                  {criterionMap.get(result.criterion_id)?.name_he}: המדידה{" "}
                  {VERDICT_LABELS[result.verdict]}, התושבים {fmt(result.resident_avg)} מתוך 5
                  ({result.resident_n}) — {GAP_LABELS[result.gap_class]}.
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="רחובות" note="טיוטות ממתינות קודם, אחריהן רחובות חסומים.">
        <div className="grid gap-3">
          {ordered.map((street) => (
            <StreetCard
              key={street.id}
              street={street}
              audit={byStreet.get(street.id)}
              criteria={criteria}
            />
          ))}
        </div>
      </Section>
    </>
  );
}

function GapLine({ bad, title, text }: { bad: boolean; title: string; text: string }) {
  return (
    <li className={`rounded-[12px] border px-3 py-2 ${bad ? "border-warm bg-warm-soft" : "border-line bg-surface"}`}>
      <p className="font-semibold">
        {bad ? "חסר: " : "תקין: "}
        {title}
      </p>
      <p className="mt-1 text-[14px] text-ink-soft">{text}</p>
    </li>
  );
}

function StreetCard({
  street,
  audit,
  criteria,
}: {
  street: { id: string; name: string; typology: string | null };
  audit?: StreetAudit;
  criteria: CriterionRow[];
}) {
  const typology = street.typology ? TYPOLOGY_MAP[street.typology]?.label : "סוג לא נקבע";
  const c = audit ? counts(audit) : null;
  const resultMap = new Map(audit?.results.map((r) => [r.criterion_id, r]) ?? []);
  const families = Object.keys(FAMILY_LABELS) as CriterionRow["family"][];

  return (
    <div className="card p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[17px] font-semibold text-ink">
          <Link href={`/street/${street.id}`} className="underline underline-offset-2">
            {street.name}
          </Link>{" "}
          <span className="text-[14px] font-normal text-ink-soft">· {typology}</span>
        </h3>
        <span className="text-[13px] text-ink-soft">
          {audit
            ? `${STATE_LABELS[audit.state]} · גרסה ${audit.version} · ${dateText(audit.run_at)}`
            : "עוד לא נבדק"}
        </span>
      </div>

      {c ? (
        <p className="mb-2 text-[14px] text-ink">
          עומדים ביעד: {c.meets} · חלקית: {c.partial} · לא עומדים: {c.below} · אין נתון: {c.noData}
          {c.gaps ? ` · פערים מול תושבים: ${c.gaps}` : ""}
        </p>
      ) : null}

      {audit?.errors.length ? (
        <div className="mb-2 rounded-[10px] border border-warm bg-warm-soft px-3 py-2 text-[14px]">
          <p className="font-semibold">שגיאות — חוסמות טיוטה:</p>
          <ul className="mt-1 list-inside list-disc">
            {audit.errors.map((e, i) => (
              <li key={i}>{e.text}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {audit?.warnings.length ? (
        <div className="mb-2 rounded-[10px] border border-line px-3 py-2 text-[14px]">
          <p className="font-semibold">אזהרות — יידרש אישור מפורש בעת האישור:</p>
          <ul className="mt-1 list-inside list-disc text-ink-soft">
            {audit.warnings.map((w, i) => (
              <li key={i}>{w.text}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {audit?.proposed_note_he ? (
        <div className="mb-2 rounded-[10px] bg-accent-soft px-3 py-2 text-[14px] text-ink">
          <p className="font-semibold">
            סטטוס מוצע: {PROPOSED_STATUS_LABELS[audit.proposed_status ?? ""] ?? "—"}
          </p>
          <p className="mt-1">{audit.proposed_note_he}</p>
          <p className="mt-1 text-[12px] text-ink-soft">
            טיוטה אוטומטית ({audit.note_source === "claude" ? "ניסוח Claude" : "תבנית"}) — לא פורסמה.
          </p>
        </div>
      ) : null}

      {audit ? (
        <details className="mb-3">
          <summary className="min-h-11 cursor-pointer py-2 text-[15px] font-medium text-accent">
            טבלת הקריטריונים
          </summary>
          <div className="grid gap-3 md:hidden">
            {families.map((family) => (
              <div key={family}>
                <p className="mb-1 text-[14px] font-semibold text-ink">{FAMILY_LABELS[family]}</p>
                <ul className="grid gap-2">
                  {criteria
                    .filter((cr) => cr.family === family)
                    .map((cr) => {
                      const r = resultMap.get(cr.id);
                      return (
                        <li key={cr.id} className="rounded-[10px] border border-line px-3 py-2 text-[13px]">
                          <p className="flex justify-between gap-2">
                            <span className="text-[14px] text-ink">{cr.name_he}</span>
                            <span className={r ? VERDICT_TONE[r.verdict] : ""}>
                              {r ? VERDICT_LABELS[r.verdict] : "—"}
                            </span>
                          </p>
                          <p className="text-ink-soft">
                            ערך {r?.value !== null && r?.value !== undefined ? `${fmt(r.value)} ${cr.unit}` : "—"} · יעד{" "}
                            {r ? targetText(r.benchmark_min, r.benchmark_max) : "—"}
                            {r && r.verdict !== "no_data" ? ` · ביטחון ${CONFIDENCE_LABELS[r.confidence]}` : ""}
                          </p>
                          <p className="text-ink-faint">
                            {r?.data_source ?? cr.source}
                            {r?.data_date ? ` · ${dateText(r.data_date)}` : ""} · {METHOD_LABELS[cr.method]} · רמה{" "}
                            {cr.automation_level}
                            {r?.staff_only ? " · לצוות בלבד" : ""}
                          </p>
                          {cr.vote_key ? (
                            <p className="text-ink-soft">
                              תושבים: {r?.resident_n ? `${fmt(r.resident_avg)} מתוך 5 (${r.resident_n})` : "0 דירוגים"} · פער:{" "}
                              {r ? GAP_LABELS[r.gap_class] : "—"}
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-line text-right text-ink-soft">
                  <th className="p-2 font-medium">קריטריון</th>
                  <th className="p-2 font-medium">ערך</th>
                  <th className="p-2 font-medium">יעד</th>
                  <th className="p-2 font-medium">הכרעה</th>
                  <th className="p-2 font-medium">ביטחון</th>
                  <th className="p-2 font-medium">מקור ותאריך</th>
                  <th className="p-2 font-medium">תושבים</th>
                  <th className="p-2 font-medium">פער</th>
                </tr>
              </thead>
              {families.map((family) => {
                const rows = criteria.filter((cr) => cr.family === family);
                return (
                  <tbody key={family}>
                    <tr>
                      <th colSpan={8} className="bg-surface p-2 text-right text-[13px] font-semibold text-ink">
                        {FAMILY_LABELS[family]}
                      </th>
                    </tr>
                    {rows.map((cr) => {
                      const r = resultMap.get(cr.id);
                      return (
                        <tr key={cr.id} className="border-b border-line align-top">
                          <td className="p-2">
                            <span className="text-ink">{cr.name_he}</span>
                            <span className="block text-[12px] text-ink-faint">
                              {METHOD_LABELS[cr.method]} · רמה {cr.automation_level}
                              {r?.staff_only ? " · לצוות בלבד" : ""}
                            </span>
                          </td>
                          <td className="p-2 whitespace-nowrap">
                            {r?.value !== null && r?.value !== undefined ? `${fmt(r.value)} ${cr.unit}` : "—"}
                          </td>
                          <td className="p-2 whitespace-nowrap">
                            {r ? targetText(r.benchmark_min, r.benchmark_max) : "—"}
                          </td>
                          <td className={`p-2 ${r ? VERDICT_TONE[r.verdict] : ""}`}>
                            {r ? VERDICT_LABELS[r.verdict] : "—"}
                          </td>
                          <td className="p-2">{r && r.verdict !== "no_data" ? CONFIDENCE_LABELS[r.confidence] : "—"}</td>
                          <td className="p-2 text-ink-soft">
                            {r?.data_source ?? cr.source}
                            {r?.data_date ? ` · ${dateText(r.data_date)}` : ""}
                          </td>
                          <td className="p-2 whitespace-nowrap">
                            {cr.vote_key
                              ? r?.resident_n
                                ? `${fmt(r.resident_avg)} (${r.resident_n})`
                                : "0 דירוגים"
                              : "—"}
                          </td>
                          <td className="p-2">{r ? GAP_LABELS[r.gap_class] : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                );
              })}
            </table>
          </div>
        </details>
      ) : null}

      <AuditRunButton streetId={street.id} label={audit ? "הרצה מחדש לרחוב הזה" : "בדיקת הרחוב הזה"} variant="quiet" />
    </div>
  );
}
