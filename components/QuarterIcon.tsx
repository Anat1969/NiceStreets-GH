import { CITY_ICON, QUARTER_ICONS } from "@/lib/quarter-icons.generated";

/**
 * אייקון של רובע, או של העיר כולה (id="city"): קו המתאר של הרובע, הצירים
 * הראשיים בקו עבה והרחובות המשניים בקו דק. נגזר מהנתונים ב-
 * scripts/build-quarter-icons.mjs, ולכן כל רובע מזוהה בצורה שלו.
 *
 * דקורטיבי: שם הרובע לידו נושא את המשמעות. לרובע שאין לו נתונים (י"ד)
 * לא מוצג דבר, כדי לא להמציא צורה.
 *
 *   <QuarterIcon id="q-a" />            // 24px
 *   <QuarterIcon id="city" size={48} />
 */
export default function QuarterIcon({
  id,
  size = 24,
  className = "",
}: {
  id: string;
  size?: number;
  className?: string;
}) {
  const icon = id === "city" ? CITY_ICON : QUARTER_ICONS[id];
  if (!icon) return null;
  // בגודל קטן הרחובות המשניים הופכים לרעש, ולכן הם נעלמים מתחת ל-28px.
  const showMinor = size >= 28;
  const isCity = id === "city";
  // העיר בגודל קטן: קו מתאר אחד ועליו הצירים, בלי 19 הרובעים.
  const outline = isCity && size < 64 && icon.hull ? icon.hull : icon.outline;
  const main = isCity ? (size < 64 ? 1.8 : 0.9) : size <= 24 ? 2.6 : 2.2;
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
      className={`quarter-icon shrink-0 ${className}`}
      data-approximate={icon.approximate ? "" : undefined}
    >
      <path
        d={outline}
        fill="currentColor"
        fillOpacity={0.1}
        stroke="currentColor"
        strokeWidth={isCity && size >= 64 ? 0.7 : 1.4}
        strokeLinejoin="round"
        strokeDasharray={icon.approximate ? "2.5 2" : undefined}
      />
      {showMinor && icon.minor ? (
        <path d={icon.minor} fill="none" stroke="currentColor" strokeWidth={0.7} strokeOpacity={0.55} strokeLinecap="round" />
      ) : null}
      <path d={icon.main} fill="none" stroke="currentColor" strokeWidth={main} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * אותו אייקון כמחרוזת SVG, לסמנים של המפה (שהם DOM ולא React).
 * הנתיבים מגיעים מקובץ שנוצר מהנתונים בלבד.
 */
export function quarterIconMarkup(id: string, size = 18): string {
  const icon = id === "city" ? CITY_ICON : QUARTER_ICONS[id];
  if (!icon) return "";
  const dash = icon.approximate ? ' stroke-dasharray="2.5 2"' : "";
  return (
    `<svg viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true" class="quarter-icon">` +
    `<path d="${icon.outline}" fill="currentColor" fill-opacity="0.12" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"${dash}/>` +
    `<path d="${icon.main}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`
  );
}
