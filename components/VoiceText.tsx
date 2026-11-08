"use client";

import { useEffect, useRef, useState } from "react";

/*
 * תיבת הטקסט של התושב, עם אפשרות לדבר במקום להקליד.
 * התמלול נעשה בדפדפן עצמו (Web Speech API, עברית). ב-Chrome, Edge ו-Safari
 * הוא קיים; ב-Firefox לא — ואז הכפתור לא מוצג, והתיבה רגילה.
 * הטקסט מוצג בכתב יד גדול ומושחר, כי הוא הקול של התושב.
 */

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
}

export default function VoiceText({
  id,
  value,
  onChange,
  maxLength = 600,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  placeholder?: string;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const base = useRef("");

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  function start() {
    const w = window as unknown as Record<string, new () => Recognition>;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "he-IL";
    r.continuous = true;
    r.interimResults = true;
    base.current = value ? value.trimEnd() + " " : "";
    r.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interimText += res[0].transcript;
      }
      if (finalText) {
        base.current = (base.current + finalText).slice(0, maxLength);
        onChange(base.current);
      }
      setInterim(interimText);
    };
    r.onerror = (event) => {
      setError(
        event.error === "not-allowed"
          ? "הדפדפן לא קיבל הרשאה למיקרופון. אפשר לאשר בסמל המנעול שבשורת הכתובת."
          : "ההקלטה נעצרה. אפשר לנסות שוב, או להקליד.",
      );
    };
    r.onend = () => {
      setListening(false);
      setInterim("");
    };
    setError(null);
    rec.current = r;
    r.start();
    setListening(true);
  }

  function stop() {
    rec.current?.stop();
  }

  return (
    <div>
      <textarea
        id={id}
        value={listening && interim ? `${value} ${interim}` : value}
        maxLength={maxLength}
        rows={4}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="resident-voice w-full rounded-[12px] border border-line bg-surface px-3 py-3"
      />
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        {supported ? (
          <button
            type="button"
            onClick={listening ? stop : start}
            className={`btn ${listening ? "btn-rec" : "btn-ghost"}`}
            aria-pressed={listening}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke="currentColor" strokeWidth="1.8" />
            </svg>
            {listening ? "לעצור את ההקלטה" : "להקליט במקום להקליד"}
          </button>
        ) : (
          <span />
        )}
        <span className="text-[12px] text-ink-faint">
          {value.length} מתוך {maxLength}
        </span>
      </div>
      {listening ? (
        <p role="status" className="mt-1 text-[13px] text-accent">
          מקליט. דברו בעברית, והטקסט ייכנס לתיבה.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-1 text-[13px] text-warm-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
