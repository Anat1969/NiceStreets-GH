"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { resizeImage } from "@/lib/image";
import { imageSlotUrl } from "@/lib/content-images";

/**
 * המסגרת שבה התמונה אמורה להיות — והיא עצמה כפתור ההעלאה.
 *
 * קודם לכן ההעלאה ישבה בטופס נפרד בלוח הבקרה, והמנהלת הייתה צריכה לזכור
 * לאיזה מקום היא מעלה. כאן המקום הוא המסגרת: רואים איפה חסרה תמונה,
 * לוחצים שם, ומעלים. אין רשימה לבחור ממנה ואין מה לבלבל.
 *
 * לתושב המסגרת היא תמונה רגילה, ואם אין בה תמונה היא פשוט לא מוצגת.
 */
export default function ImageFrame({
  slot,
  alt,
  hasImage,
  canEdit = false,
  ratio = "4 / 3",
  className = "",
  emptyLabel = "אין עדיין תמונה",
  fallbackSrc,
  credit,
  fit = "cover",
  caption,
}: {
  slot: string;
  alt: string;
  hasImage: boolean;
  canEdit?: boolean;
  /**
   * תמונה שנשלחת עם הבנייה ומוצגת כל עוד לא הועלתה אחרת במקומה. כך
   * תמונות שמגיעות ממסמך מקור אינן צריכות לעבור דרך מסד הנתונים, והמנהלת
   * עדיין יכולה להחליף כל אחת מהן באותה מסגרת.
   */
  fallbackSrc?: string;
  /** שורת קרדיט קצרה מתחת לתמונה, כשיש לה מקור חיצוני. */
  credit?: string;
  /**
   * "cover" ממלא את המסגרת וחותך; "contain" מראה את התמונה במלואה.
   * לוגו חייב contain — חיתוך של סמל עירוני אינו עניין של טעם.
   */
  fit?: "cover" | "contain";
  /**
   * כותרת שיושבת על התמונה עצמה, על גרדיאנט שיוצא מתחתית המסגרת. כך שם
   * הרחוב נשאר צמוד לתמונה שלו ולא הופך לשורה נפרדת מתחתיה.
   */
  caption?: React.ReactNode;
  /** יחס הצדדים של המסגרת, כדי שהעמוד לא יקפוץ כשתמונה נטענת. */
  ratio?: string;
  className?: string;
  emptyLabel?: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // משתנה אחרי העלאה כדי לעקוף את הקאש של הדפדפן על אותה כתובת.
  const [version, setVersion] = useState(0);

  const shown = hasImage || Boolean(fallbackSrc);
  if (!shown && !canEdit) return null;

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await resizeImage(file, 1200, 0.82);
      const response = await fetch("/api/admin/content-image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slot, dataUrl, alt }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "ההעלאה נכשלה");
      }
      setVersion((v) => v + 1);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ההעלאה נכשלה");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/admin/content-image", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slot, dataUrl: null }),
    });
    setBusy(false);
    if (response.ok) {
      setVersion((v) => v + 1);
      router.refresh();
    } else {
      setError("ההסרה נכשלה");
    }
  }

  const src = hasImage
    ? `${imageSlotUrl(slot)}${version ? `?v=${version}` : ""}`
    : (fallbackSrc as string);

  const picture = shown ? (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={alt}
      className={`h-full w-full ${fit === "contain" ? "object-contain" : "object-cover"}`}
    />
  ) : (
    <span className="flex h-full w-full items-center justify-center px-3 text-center text-[13px] text-ink-faint">
      {canEdit ? `${emptyLabel} — להעלאה` : emptyLabel}
    </span>
  );

  return (
    <div className={className}>
      <div
        className="relative overflow-hidden rounded-[12px] border border-line bg-paper"
        style={{ aspectRatio: ratio }}
      >
        {canEdit ? (
          <label className="block h-full w-full cursor-pointer">
            <span className="sr-only">
              {shown ? `החלפת התמונה: ${alt}` : `העלאת תמונה: ${alt}`}
            </span>
            <input
              ref={input}
              type="file"
              accept="image/*"
              onChange={onFile}
              disabled={busy}
              className="sr-only"
            />
            {picture}
          </label>
        ) : (
          picture
        )}

        {caption && shown ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0">
            <span className="photo-scrim" aria-hidden="true" />
            <div className="relative px-3 pb-2 pt-10 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
              {caption}
            </div>
          </div>
        ) : null}
      </div>

      {canEdit ? (
        <p className="mt-1 flex items-center gap-2 text-[12px] text-ink-faint">
          <span>{busy ? "מעלה…" : shown ? "לחיצה מחליפה" : "לחיצה מעלה"}</span>
          {hasImage && !busy ? (
            <button
              type="button"
              onClick={remove}
              className="min-h-0 py-1 text-[12px] text-warm underline underline-offset-2"
            >
              הסרה
            </button>
          ) : null}
        </p>
      ) : null}

      {credit && shown ? (
        <p className="mt-1 text-[12px] text-ink-faint">{credit}</p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-1 text-[12px] text-warm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
