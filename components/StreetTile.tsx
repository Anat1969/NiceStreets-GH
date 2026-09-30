import { scoreColorTen, textOnScore, toTen } from "@/lib/score";

/**
 * הפנים של רחוב, גם כשאין לו תמונה.
 *
 * ב-9 מתוך 12 הרחובות אין עדיין תמונה מאושרת — כלומר "אין תמונה" הוא
 * המצב הרגיל, לא הקצה. קודם לכן הוא טופל בשני דברים גרועים: איור אפור
 * זהה לכל הרחובות ברשימת המובילים, וכותרת בלי תמונה בכלל בכרטיס
 * הרחוב. חמישה ריבועים זהים אינם מוסרים מידע, והם גם לא יפים.
 *
 * כאן, כשאין תמונה, נבנה אריח מהנתונים של הרחוב עצמו: שמו, הרובע שלו,
 * ורקע בצבע הציון — אותו רצף צבעים בדיוק של הסימנים במפה. כך לכל רחוב
 * פנים משלו, הצבע אומר משהו, והשפה החזותית אחת בכל המסכים.
 */
export function StreetTile({
  name,
  quarterName,
  avgScore,
  photoId,
  className = "",
  size = "small",
}: {
  name: string;
  quarterName?: string;
  avgScore: number | null;
  photoId: string | null;
  className?: string;
  /** "small" לרשימות, "hero" לראש כרטיס הרחוב. */
  size?: "small" | "hero";
}) {
  const hero = size === "hero";

  if (photoId) {
    return (
      <span className={`relative block overflow-hidden ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/photos/${photoId}`}
          alt={quarterName ? `${name}, ${quarterName}` : name}
          className="h-full w-full object-cover"
        />
        <span className="photo-scrim" aria-hidden="true" />
        <span
          className={`absolute inset-x-0 bottom-0 text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)] ${
            hero ? "p-4" : "px-2 pb-1.5"
          }`}
        >
          <span
            className={`block font-bold leading-tight ${hero ? "text-[28px]" : "text-[13px]"}`}
          >
            {name}
          </span>
          {quarterName ? (
            <span className={`block ${hero ? "text-[14px] opacity-95" : "sr-only"}`}>
              {quarterName}
            </span>
          ) : null}
        </span>
      </span>
    );
  }

  const ten = avgScore === null ? null : toTen(avgScore);
  const background = scoreColorTen(ten);
  const ink = textOnScore(ten);

  return (
    <span
      className={`relative block overflow-hidden ${className}`}
      /*
       * גרדיאנט עדין ולא כתם שטוח: הצבע נשאר נושא המידע, והמשטח נראה
       * כמו לוח מעוצב ולא כמו ריבוע צבע שנשכח שם.
       */
      style={{
        background: `linear-gradient(160deg, ${background} 0%, color-mix(in oklab, ${background} 82%, #000) 100%)`,
      }}
    >
      {/*
        קווים אלכסוניים דקים, ברוח שרטוט: נותנים מרקם לאריח בלי להתחרות
        בשם ובלי להעמיד פנים שזו תמונה של הרחוב.
      */}
      <span
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, currentColor 0 1px, transparent 1px 9px)",
          color: ink,
        }}
      />
      <span
        className={`absolute inset-x-0 bottom-0 ${hero ? "p-4" : "px-2 pb-1.5"}`}
        style={{ color: ink }}
      >
        <span
          className={`block font-bold leading-tight ${hero ? "text-[28px]" : "text-[13px]"}`}
        >
          {name}
        </span>
        {quarterName ? (
          <span className={`block ${hero ? "text-[14px] opacity-90" : "sr-only"}`}>
            {quarterName}
          </span>
        ) : null}
      </span>
    </span>
  );
}
