"use client";

import { useEffect, useRef, useState } from "react";
import { resizeImage } from "@/lib/image";

/**
 * המסגרת שבה תמונת הרחוב נכנסת — שלוש דרכים להכניס אותה, באותו מקום:
 *
 * 1. בנייד: לצלם. הכפתור פותח את המצלמה האחורית, והתמונה נוחתת במסגרת.
 * 2. במחשב: לגרור קובץ למסגרת, או ללחוץ ולבחור.
 * 3. מ-Google Street View: לחתוך צילום מסך (Win+Shift+S / Cmd+Shift+4)
 *    ולהדביק (Ctrl+V) כשהמסגרת בפוקוס, או בכל מקום בעמוד.
 *
 * התמונה מוקטנת במכשיר ונקייה מ-EXIF (lib/image.ts) לפני שהיא יוצאת ממנו.
 */
export default function PhotoDrop({
  streetName,
  center,
  value,
  onChange,
  label = "תמונה של הרחוב",
  required = false,
}: {
  streetName: string;
  /** [lon, lat]. כשיש — הקישור נפתח ישר על Street View במקום הנכון. */
  center?: [number, number] | null;
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  label?: string;
  required?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    setIsTouch(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  async function take(file: File | null | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("זה לא קובץ תמונה. נסו JPG או PNG.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onChange(await resizeImage(file, 1200, 0.82));
    } catch {
      setError("לא הצלחנו לקרוא את התמונה. נסו קובץ אחר.");
    } finally {
      setBusy(false);
    }
  }

  // הדבקה מכל מקום בעמוד: מי שחתך מ-Street View לא צריך לכוון לשום מקום.
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const item = [...(event.clipboardData?.items ?? [])].find((i) =>
        i.type.startsWith("image/"),
      );
      if (!item) return;
      event.preventDefault();
      void take(item.getAsFile());
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const query = encodeURIComponent(`${streetName}, אשדוד`);
  const mapsUrl = center
    ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${center[1]},${center[0]}`
    : `https://www.google.com/maps/search/?api=1&query=${query}`;

  return (
    <div className="photo-drop-wrap">
      <p className="field-label">
        {label}
        {required ? <span className="req" aria-hidden="true"> *</span> : <span className="opt"> (לא חובה)</span>}
      </p>

      <div
        role="button"
        tabIndex={0}
        aria-label={value ? "החלפת התמונה" : "הוספת תמונה: לגרור, להדביק או ללחוץ לבחירה"}
        className="photo-drop"
        data-over={over || undefined}
        data-filled={value ? "" : undefined}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            input.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void take(e.dataTransfer.files?.[0]);
        }}
      >
        {value ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={value} alt={`התמונה שבחרתם של ${streetName}`} />
        ) : (
          <span className="photo-drop-empty">
            <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
              <path
                d="M4 8h3l2-3h6l2 3h3v11H4z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-[15px] font-semibold text-ink">
              {busy ? "טוען…" : isTouch ? "לחצו כאן לבחירת תמונה" : "גררו לכאן תמונה, או הדביקו (Ctrl+V)"}
            </span>
            {!isTouch ? (
              <span className="text-[13px] text-ink-soft">או לחצו לבחירת קובץ מהמחשב</span>
            ) : null}
          </span>
        )}
      </div>

      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          void take(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          void take(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <div className="photo-drop-actions">
        {isTouch ? (
          <button type="button" className="btn btn-primary" onClick={() => camera.current?.click()}>
            לצלם עכשיו
          </button>
        ) : null}
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
          לפתוח את {streetName} ב-Google Street View
        </a>
        {value ? (
          <button type="button" className="btn btn-quiet" onClick={() => onChange(null)}>
            להסיר את התמונה
          </button>
        ) : null}
      </div>

      {!isTouch ? (
        <ol className="howto">
          <li>פותחים את הרחוב ב-Street View בכפתור למעלה.</li>
          <li>חותכים צילום מסך: Win+Shift+S במחשב Windows, או Cmd+Shift+4 במק.</li>
          <li>חוזרים לכאן ומדביקים עם Ctrl+V. התמונה נכנסת למסגרת.</li>
        </ol>
      ) : null}

      {error ? (
        <p role="alert" className="mt-1 text-[14px] text-warm-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
