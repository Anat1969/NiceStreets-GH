"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureResidentSession } from "@/lib/supabase/browser";
import { resizeImage } from "@/lib/image";
import { joinHebrew } from "@/lib/hebrew";
import type { ReportKind } from "@/lib/types";

/**
 * שני המסלולים שבהם תמונה היא חובה — באותו טופס.
 *
 * ההבדל מהדירוג אינו ויזואלי בלבד: כאן כפתור השליחה מושבת עד שיש תמונה,
 * ולידו נכתב למה. השבתה בלי הסבר נראית כמו תקלה, ולכן הטופס אומר מה חסר
 * ומה יקרה אחרי השליחה.
 */
export default function ReportForm({
  kind,
  streetId = null,
  streetName = "",
  quarters,
}: {
  kind: ReportKind;
  streetId?: string | null;
  streetName?: string;
  quarters: { id: string; name: string }[];
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(streetName);
  const [quarterId, setQuarterId] = useState("");
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);

  useEffect(() => {
    const probe = document.createElement("input");
    probe.type = "file";
    setHasCamera("capture" in probe && window.matchMedia("(pointer: coarse)").matches);
  }, []);

  const issue = kind === "issue";

  async function onPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      setPhoto(await resizeImage(file, 1600, 0.82));
    } catch {
      setError("לא הצלחנו לקרוא את התמונה. נסו קובץ אחר.");
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      // כמו בדירוג: הזהות האנונימית נפתחת בדפדפן לפני הכתיבה הראשונה.
      await ensureResidentSession();
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          streetId,
          streetName: name,
          quarterId: quarterId || null,
          body: text,
          dataUrl: photo,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "השליחה נכשלה");
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "השליחה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card p-4">
        <p className="text-[17px] font-semibold text-ink">
          {issue ? "הדיווח נשלח לאגף. תודה." : "ההצעה נשלחה לאגף. תודה."}
        </p>
        <p className="mt-1 text-[14px] text-ink-soft">
          {issue
            ? "הדיווח והתמונה מגיעים לצוות אדריכלות העיר. דיווח אינו קול ואינו משנה את הציון של הרחוב."
            : "הצוות בודק את הרחוב מול רשימת הרחובות הרשמית. אם הוא נוסף, אפשר יהיה לדרג אותו כמו כל רחוב אחר."}
        </p>
      </div>
    );
  }

  const missing = [
    photo ? null : "תמונה",
    issue || name.trim() ? null : "שם רחוב",
    text.trim().length >= 5 ? null : "תיאור של משפט לפחות",
  ].filter((part): part is string => part !== null);
  const ready = missing.length === 0;
  const field =
    "w-full rounded-[12px] border border-line bg-surface px-3 py-3 text-[16px] text-ink";

  return (
    <div className="grid gap-4">
      {error ? (
        <p
          role="alert"
          className="rounded-[12px] border border-warm bg-warm-soft px-3 py-2 text-[14px] text-ink"
        >
          {error}
        </p>
      ) : null}

      {issue ? null : (
        <div>
          <label htmlFor="street-name" className="mb-1 block text-[15px] font-medium text-ink">
            שם הרחוב, כפי שקוראים לו
          </label>
          <input
            id="street-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="למשל: המעבר בין הבתים ברובע ג"
            className={field}
          />
        </div>
      )}

      {issue ? null : (
        <div>
          <label htmlFor="quarter" className="mb-1 block text-[15px] font-medium text-ink">
            באיזה רובע
          </label>
          <select
            id="quarter"
            value={quarterId}
            onChange={(e) => setQuarterId(e.target.value)}
            className={field}
          >
            <option value="">לא יודע</option>
            {quarters.map((q) => (
              <option key={q.id} value={q.id}>
                {q.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label htmlFor="report-body" className="mb-1 block text-[15px] font-medium text-ink">
          {issue ? "מה ראיתם" : "למה כדאי שהרחוב הזה יהיה ברשימה"}
        </label>
        <textarea
          id="report-body"
          value={text}
          maxLength={900}
          rows={5}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            issue
              ? "למשל: המדרכה שבורה לאורך כל הקטע בין הבתים, ואי אפשר לעבור עם עגלה."
              : "משפט או שניים במילים שלכם."
          }
          className={field}
        />
        <p className="mt-1 text-[12px] text-ink-faint">{text.length} מתוך 900</p>
      </div>

      <div>
        <p className="text-[15px] font-medium text-ink">
          {hasCamera ? "צלמו את המקום" : "תמונה של המקום"} — חובה
        </p>
        <p className="text-[14px] text-ink-soft">
          {issue
            ? "התמונה היא הדיווח עצמו: בלעדיה אין לאגף מה לבדוק."
            : "הרחוב אינו ברשימה הרשמית, ולכן התמונה היא מה שמאפשר לצוות לזהות על איזה מקום מדובר."}
        </p>
        <p className="mt-1 text-[13px] text-ink-faint">
          התמונה מוקטנת במכשיר לפני השליחה, נתוני ה־EXIF נמחקים, והיא נשארת אצל הצוות
          ואינה מתפרסמת באתר. אנא הימנעו מצילום פנים ולוחיות רישוי.
        </p>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          {...(hasCamera ? { capture: "environment" as const } : {})}
          onChange={onPhoto}
          className="sr-only"
        />
        {photo ? (
          <div className="mt-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="תצוגה מקדימה" className="max-h-48 rounded-[12px]" />
            <button
              type="button"
              onClick={() => {
                setPhoto(null);
                if (fileInput.current) fileInput.current.value = "";
              }}
              className="mt-2 min-h-11 text-[14px] text-ink-soft underline"
            >
              להחליף תמונה
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="pressable mt-3 w-full rounded-[14px] border-2 border-accent bg-surface px-3 py-3 text-[16px] font-medium text-accent"
          >
            {hasCamera ? "לצלם את המקום" : "לבחור תמונה"}
          </button>
        )}
      </div>

      <button
        type="button"
        disabled={busy || !ready}
        onClick={submit}
        className="pressable rounded-[14px] bg-accent px-5 py-3 text-[16px] font-medium text-white disabled:opacity-40"
      >
        {busy ? "שולח…" : issue ? "לשלוח את הדיווח" : "לשלוח את ההצעה"}
      </button>
      {missing.length > 0 ? (
        <p className="text-[13px] text-ink-faint">כדי לשלוח צריך {joinHebrew(missing)}.</p>
      ) : null}
    </div>
  );
}
