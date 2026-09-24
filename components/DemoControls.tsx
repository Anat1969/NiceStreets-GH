"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DemoControls() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: "seed" | "clear") {
    if (action === "clear" && !confirm("למחוק את כל נתוני ההדגמה? הפעולה אינה הפיכה.")) return;
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/admin/demo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    setMessage(
      response.ok
        ? action === "seed"
          ? `נוספו ${data.count} קולות הדגמה.`
          : `נמחקו ${data.count} קולות הדגמה.`
        : (data.error ?? "הפעולה נכשלה."),
    );
    router.refresh();
  }

  return (
    <div className="card p-4">
      <p className="mb-3 text-[14px] text-ink-soft">
        נתוני הדגמה מסומנים בנפרד ואינם מעורבבים בקולות אמיתיים. לפני פתיחה לציבור יש למחוק אותם.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => run("seed")}
          className="flex-1 rounded-[12px] border border-line bg-surface px-3 py-3 text-[15px] text-ink disabled:opacity-40"
        >
          הוספת נתוני הדגמה
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => run("clear")}
          className="flex-1 rounded-[12px] bg-warm px-3 py-3 text-[15px] text-white disabled:opacity-40"
        >
          מחיקת נתוני הדגמה
        </button>
      </div>
      {message ? (
        <p role="status" className="mt-2 text-[13px] text-ink-soft">
          {message}
        </p>
      ) : null}
    </div>
  );
}
