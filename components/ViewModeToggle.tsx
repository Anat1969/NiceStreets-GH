"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { VIEW_MODE_COOKIE, type ViewMode } from "@/lib/view-mode";
import { ViewAuto, ViewDesktop, ViewMobile } from "@/components/icons";

/*
 * שלוש תוויות טקסט ("אוטומטי", "תצוגת מחשב", "תצוגת נייד") תפסו את רוב
 * רוחב הכותרת בנייד. כאן הן אייקון אחד כל אחת, באותה שפה של תוכן הלימוד.
 * השם נשאר נגיש: aria-label לקורא מסך, ו-title לריחוף בעכבר.
 */
const OPTIONS: { value: ViewMode; label: string; Icon: () => React.ReactElement }[] = [
  { value: "auto", label: "תצוגה אוטומטית", Icon: ViewAuto },
  { value: "desktop", label: "תצוגת מחשב", Icon: ViewDesktop },
  { value: "mobile", label: "תצוגת נייד", Icon: ViewMobile },
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
    <div className="flex gap-1" role="group" aria-label="בחירת תצוגה">
      {OPTIONS.map(({ value: option, label, Icon }) => {
        const active = value === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            aria-label={label}
            title={label}
            onClick={() => choose(option)}
            className={`pressable flex h-11 w-11 min-h-11 items-center justify-center rounded-full ${
              active
                ? "bg-accent text-white"
                : "border border-line bg-surface text-ink-soft"
            }`}
          >
            <Icon />
          </button>
        );
      })}
    </div>
  );
}
