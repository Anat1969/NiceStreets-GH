"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Row {
  id: string;
  name: string;
  code: string | null;
  quarterId: string | null;
  typology: string | null;
  votes: number;
  suggestions: { label: string; count: number }[];
}

export default function StreetAssignment({
  rows,
  quarters,
  typologies,
}: {
  rows: Row[];
  quarters: { id: string; name: string }[];
  typologies: { key: string; label: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [onlyUnassigned, setOnlyUnassigned] = useState(true);

  async function save(streetId: string, patch: Record<string, string>) {
    setBusy(streetId);
    setMessage(null);
    const response = await fetch("/api/admin/street", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ streetId, ...patch }),
    });
    setBusy(null);
    if (response.ok) {
      setMessage("נשמר.");
      router.refresh();
    } else {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "העדכון נכשל.");
    }
  }

  // A resident suggestion is something staff must see, even on a street that
  // is already assigned.
  const visible = onlyUnassigned
    ? rows.filter((r) => !r.quarterId || !r.typology || r.suggestions.length > 0)
    : rows;

  return (
    <div>
      <label className="mb-3 flex items-center gap-2 text-[14px] text-ink-soft">
        <input
          type="checkbox"
          checked={onlyUnassigned}
          onChange={(e) => setOnlyUnassigned(e.target.checked)}
        />
        רק רחובות שטרם שויכו, או שיש בהם הצעת תושבים
      </label>

      {visible.length === 0 ? (
        <div className="card p-4">
          <p className="text-[14px] text-ink-soft">כל הרחובות שויכו.</p>
        </div>
      ) : (
        <ul className="grid gap-2">
          {visible.map((row) => (
            <li key={row.id} className="card p-3">
              <p className="text-[15px] font-medium text-ink">
                {row.name}
                {row.code ? (
                  <span className="text-[12px] font-normal text-ink-faint"> · קוד {row.code}</span>
                ) : (
                  <span className="text-[12px] font-normal text-warm"> · ללא קוד רשמי</span>
                )}
              </p>
              <p className="mb-2 text-[12px] text-ink-faint">{row.votes} קולות</p>

              <div className="grid gap-2">
                <label className="text-[13px] text-ink-soft">
                  רובע
                  <select
                    defaultValue={row.quarterId ?? ""}
                    disabled={busy === row.id}
                    onChange={(e) => save(row.id, { quarterId: e.target.value })}
                    className="mt-1 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[15px] text-ink"
                  >
                    <option value="">טרם שויך</option>
                    {quarters.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-[13px] text-ink-soft">
                  סוג רחוב
                  <select
                    defaultValue={row.typology ?? ""}
                    disabled={busy === row.id}
                    onChange={(e) => save(row.id, { typology: e.target.value })}
                    className="mt-1 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[15px] text-ink"
                  >
                    <option value="">טרם סווג</option>
                    {typologies.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {row.suggestions.length > 0 ? (
                <p className="mt-2 border-t border-line pt-2 text-[13px] text-ink-soft">
                  הצעות תושבים לסוג אחר:{" "}
                  {row.suggestions.map((s) => `${s.label} (${s.count})`).join(" · ")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {message ? (
        <p role="status" className="mt-2 text-[13px] text-ink-soft">
          {message}
        </p>
      ) : null}
    </div>
  );
}
