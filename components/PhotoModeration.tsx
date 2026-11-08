"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PhotoStatus } from "@/lib/types";

interface Item {
  id: string;
  streetId: string;
  streetName: string;
  createdAt: string;
  /** What the resident wrote with the vote the photo came with, if anything. */
  reason?: string;
  status?: PhotoStatus;
  /** מרכז הרחוב [lon, lat], לקישור ל-Street View. */
  center?: [number, number] | null;
}

/*
 * קישור ל-Google Street View באותו רחוב (ענת, 08.11.2026, סעיף 8): כשתמונת
 * התושב אינה טובה, הצוות רואה את הרחוב עצמו לפני שהוא מחליט, ויכול לצלם
 * ממנו תמונה חלופית.
 */
export function streetViewUrl(name: string, center?: [number, number] | null): string {
  return center
    ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${center[1]},${center[0]}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, אשדוד`)}`;
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
            {/*
              התמונה כולה, בלי חיתוך (ענת, סעיף 22): אי אפשר לאשר תמונה
              שרואים רק חלק ממנה. לחיצה פותחת אותה בגודל מלא בלשונית חדשה.
            */}
            <a
              href={`/api/photos/${photo.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-paper"
              aria-label={`פתיחת התמונה מ${photo.streetName} בגודל מלא`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/photos/${photo.id}`}
                alt={`תמונה מהרחוב ${photo.streetName}`}
                className="mx-auto block h-auto max-h-[70vh] w-full object-contain"
              />
            </a>
            <div className="p-3">
              <p className="text-[15px] font-medium text-ink">
                <a href={`/street/${photo.streetId}`} className="inline-link underline underline-offset-2">
                  {photo.streetName}
                </a>
              </p>
              <p className="text-[13px] text-ink-faint">
                הועלתה ב־{hebrewDate(photo.createdAt)}
                {decided && photo.status ? ` · ${STATUS_LABEL[photo.status]}` : ""}
              </p>
              {/* The words that came with the photo are part of the decision. */}
              {photo.reason ? (
                <p className="mb-3 mt-1 border-e-2 border-line pe-2 text-[14px] text-ink-soft">
                  {photo.reason}
                </p>
              ) : (
                <p className="mb-3 mt-1 text-[13px] text-ink-faint">
                  התמונה הועלתה בלי נימוק.
                </p>
              )}

              <p className="mb-2 flex flex-wrap gap-x-4">
                <a
                  href={`/api/photos/${photo.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center text-[14px] text-accent underline underline-offset-2"
                >
                  לפתוח בגודל מלא
                </a>
                <a
                  href={streetViewUrl(photo.streetName, photo.center)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center text-[14px] text-accent underline underline-offset-2"
                >
                  לראות את {photo.streetName} ב-Street View
                </a>
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy === photo.id || photo.status === "approved"}
                  onClick={() => moderate(photo.id, "approved")}
                  className="min-h-11 flex-1 rounded-[10px] bg-accent px-4 py-2 text-[15px] text-white disabled:opacity-40"
                >
                  {photo.status === "approved" ? "מאושרת" : "אישור"}
                </button>
                <button
                  type="button"
                  disabled={busy === photo.id || photo.status === "rejected"}
                  onClick={() => moderate(photo.id, "rejected")}
                  className="min-h-11 flex-1 rounded-[10px] border border-line px-4 py-2 text-[15px] text-ink disabled:opacity-40"
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
