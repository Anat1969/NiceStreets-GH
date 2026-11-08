"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { votesLabel } from "@/lib/hebrew";
import type { AssignRow } from "@/lib/street-assign";

/*
 * שיוך רחובות — אוטומטי, עם נימוק (ענת, 08.11.2026, סעיף 25).
 *
 * לכל רחוב: מה המערכת מציעה, מאיפה, והאם זה תואם למה שכבר שמור.
 * "לאשר את כל ההצעות" ממלא רק שדות ריקים — לא דורס החלטה של הצוות.
 * הבחירה הידנית נשארת בכל שורה, לבדיקה במקרה הצורך.
 */

type Filter = "attention" | "pending" | "all";

const MATCH_LABEL = {
  same: "תואם",
  new: "הצעה חדשה",
  differs: "שונה מהשמור",
  none: "אין מידע",
} as const;

export default function StreetAssignment({
  rows,
  quarters,
  typologies,
}: {
  rows: AssignRow[];
  quarters: { id: string; name: string }[];
  typologies: { key: string; label: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("attention");

  const quarterName = useMemo(() => Object.fromEntries(quarters.map((q) => [q.id, q.name])), [quarters]);
  const typeName = useMemo(() => Object.fromEntries(typologies.map((t) => [t.key, t.label])), [typologies]);

  const pending = rows.filter((r) => r.quarter.match === "new" || r.type.match === "new");
  const attention = rows.filter(
    (r) => r.quarter.match === "new" || r.type.match === "new" || r.flags.length > 0,
  );
  const visible = filter === "all" ? rows : filter === "pending" ? pending : attention;

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

  function acceptPatch(row: AssignRow, force = false): Record<string, string> {
    const patch: Record<string, string> = {};
    if (row.quarter.value && (force ? row.quarter.match !== "same" : row.quarter.match === "new"))
      patch.quarterId = row.quarter.value;
    if (row.type.value && (force ? row.type.match !== "same" : row.type.match === "new"))
      patch.typology = row.type.value;
    return patch;
  }

  async function acceptAll() {
    setBusy("all");
    setMessage(null);
    const items = pending.map((row) => ({ streetId: row.id, ...acceptPatch(row) }));
    const response = await fetch("/api/admin/street-batch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(null);
    if (response.ok || data.saved) {
      setMessage(
        `נשמרו ${data.saved ?? 0} רחובות.${data.failed ? ` ${data.failed} נכשלו, ונשארו ברשימה.` : ""}`,
      );
      router.refresh();
    } else {
      setMessage(data.error ?? "השמירה נכשלה.");
    }
  }

  return (
    <div className="assign">
      <div className="assign-summary">
        <p>
          <span className="assign-num">{rows.length.toLocaleString("he-IL")}</span> רחובות ·{" "}
          <span className="assign-num">{pending.length.toLocaleString("he-IL")}</span> עם הצעה לשדה ריק ·{" "}
          <span className="assign-num">{(attention.length - pending.length).toLocaleString("he-IL")}</span>{" "}
          לבדיקה ידנית
        </p>
        <p className="staff-howto">
          ההצעה ממלאת רק שדות ריקים, ולא משנה החלטה שהצוות כבר קיבל.
          <br />
          שורה מסומנת בכתום כשחסר מידע, כשהשמור שונה מהשכבה, או כשתושבים מציעים סוג אחר.
        </p>
        <button
          type="button"
          className="staff-btn staff-btn-primary"
          disabled={pending.length === 0 || busy !== null}
          onClick={acceptAll}
        >
          {busy === "all" ? "שומר…" : `לאשר את כל ההצעות (${pending.length.toLocaleString("he-IL")})`}
        </button>
      </div>

      <div className="assign-filter" role="group" aria-label="אילו רחובות להציג">
        {(
          [
            ["attention", `דורשים תשומת לב (${attention.length})`],
            ["pending", `הצעות חדשות (${pending.length})`],
            ["all", `הכול (${rows.length})`],
          ] as [Filter, string][]
        ).map(([key, label]) => (
          <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>
            {label}
          </button>
        ))}
      </div>

      {message ? (
        <p role="status" className="mb-2 text-[14px] font-medium text-ink">
          {message}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <div className="staff-empty">
          <p className="text-[15px] font-medium text-ink">אין רחובות בתצוגה הזאת.</p>
        </div>
      ) : (
        <ul className="assign-list">
          {visible.slice(0, 200).map((row) => {
            const patch = acceptPatch(row);
            const forcePatch = acceptPatch(row, true);
            return (
              <li key={row.id} className="assign-row" data-flag={row.flags.length > 0 ? "true" : "false"}>
                <div className="assign-head">
                  <a href={`/street/${row.id}`} className="assign-name">
                    {row.name}
                  </a>
                  <span className="staff-item-meta">
                    {row.code ? `סמל ${row.code}` : "ללא סמל רשמי"} · {votesLabel(row.votes)}
                  </span>
                </div>

                <dl className="assign-grid">
                  <div>
                    <dt>רובע</dt>
                    <dd>
                      <span className="assign-value">
                        {row.quarter.value ? quarterName[row.quarter.value] ?? row.quarter.value : "—"}
                      </span>
                      <span className="assign-match" data-match={row.quarter.match}>
                        {MATCH_LABEL[row.quarter.match]}
                      </span>
                      {row.quarter.match === "differs" && row.quarterId ? (
                        <span className="staff-item-meta">שמור: {quarterName[row.quarterId] ?? row.quarterId}</span>
                      ) : null}
                      <span className="assign-reason">{row.quarter.reason}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>סוג</dt>
                    <dd>
                      <span className="assign-value">
                        {row.type.value ? typeName[row.type.value] ?? row.type.value : "—"}
                      </span>
                      <span className="assign-match" data-match={row.type.match}>
                        {MATCH_LABEL[row.type.match]}
                      </span>
                      {row.type.match === "differs" && row.typology ? (
                        <span className="staff-item-meta">שמור: {typeName[row.typology] ?? row.typology}</span>
                      ) : null}
                      <span className="assign-reason">{row.type.reason}</span>
                    </dd>
                  </div>
                </dl>

                {row.flags.length > 0 ? (
                  <ul className="assign-flags">
                    {row.flags.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                ) : null}

                <div className="assign-actions">
                  {Object.keys(patch).length > 0 ? (
                    <button
                      type="button"
                      className="staff-btn staff-btn-primary"
                      disabled={busy !== null}
                      onClick={() => save(row.id, patch)}
                    >
                      לאשר את ההצעה
                    </button>
                  ) : Object.keys(forcePatch).length > 0 ? (
                    <button
                      type="button"
                      className="staff-btn"
                      disabled={busy !== null}
                      onClick={() => save(row.id, forcePatch)}
                    >
                      להחליף בהצעה
                    </button>
                  ) : null}
                </div>

                <details className="assign-manual">
                  <summary>בחירה ידנית</summary>
                  <div className="assign-manual-grid">
                    <label>
                      רובע
                      <select
                        defaultValue={row.quarterId ?? ""}
                        disabled={busy === row.id}
                        onChange={(e) => save(row.id, { quarterId: e.target.value })}
                      >
                        <option value="">טרם שויך</option>
                        {quarters.map((q) => (
                          <option key={q.id} value={q.id}>
                            {q.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      סוג רחוב
                      <select
                        defaultValue={row.typology ?? ""}
                        disabled={busy === row.id}
                        onChange={(e) => save(row.id, { typology: e.target.value })}
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
                </details>
              </li>
            );
          })}
        </ul>
      )}
      {visible.length > 200 ? (
        <p className="staff-howto mt-2">מוצגים 200 הראשונים. אחרי האישור הרשימה מתקצרת.</p>
      ) : null}
    </div>
  );
}
