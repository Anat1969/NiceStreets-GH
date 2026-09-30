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

  return (
    <div className="px-2 pb-2">
      <div className="flex gap-1">
        <button
          type="button"
          disabled={busy || status === "approved"}
          onClick={() => decide("approved")}
          className="min-h-0 flex-1 rounded-[8px] bg-accent px-2 py-2 text-[13px] text-white disabled:opacity-40"
        >
          {status === "approved" ? "מאושרת" : "אישור"}
        </button>
        <button
          type="button"
          disabled={busy || status === "rejected"}
          onClick={() => decide("rejected")}
          className="min-h-0 flex-1 rounded-[8px] border border-line px-2 py-2 text-[13px] text-ink disabled:opacity-40"
        >
          {status === "rejected" ? "נדחתה" : "דחייה"}
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
