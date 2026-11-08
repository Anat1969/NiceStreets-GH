import { CRITERION_MAP, FAMILY_MAP, type CriterionKey, type FamilyKey } from "@/lib/city";

/*
 * השפה הגרפית של הקריטריונים (ענת, 09.11.2026).
 *
 * שני ממדים, כל אחד בערוץ חזותי משלו, כך שאפשר לקרוא אותם גם בלי צבע:
 *
 * 1. השכבה = צבע + צורה. הצורה נגזרת מהמטאפורה של "החדר העירוני":
 *    שלד   — עיגול, צומת ברשת.            אספלט
 *    חתך   — פס אופקי, הרצפה של החדר.      כורכר
 *    דופן  — מלבן זקוף, הקיר.               ירוק־אגף
 *    מרקם  — עלה, תקרת העצים.               חופה
 *
 * 2. המקור של הקריטריון = מילוי.
 *    מלא         — נמדד בנתונים (GIS).
 *    קו מתאר     — נשאל את התושבים.
 *    קו מקווקו   — עדיין אין לו מקור.
 */

export const FAMILY_COLOR: Record<FamilyKey, string> = {
  skeleton: "var(--asphalt)",
  section: "var(--kurkar)",
  frontage: "var(--brand-500)",
  texture: "var(--canopy)",
};

export type MarkFill = "solid" | "outline" | "dashed";

const SHAPE: Record<FamilyKey, (p: React.SVGProps<SVGElement>) => React.ReactNode> = {
  skeleton: (p) => <circle cx="12" cy="12" r="8" {...(p as React.SVGProps<SVGCircleElement>)} />,
  section: (p) => <rect x="3" y="8" width="18" height="8" rx="1.5" {...(p as React.SVGProps<SVGRectElement>)} />,
  frontage: (p) => <rect x="7" y="3" width="10" height="18" rx="1.5" {...(p as React.SVGProps<SVGRectElement>)} />,
  texture: (p) => (
    <path d="M12 3c5 2 8 6 8 10a8 8 0 0 1-16 0c0-4 3-8 8-10z" {...(p as React.SVGProps<SVGPathElement>)} />
  ),
};

export function FamilyMark({
  family,
  fill = "solid",
  size = 18,
  title,
}: {
  family: FamilyKey;
  fill?: MarkFill;
  size?: number;
  title?: string;
}) {
  const color = FAMILY_COLOR[family];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className="crit-mark"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {SHAPE[family]({
        fill: fill === "solid" ? color : "var(--color-surface)",
        stroke: color,
        strokeWidth: fill === "solid" ? 0 : 2.4,
        strokeDasharray: fill === "dashed" ? "3 2.4" : undefined,
      })}
    </svg>
  );
}

export function criterionFill(key: CriterionKey): MarkFill {
  const kind = CRITERION_MAP[key]?.link.kind;
  return kind === "gis" ? "solid" : kind === "question" ? "outline" : "dashed";
}

/** סימן + שם של קריטריון אחד. */
export function CriterionTag({ criterion, size = 16 }: { criterion: CriterionKey; size?: number }) {
  const c = CRITERION_MAP[criterion];
  if (!c) return null;
  return (
    <span className="crit-tag" data-family={c.familyKey}>
      <FamilyMark family={c.familyKey} fill={criterionFill(criterion)} size={size} />
      {c.name}
    </span>
  );
}

/** המקרא: ארבע הצורות ושלושת סוגי המילוי. */
export function CriteriaLegend() {
  return (
    <div className="crit-legend" aria-label="מקרא הקריטריונים">
      <p className="crit-legend-row">
        {(Object.keys(FAMILY_COLOR) as FamilyKey[]).map((f) => (
          <span key={f}>
            <FamilyMark family={f} />
            {FAMILY_MAP[f]?.title}
          </span>
        ))}
      </p>
      <p className="crit-legend-row">
        <span>
          <FamilyMark family="skeleton" fill="solid" /> נמדד בנתונים
        </span>
        <span>
          <FamilyMark family="skeleton" fill="outline" /> נשאל את התושבים
        </span>
        <span>
          <FamilyMark family="skeleton" fill="dashed" /> עדיין בלי מקור
        </span>
      </p>
    </div>
  );
}
