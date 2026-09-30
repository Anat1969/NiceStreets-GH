"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { resizeImage } from "@/lib/image";
import { Camera, MapPin } from "@/components/icons";

/**
 * שתי פעולות שצמודות לגלריה של הרחוב, ומשתנות לפי המכשיר.
 *
 * בנייד: פתיחת המצלמה האחורית ישירות (capture="environment"), צילום,
 * ושמירה מיד לתור האישור של הרחוב הזה. זה הרגע שבו התושב עומד ברחוב —
 * לשלוח אותו למסך הדירוג המלא כדי להוסיף תמונה זה לאבד אותו.
 *
 * במחשב אין מצלמה שימושית, ולכן שם מוצג קישור ל-Google Maps עם שם
 * הרחוב והעיר, כדי לראות את הרחוב ברחוב עצמו.
 *
 * הזיהוי נעשה אחרי הטעינה ולא בשרת: אותו HTML מוגש לשניהם, ורק הלקוח
 * יודע אם יש כאן מצלמה.
 */
export default function StreetPhotoActions({
  streetId,
  streetName,
  city,
}: {
  streetId: string;
  streetName: string;
  city: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const probe = document.createElement("input");
    probe.type = "file";
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    setHasCamera("capture" in probe && coarse);
  }, []);

  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${streetName}, ${city}`,
  )}`;

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const dataUrl = await resizeImage(file, 1600, 0.82);
      const response = await fetch("/api/photos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ streetId, dataUrl }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "השמירה נכשלה");
      }
      setMessage("התמונה נשמרה וממתינה לאישור הצוות. תודה.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "השמירה נכשלה");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="mb-3">
      <div className="flex flex-wrap gap-2">
        {hasCamera !== false ? (
          <label
            className={`pressable flex min-h-11 cursor-pointer items-center gap-2 rounded-[12px] border border-line bg-surface px-3 py-2 text-[14px] text-ink ${
              busy ? "opacity-60" : ""
            }`}
          >
            <Camera />
            <span>{busy ? "שומר…" : "לצלם את הרחוב"}</span>
            <input
              ref={input}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onFile}
              disabled={busy}
              className="sr-only"
            />
          </label>
        ) : null}

        {hasCamera !== true ? (
          <a
            href={mapsHref}
            target="_blank"
            rel="noreferrer noopener"
            className="pressable flex min-h-11 items-center gap-2 rounded-[12px] border border-line bg-surface px-3 py-2 text-[14px] text-ink"
          >
            <MapPin />
            <span>
              {streetName}, {city} ב-Google Maps
            </span>
          </a>
        ) : null}
      </div>

      {message ? (
        <p role="status" className="mt-2 text-[13px] text-accent">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-[13px] text-warm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
