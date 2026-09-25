"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="py-10">
      <h1 className="mb-2 text-[24px] font-bold text-ink">משהו השתבש</h1>
      <p className="mb-4 text-[15px] text-ink-soft">
        אירעה תקלה בטעינת העמוד. אפשר לנסות שוב, ואם התקלה חוזרת אפשר לבדוק את
        מצב המערכת בעמוד האבחון.
      </p>
      <div className="grid gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-[14px] bg-accent px-5 py-3 text-[16px] font-medium text-white"
        >
          ניסיון נוסף
        </button>
        <a
          href="/api/health"
          className="flex items-center justify-center rounded-[14px] border border-line bg-surface px-5 py-3 text-[16px] text-ink"
        >
          בדיקת מצב המערכת
        </a>
      </div>
      {error.digest ? (
        <p className="mt-4 text-[12px] text-ink-faint">מזהה תקלה: {error.digest}</p>
      ) : null}
    </div>
  );
}
