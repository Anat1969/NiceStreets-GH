"use client";

import { useEffect, useState } from "react";

/*
 * התמונה שהתושב שלח זה עתה. תמונת תושב מתפרסמת רק אחרי אישור הצוות, ולכן
 * אחרי השמירה המסגרת בדף הרחוב נשארה ריקה — ונראתה כמו העלאה שנכשלה
 * (ענת, 08.11.2026). כאן היא מוצגת לשולח בלבד, מהדפדפן שלו, עם הסבר.
 */
export const pendingPhotoKey = (streetId: string) => `pending-photo:${streetId}`;

export default function MyPendingPhoto({ streetId }: { streetId: string }) {
  const [photo, setPhoto] = useState<{ dataUrl: string; reason: string } | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(pendingPhotoKey(streetId));
      if (raw) setPhoto(JSON.parse(raw));
    } catch {
      /* אין אחסון — אין תצוגה. */
    }
  }, [streetId]);

  if (!photo) return null;
  return (
    <figure className="photo-card mb-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.dataUrl} alt="התמונה ששלחתם" />
      <figcaption>
        {photo.reason ? <p className="resident-voice">{photo.reason}</p> : null}
        <p className="meta">
          <span className="chip chip-pending">ממתינה לאישור</span>
          התמונה נשמרה. היא תופיע לכולם אחרי שצוות האגף יאשר אותה. כרגע רק אתם רואים אותה.
        </p>
      </figcaption>
    </figure>
  );
}
