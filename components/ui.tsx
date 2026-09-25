import Link from "next/link";
import { STATUS_MAP } from "@/lib/city";
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
  if (!status) {
    return (
      <span className="inline-block rounded-full border border-line px-3 py-1 text-[13px] text-ink-faint">
        טרם התקבל עדכון
      </span>
    );
  }
  const meta = STATUS_MAP[status];
  return (
    <span
      className="inline-block rounded-full px-3 py-1 text-[13px] font-medium text-white"
      style={{ background: meta.color }}
    >
      {meta.label}
    </span>
  );
}

export function ScoreBar({
  label,
  value,
  max = 5,
}: {
  label: string;
  value: number | null;
  max?: number;
}) {
  const pct = value === null ? 0 : Math.max(0, Math.min(1, value / max)) * 100;
  return (
    <div className="mb-2">
      <div className="mb-1 flex items-baseline justify-between text-[14px]">
        <span className="text-ink">{label}</span>
        <span className="text-ink-faint tabular-nums">
          {value === null ? "אין נתונים" : value.toFixed(1)}
        </span>
      </div>
      <div
        className="h-2 w-full rounded-full bg-accent-soft"
        role="img"
        aria-label={`${label}: ${value === null ? "אין נתונים" : `${value.toFixed(1)} מתוך ${max}`}`}
      >
        <div className="h-2 rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

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
      <div className="text-[24px] font-semibold tabular-nums text-accent">
        {value.toLocaleString("he-IL")}
      </div>
      <div className="text-[13px] text-ink-soft">{label}</div>
      {note ? <div className="mt-1 text-[12px] text-ink-faint">{note}</div> : null}
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
      className={`flex items-center justify-center rounded-[14px] px-5 py-3 text-[16px] font-medium ${style}`}
    >
      {children}
    </Link>
  );
}

export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[12px] border border-line bg-warm-soft px-3 py-2 text-[13px] text-ink-soft">
      {children}
    </p>
  );
}
