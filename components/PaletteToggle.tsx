"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PALETTES, PALETTE_COOKIE, type Palette } from "@/lib/palette";

/**
 * The colour scheme, stored in a cookie rather than only in the browser, so
 * the server renders the chosen scheme from the first paint instead of
 * flashing the other one first.
 */
export default function PaletteToggle({ current }: { current: Palette }) {
  const router = useRouter();
  const [value, setValue] = useState<Palette>(current);

  function choose(next: Palette) {
    setValue(next);
    const maxAge = next === "green" ? 0 : 60 * 60 * 24 * 365;
    document.cookie = `${PALETTE_COOKIE}=${next}; path=/; max-age=${maxAge}; samesite=lax`;
    router.refresh();
  }

  return (
    <div className="flex gap-1" role="group" aria-label="ערכת צבע">
      {PALETTES.map((option) => (
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
