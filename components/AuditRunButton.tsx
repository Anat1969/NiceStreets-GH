"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * כפתור שמריץ את הבדיקה האוטומטית — לרחוב אחד או לכל הרחובות.
 * כל הרצה נשמרת כגרסה חדשה; שום דבר לא נדרס ושום דבר לא מתפרסם לציבור.
 */
export default function AuditRunButton({
  streetId,
  label,
  variant = "primary",
}: {
  streetId?: string;
  label: string;
  variant?: "primary" | "quiet";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/admin/audit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(streetId ? { streetId } : { all: true }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    setMessage(
      response.ok
        ? data.count === 1
          ? "הבדיקה הסתיימה. התוצאה למטה."
          : `נבדקו ${data.count} רחובות. התוצאות למטה.`
        : (data.error ?? "הבדיקה נכשלה."),
    );
    router.refresh();
  }

  const style =
    variant === "primary"
      ? "bg-accent text-white"
      : "border border-line bg-surface text-ink";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className={`min-h-11 rounded-[14px] px-4 py-2 text-[15px] font-medium disabled:opacity-60 ${style}`}
      >
        {busy ? "בודקים…" : label}
      </button>
      {message ? (
        <p role="status" className="text-[14px] text-ink-soft">
          {message}
        </p>
      ) : null}
    </div>
  );
}
