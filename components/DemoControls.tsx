"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DemoControls({
  demoVotes = 0,
  totalVotes = 0,
}: {
  demoVotes?: number;
  totalVotes?: number;
}) {
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
      {/*
        הטקסט הקודם כאן אמר שנתוני ההדגמה "אינם מעורבבים בקולות אמיתיים".
        זה לא היה נכון: הם נספרו בכל מספר במסכים הציבוריים. עכשיו הם
        נספרים בנפרד, מסומנים בכל מסך, והמספר האמיתי מופיע כאן.
      */}
      {demoVotes > 0 ? (
        <p className="mb-3 rounded-[10px] border border-warm bg-warm-soft px-3 py-2 text-[14px] text-ink">
          <span className="font-semibold">
            {demoVotes.toLocaleString("he-IL")} מתוך {totalVotes.toLocaleString("he-IL")} הקולות
            הם נתוני הדגמה.
          </span>{" "}
          הם נספרים בכל המספרים במסכים הציבוריים, ולכן מוצגת שם אזהרה. לפני
          פתיחה לציבור יש למחוק אותם, והאזהרה תיעלם מעצמה.
        </p>
      ) : (
        <p className="mb-3 text-[14px] text-ink-soft">
          אין כרגע נתוני הדגמה במסד. כל הקולות הם של תושבים.
        </p>
      )}
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
