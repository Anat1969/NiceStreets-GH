"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PhotoModeration({
  photos,
}: {
  photos: { id: string; streetId: string; streetName: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function moderate(photoId: string, status: "approved" | "rejected") {
    setBusy(photoId);
    await fetch("/api/admin/photos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ photoId, status }),
    });
    setBusy(null);
    router.refresh();
  }

  if (photos.length === 0) {
    return (
      <div className="card p-4">
        <p className="text-[14px] text-ink-soft">אין תמונות שממתינות לאישור.</p>
      </div>
    );
  }

  return (
    <ul className="grid gap-3">
      {photos.map((photo) => (
        <li key={photo.id} className="card overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/photos/${photo.id}`}
            alt={`תמונה שממתינה לאישור מהרחוב ${photo.streetName}`}
            className="h-48 w-full object-cover"
          />
          <div className="flex items-center gap-2 p-3">
            <span className="flex-1 text-[15px] text-ink">{photo.streetName}</span>
            <button
              type="button"
              disabled={busy === photo.id}
              onClick={() => moderate(photo.id, "approved")}
              className="rounded-[10px] bg-accent px-4 py-2 text-[14px] text-white disabled:opacity-40"
            >
              אישור
            </button>
            <button
              type="button"
              disabled={busy === photo.id}
              onClick={() => moderate(photo.id, "rejected")}
              className="rounded-[10px] border border-line px-4 py-2 text-[14px] text-ink disabled:opacity-40"
            >
              דחייה
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
