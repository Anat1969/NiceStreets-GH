"use client";

import StatusEditor from "@/components/StatusEditor";
import type { StatusKey } from "@/lib/city";

/** עדכון סטטוס בתוך התור: נפתח במקום, בלי לעבור לכרטיס הרחוב. */
export default function StatusInline({
  streetId,
  current,
  note,
}: {
  streetId: string;
  current: StatusKey | null;
  note: string;
}) {
  return (
    <details className="staff-details">
      <summary className="staff-summary">{current ? "לשנות סטטוס" : "לקבוע סטטוס"}</summary>
      <div className="mt-2">
        <StatusEditor streetId={streetId} current={current} note={note} />
      </div>
    </details>
  );
}
