"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** סימון דיווח כטופל, והחזרתו לפתוחים. אין כאן "נדחה": דיווח שנקרא נגמר. */
export default function ReportHandled({
  reportId,
  handled,
}: {
  reportId: string;
  handled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/admin/reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reportId, handled: !handled }),
    });
    setBusy(false);
    if (response.ok) {
      router.refresh();
      return;
    }
    const data = await response.json().catch(() => ({}));
    setError(data.error ?? "העדכון נכשל.");
  }

  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={toggle}
        className={
          handled
            ? "pressable min-h-11 rounded-[10px] border border-line bg-surface px-3 py-2 text-[14px] text-ink"
            : "pressable min-h-11 rounded-[10px] bg-accent px-3 py-2 text-[14px] font-medium text-white"
        }
      >
        {busy ? "מעדכן…" : handled ? "להחזיר לפתוחים" : "לסמן כטופל"}
      </button>
      {error ? (
        <p role="alert" className="mt-1 text-[12px] text-warm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
