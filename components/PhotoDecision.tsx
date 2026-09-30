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
   * שבב קטן ושקוף למחצה שיושב על התמונה, לא פס שתופס שורה מתחתיה.
   * התמונה היא מה שבודקים; ההכרעה היא פעולה קטנה שנעשית תוך כדי
   * הסתכלות עליה. הציבור אינו רואה את הרכיב הזה כלל.
   */
  return (
    <div className="flex items-center gap-1 rounded-full bg-ink/70 px-1.5 py-1 backdrop-blur-sm">
      <span className="px-1 text-[11px] text-white/85">
        {status === "approved" ? "מאושרת" : status === "rejected" ? "נדחתה" : "ממתינה"}
      </span>
      <button
        type="button"
        disabled={busy || status === "approved"}
        onClick={() => decide("approved")}
        className="min-h-0 rounded-full bg-white/90 px-2 py-1 text-[11px] font-medium text-ink disabled:opacity-40"
      >
        אישור
      </button>
      <button
        type="button"
        disabled={busy || status === "rejected"}
        onClick={() => decide("rejected")}
        className="min-h-0 rounded-full border border-white/50 px-2 py-1 text-[11px] text-white disabled:opacity-40"
      >
        דחייה
      </button>

      {error ? (
        <span role="alert" className="px-1 text-[11px] text-white">
          {error}
        </span>
      ) : null}
    </div>
  );
}
