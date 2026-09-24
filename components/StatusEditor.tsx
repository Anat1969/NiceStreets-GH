"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STATUSES } from "@/lib/city";
import type { StatusKey } from "@/lib/city";

export default function StatusEditor({
  streetId,
  current,
  note,
}: {
  streetId: string;
  current: StatusKey | null;
  note: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<StatusKey>(current ?? "received");
  const [publicNote, setPublicNote] = useState(note);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/admin/status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ streetId, status, publicNote }),
    });
    setBusy(false);
    if (response.ok) {
      setMessage("הסטטוס עודכן.");
      router.refresh();
    } else {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "העדכון נכשל.");
    }
  }

  return (
    <div className="grid gap-2">
      <p className="text-[14px] font-medium text-ink">עדכון סטטוס (צוות בלבד)</p>
      <label className="text-[13px] text-ink-soft">
        סטטוס
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusKey)}
          className="mt-1 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[15px] text-ink"
        >
          {STATUSES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-[13px] text-ink-soft">
        הערה לציבור
        <textarea
          value={publicNote}
          maxLength={400}
          rows={3}
          onChange={(e) => setPublicNote(e.target.value)}
          className="mt-1 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[15px] text-ink"
        />
      </label>
      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="rounded-[12px] bg-accent px-4 py-2 text-[15px] font-medium text-white disabled:opacity-40"
      >
        {busy ? "שומר…" : "שמירה"}
      </button>
      {message ? (
        <p role="status" className="text-[13px] text-ink-soft">
          {message}
        </p>
      ) : null}
    </div>
  );
}
