"use client";

import { useEffect, useState } from "react";

/**
 * צבע המותג שנבחר בכותרת (`--brand-500`), כערך שמפה יכולה להשתמש בו.
 *
 * המפות מצוירות ב-WebGL ואינן קוראות משתני CSS. לכן הצבע נקרא מהם, ונקרא
 * שוב בכל פעם שבוחרים צבע אחר בכותרת (שינוי `data-palette` על השורש).
 */
export function useBrandColor(fallback = "#1f6f5c"): string {
  const [brand, setBrand] = useState(fallback);
  useEffect(() => {
    const read = () => {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue("--brand-500")
        .trim();
      if (value) setBrand(value);
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-palette", "class", "style"],
    });
    return () => observer.disconnect();
  }, []);
  return brand;
}
