"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { VIEW_MODE_COOKIE, type ViewMode } from "@/lib/view-mode";

const OPTIONS: { value: ViewMode; label: string }[] = [
  { value: "auto", label: "אוטומטי" },
  { value: "desktop", label: "תצוגת מחשב" },
  { value: "mobile", label: "תצוגת נייד" },
];

/**
 * A deliberate override of the automatic layout. Stored in a cookie rather
 * than only in the browser, so the server renders the chosen layout from the
 * first paint instead of switching after it.
 */
export default function ViewModeToggle({ current }: { current: ViewMode }) {
  const router = useRouter();
  const [value, setValue] = useState<ViewMode>(current);

  function choose(next: ViewMode) {
    setValue(next);
    const maxAge = next === "auto" ? 0 : 60 * 60 * 24 * 365;
    document.cookie = `${VIEW_MODE_COOKIE}=${next}; path=/; max-age=${maxAge}; samesite=lax`;
    router.refresh();
  }

  return (
    <div
      className="flex gap-1"
      role="group"
      aria-label="בחירת תצוגה"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => choose(option.value)}
          className={`min-h-0 rounded-full px-3 py-1 text-[13px] ${
            value === option.value
              ? "bg-accent text-white"
              : "border border-line bg-surface text-ink-soft"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
