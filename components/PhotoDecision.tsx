"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PhotoStatus } from "@/lib/types";

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

  /*
   * פס דק מתחת לתמונה, לא כפתורים בגודל מלא שמשתלטים עליה. התמונה היא
   * מה שבודקים; ההכרעה היא פעולה קטנה שנעשית תוך כדי. הציבור אינו רואה
   * את הרכיב הזה כלל — הוא מוצג רק לצוות ולמנהלת.
   */
  return (
    <div className="border-t border-line bg-paper px-2 py-1">
      <div className="flex items-center gap-2 text-[12px]">
        <span className="flex-1 text-ink-faint">
          {status === "approved"
            ? "מאושרת"
            : status === "rejected"
              ? "נדחתה"
              : "ממתינה"}
        </span>
        <button
          type="button"
          disabled={busy || status === "approved"}
          onClick={() => decide("approved")}
          className="min-h-0 rounded-[6px] px-2 py-1 text-[12px] text-accent underline underline-offset-2 disabled:no-underline disabled:opacity-35"
        >
          אישור
        </button>
        <button
          type="button"
          disabled={busy || status === "rejected"}
          onClick={() => decide("rejected")}
          className="min-h-0 rounded-[6px] px-2 py-1 text-[12px] text-warm underline underline-offset-2 disabled:no-underline disabled:opacity-35"
        >
          דחייה
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-1 text-[12px] text-warm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
