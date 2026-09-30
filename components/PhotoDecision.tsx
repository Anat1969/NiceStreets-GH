"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PhotoSource, PhotoStatus } from "@/lib/types";

/**
 * מצב התמונה, כתווית אחת שקוראים במבט.
 *
 * קודם לכן הופיעו זה לצד זה "מאושרת", "אישור" ו"דחייה" בשלושה שבבים
 * דומים — ואי אפשר היה לדעת מה מהם מצב ומה מהם כפתור. כאן המצב הוא
 * תווית עם צבע משלה, והפעולות הן כפתורים נפרדים מתחת לתמונה.
 */
const STATE = {
  approved: { label: "מאושרת ומוצגת", className: "bg-[#14603F] text-white" },
  pending: { label: "ממתינה לאישור", className: "bg-[#96690F] text-white" },
  rejected: { label: "נדחתה", className: "bg-[#862f27] text-white" },
} as const;

export function PhotoStatusBadge({
  status,
  source,
}: {
  status: PhotoStatus;
  source?: PhotoSource;
}) {
  const state = STATE[status];
  return (
    <span className="flex flex-col items-end gap-1">
      <span
        className={`rounded-full px-2.5 py-1 text-[12px] font-semibold shadow-sm ${state.className}`}
      >
        {state.label}
      </span>
      {source && source !== "resident" ? (
        <span className="rounded-full bg-ink/75 px-2 py-[2px] text-[11px] text-white">
          {source === "example" ? "דוגמה של האגף" : "בדיקה, לא לציבור"}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Approve or reject a single photo, where the photo already is.
 *
 * The queue is for working through a backlog; this is for the moment someone
 * is looking at a street and sees a photo that should not be there. Same
 * endpoint, same permission check on the server.
 */
export default function PhotoDecision({
  photoId,
  status,
}: {
  photoId: string;
  status: PhotoStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(next: PhotoStatus) {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/admin/photos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ photoId, status: next }),
    });
    setBusy(false);
    if (response.ok) {
      router.refresh();
      return;
    }
    const data = await response.json().catch(() => ({}));
    setError(data.error ?? "העדכון נכשל.");
  }

  return (
    <div>
      <p className="mb-2 text-[12px] font-semibold text-ink-faint">הכרעת הצוות</p>
      <div className="flex gap-2">
        {/*
          פועל מפורש ולא שם עצם: "לאשר לפרסום" אומר מה יקרה בלחיצה,
          בעוד "אישור" אפשר לקרוא גם כשם של מצב. הכפתור של הפעולה
          שכבר בוצעה מושבת ומסומן, כך שהמצב ברור בלי תווית נוספת.
        */}
        <button
          type="button"
          disabled={busy || status === "approved"}
          onClick={() => decide("approved")}
          className="pressable flex-1 rounded-[10px] bg-accent px-3 py-2 text-[14px] font-medium text-white disabled:cursor-default disabled:bg-accent-soft disabled:text-accent"
        >
          {status === "approved" ? "מאושרת ✓" : "לאשר לפרסום"}
        </button>
        <button
          type="button"
          disabled={busy || status === "rejected"}
          onClick={() => decide("rejected")}
          className="pressable flex-1 rounded-[10px] border border-warm px-3 py-2 text-[14px] font-medium text-warm disabled:cursor-default disabled:border-line disabled:text-ink-faint"
        >
          {status === "rejected" ? "נדחתה ✓" : "להסיר מהאתר"}
        </button>
      </div>
      <p className="mt-1 text-[12px] text-ink-faint">
        {status === "approved"
          ? "התמונה גלויה לכל מי שנכנס לרחוב."
          : status === "rejected"
            ? "התמונה אינה מוצגת לציבור. אפשר לאשר אותה בחזרה."
            : "התמונה עדיין אינה מוצגת לציבור."}
      </p>
      {error ? (
        <p role="alert" className="mt-1 text-[12px] text-warm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
