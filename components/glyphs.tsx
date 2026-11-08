/*
 * שפה גרפית מינימלית לדף הבית (ענת, 08.11.2026: "יש מקום לאייקונים כשפה
 * גרפית שעוזרת לקודד את המידע"). קו אחד, 1.6, בלי מילוי — כדי שהסמל יקודד
 * ולא יקשט. כל סמל דקורטיבי: התווית לידו נושאת את המשמעות.
 */
const P = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const GLYPHS = {
  rate: (
    <svg {...P}>
      <path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" />
    </svg>
  ),
  map: (
    <svg {...P}>
      <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14" />
    </svg>
  ),
  table: (
    <svg {...P}>
      <path d="M3 5h18v14H3z M3 10h18 M3 14.5h18 M9 5v14" />
    </svg>
  ),
  section: (
    <svg {...P}>
      <path d="M2 20h20 M4 20V8h4v12 M16 20V5h4v15 M8 17h8" />
    </svg>
  ),
  examples: (
    <svg {...P}>
      <path d="M3 5h18v14H3z M3 15l5-4 4 3 3-2 6 4" />
      <circle cx="16" cy="9" r="1.6" />
    </svg>
  ),
  learn: (
    <svg {...P}>
      <path d="M3 6c3-1.5 6-1.5 9 0v13c-3-1.5-6-1.5-9 0z M12 6c3-1.5 6-1.5 9 0v13c-3-1.5-6-1.5-9 0z" />
    </svg>
  ),
  suggest: (
    <svg {...P}>
      <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z M12 6.5v6 M9 9.5h6" />
    </svg>
  ),
  articles: (
    <svg {...P}>
      <path d="M5 3h10l4 4v14H5z M15 3v4h4 M8 11h8 M8 14.5h8 M8 18h5" />
    </svg>
  ),
  knowledge: (
    <svg {...P}>
      <circle cx="12" cy="9" r="5" />
      <path d="M9.5 14v3h5v-3 M10 20h4" />
    </svg>
  ),
  understanding: (
    <svg {...P}>
      <path d="M4 12h6 M14 12h6 M7 9l-3 3 3 3 M17 9l3 3-3 3" />
    </svg>
  ),
  implementation: (
    <svg {...P}>
      <path d="M4 20V10l8-6 8 6v10z M9 20v-6h6v6" />
    </svg>
  ),
};

export type GlyphKey = keyof typeof GLYPHS;
