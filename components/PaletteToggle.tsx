"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  DEFAULT_PALETTE,
  PALETTES,
  PALETTE_COOKIE,
  type Palette,
} from "@/lib/palette";

/**
 * שבע נקודות בסדר הקשת, במקום שבע תוויות.
 *
 * תווית לכל צבע הייתה תופסת את כל רוחב הכותרת בטלפון. נקודה צבועה אומרת
 * את אותו דבר בשליש מהמקום — והשם נשאר ב-aria-label ובעצה הצצה, כך שקורא
 * מסך וריחוף עכבר מקבלים אותו מידע.
 *
 * הבחירה נשמרת בעוגייה ולא רק בדפדפן, כדי שהשרת ירנדר את הערכה הנכונה
 * מהציור הראשון ולא תהיה הבהוב של הערכה הקודמת.
 */
export default function PaletteToggle({ current }: { current: Palette }) {
  const router = useRouter();
  const [value, setValue] = useState<Palette>(current);

  function choose(next: Palette) {
    setValue(next);
    const maxAge = next === DEFAULT_PALETTE ? 0 : 60 * 60 * 24 * 365;
    document.cookie = `${PALETTE_COOKIE}=${next}; path=/; max-age=${maxAge}; samesite=lax`;
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1" role="group" aria-label="ערכת צבע">
      {PALETTES.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            title={option.label}
            aria-label={option.label}
            aria-pressed={selected}
            onClick={() => choose(option.value)}
            className="palette-dot"
          >
            {/*
              העיגול הצבוע קטן מהכפתור: הכפתור עצמו הוא מטרת המגע, והצבע
              הוא רק מה שרואים.
            */}
            <span
              aria-hidden="true"
              className={`palette-dot-mark ${selected ? "is-selected" : ""}`}
              style={{ background: option.swatch }}
            />
          </button>
        );
      })}
    </div>
  );
}
