import Link from "next/link";
import { STATUS_MAP } from "@/lib/city";
import { scoreOutOfTen } from "@/lib/score";
import type { StatusKey } from "@/lib/city";

export function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-1 text-[19px] font-semibold text-ink">{title}</h2>
      {note ? <p className="mb-3 text-[14px] text-ink-soft">{note}</p> : null}
      {children}
    </section>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`card p-4 ${className}`}>{children}</div>;
}

export function StatusBadge({ status }: { status: StatusKey | null }) {
  /*
   * סטטוס שאינו מוכר מתנהג כמו "אין סטטוס", ואינו מפיל את המסך.
   * צמצום הסטטוסים מחמישה לשלושה הותיר בשדה רשומות עם ערך ישן, ובלי
   * השורה הזאת עמוד שלם החזיר שגיאה בגלל מילה אחת בטבלה.
   */
  const meta = status ? STATUS_MAP[status] : undefined;
  if (!meta) {
    return (
      <span className="inline-block rounded-full border border-line px-3 py-1 text-[13px] text-ink-faint">
        טרם התקבל עדכון
      </span>
    );
  }
  return (
    <span
      className="inline-block rounded-full px-3 py-1 text-[13px] font-medium text-white"
      style={{ background: meta.color }}
    >
      {meta.label}
    </span>
  );
}

/**
 * ציון של שאלה אחת, עם האייקון שלה.
 *
 * האייקון קיים לזיכרון חזותי: אותה צורה מופיעה בשאלה בזמן הדירוג,
 * בקריטריון במסך הלימוד ובערך הייחוס של סוג הרחוב. `muted` מציג אותה
 * באפור, לשאלות שאינן נמדדות במסמך.
 */
export function ScoreBar({
  label,
  value,
  max = 5,
  icon,
  muted = false,
}: {
  label: string;
  value: number | null;
  max?: number;
  icon?: React.ReactNode;
  muted?: boolean;
}) {
  const pct = value === null ? 0 : Math.max(0, Math.min(1, value / max)) * 100;
  return (
    <div className="mb-2">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-[14px]">
        <span className="flex items-center gap-2 text-ink">
          {icon ? (
            <span className={muted ? "text-ink-faint" : "text-accent"}>{icon}</span>
          ) : null}
          {label}
        </span>
        <span className="tabular-nums font-semibold text-ink">
          {value === null ? "אין נתונים" : scoreOutOfTen(value)}
        </span>
      </div>
      <div
        className="h-2 w-full rounded-full bg-accent-soft"
        role="img"
        aria-label={`${label}: ${value === null ? "אין נתונים" : `${scoreOutOfTen(value)} מתוך 10`}`}
      >
        <div
          className={`h-2 rounded-full ${muted ? "bg-ink-faint" : "bg-accent"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * מספר אחד עם הכותרת שלו.
 *
 * מספר בלי כותרת אינו אומר דבר, ולכן `label` חובה. `note` הוא ההסבר
 * הקטן מתחתיו — מה בדיוק נספר — ולא מספר נוסף בלי שם.
 */
export function Counter({
  value,
  label,
  note,
}: {
  value: number;
  label: string;
  note?: string;
}) {
  return (
    <div className="card flex-1 p-3 text-center">
      <div className="text-[24px] font-bold tabular-nums text-accent">
        {value.toLocaleString("he-IL")}
      </div>
      <div className="text-[13px] font-medium text-ink">{label}</div>
      {note ? <div className="mt-1 text-[12px] text-ink-faint">{note}</div> : null}
    </div>
  );
}

/**
 * זוג פרמטר–נתון בשורה אחת.
 *
 * הבולט הוא מה שמחפשים: בטבלת השוואה מחפשים את הנתון, ולכן הוא הבולט
 * והפרמטר חיוור. `emphasis="label"` הופך את הסדר, כשהשאלה היא מה נמדד
 * ולא כמה יצא.
 */
export function Datum({
  label,
  value,
  emphasis = "value",
  icon,
}: {
  label: string;
  value: React.ReactNode;
  emphasis?: "value" | "label";
  icon?: React.ReactNode;
}) {
  const labelClass =
    emphasis === "label"
      ? "text-[13px] font-semibold text-ink"
      : "text-[13px] text-ink-faint";
  const valueClass =
    emphasis === "label"
      ? "text-[14px] text-ink-soft"
      : "text-[15px] font-semibold tabular-nums text-ink";
  return (
    <div>
      <dt className={`flex items-center gap-1.5 ${labelClass}`}>
        {icon ? <span className="text-ink-faint">{icon}</span> : null}
        {label}
      </dt>
      <dd className={valueClass}>{value}</dd>
    </div>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "ghost";
}) {
  const style =
    variant === "primary"
      ? "bg-accent text-white"
      : "bg-surface text-ink border border-line";
  return (
    <Link
      href={href}
      className={`pressable flex items-center justify-center rounded-[14px] px-5 py-3 text-[16px] font-medium ${style}`}
    >
      {children}
    </Link>
  );
}

/**
 * אזהרת נתוני הדגמה.
 *
 * כל עוד יש במסד קולות שנזרעו לבדיקה, אסור שמסך ציבורי יציג מספר בלי
 * לומר זאת. הרכיב הזה מופיע בכל מסך שמציג מספרים, ונעלם מעצמו ברגע
 * שנתוני ההדגמה נמחקים — בלי שצריך לזכור להסיר אותו.
 */
export function DemoBanner({
  demoVotes,
  totalVotes,
}: {
  demoVotes: number;
  totalVotes: number;
}) {
  if (demoVotes === 0) return null;
  const real = totalVotes - demoVotes;
  return (
    <p
      role="status"
      className="mb-4 rounded-[12px] border border-warm bg-warm-soft px-3 py-2 text-[13px] text-ink"
    >
      <span className="font-semibold">המספרים כאן אינם אמיתיים עדיין.</span>{" "}
      {demoVotes.toLocaleString("he-IL")} מתוך {totalVotes.toLocaleString("he-IL")}{" "}
      הקולות הם נתוני הדגמה שנזרעו לבדיקה, ורק {real.toLocaleString("he-IL")}{" "}
      {real === 1 ? "קול הוא" : "קולות הם"} של תושבים. הצוות מוחק אותם בלוח
      הבקרה לפני הפתיחה לציבור.
    </p>
  );
}

export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[12px] border border-line bg-warm-soft px-3 py-2 text-[13px] text-ink-soft">
      {children}
    </p>
  );
}
