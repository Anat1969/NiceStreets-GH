"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PhotoStatus } from "@/lib/types";

interface Item {
  id: string;
  streetId: string;
  streetName: string;
  createdAt: string;
  status?: PhotoStatus;
}

const STATUS_LABEL: Record<PhotoStatus, string> = {
  pending: "ממתינה לאישור",
  approved: "מאושרת ומוצגת לציבור",
  rejected: "נדחתה, אינה מוצגת",
};

function hebrewDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function PhotoModeration({
  photos,
  decided = false,
}: {
  photos: Item[];
  /** Already approved or rejected: shows the current decision and lets it change. */
  decided?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function moderate(photoId: string, status: PhotoStatus) {
    setBusy(photoId);
    setError(null);
    const response = await fetch("/api/admin/photos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ photoId, status }),
    });
    setBusy(null);
    if (response.ok) router.refresh();
    else {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "העדכון נכשל.");
    }
  }

  if (photos.length === 0) {
    return (
      <div className="card p-4">
        <p className="text-[15px] text-ink">אין תמונות שממתינות לאישור.</p>
        <p className="mt-1 text-[13px] text-ink-soft">
          כשתושב יעלה תמונה חדשה היא תופיע כאן, ולא תוצג לציבור עד שתאושר.
        </p>
      </div>
    );
  }

  return (
    <div>
      <ul className="grid gap-3">
        {photos.map((photo) => (
          <li key={photo.id} className="card overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/photos/${photo.id}`}
              alt={`תמונה מהרחוב ${photo.streetName}`}
              className="h-48 w-full bg-paper object-cover"
            />
            <div className="p-3">
              <p className="text-[15px] font-medium text-ink">{photo.streetName}</p>
              <p className="mb-3 text-[13px] text-ink-faint">
                הועלתה ב־{hebrewDate(photo.createdAt)}
                {decided && photo.status ? ` · ${STATUS_LABEL[photo.status]}` : ""}
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy === photo.id || photo.status === "approved"}
                  onClick={() => moderate(photo.id, "approved")}
                  className="flex-1 rounded-[10px] bg-accent px-4 py-2 text-[15px] text-white disabled:opacity-40"
                >
                  {photo.status === "approved" ? "מאושרת" : "אישור"}
                </button>
                <button
                  type="button"
                  disabled={busy === photo.id || photo.status === "rejected"}
                  onClick={() => moderate(photo.id, "rejected")}
                  className="flex-1 rounded-[10px] border border-line px-4 py-2 text-[15px] text-ink disabled:opacity-40"
                >
                  {photo.status === "rejected" ? "נדחתה" : "דחייה"}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {error ? (
        <p role="alert" className="mt-2 text-[13px] text-warm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
