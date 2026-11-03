/**
 * תצוגה סטטית של חתך הרחוב, לקישור הישיר מ-GitHub בלי Vercel (כלל ענת, 03.11.2026).
 * אותו רכיב כמו באפליקציה, עם רשימת הרחובות שיש להם מרכז, ומדידה חיה מ-OpenStreetMap.
 * אין כאן כניסת צוות ואין שמירה: זו תצוגה של השינוי, לא האפליקציה.
 * נבנה ב-`node scripts/build-preview.mjs`.
 */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import StreetSection from "../components/StreetSection";
import { TYPOLOGY_MAP } from "../lib/city";
import streets from "./streets.json";

type Row = (typeof streets)[number];

function readHash(): string {
  try {
    return decodeURIComponent(location.hash.slice(1));
  } catch {
    return "";
  }
}

function Preview() {
  const initial = streets.find((s) => s.id === readHash()) ?? streets.find((s) => s.name === "רוגוזין")!;
  const [street, setStreet] = useState<Row>(initial);
  const typology = street.typology ? TYPOLOGY_MAP[street.typology] : null;
  return (
    <main className="mx-auto max-w-[560px] px-4 py-6" dir="rtl">
      <p className="mb-1 text-[13px] font-semibold text-ink-faint">תצוגה מקדימה מ-GitHub</p>
      <h1 className="mb-1 text-[24px] font-bold text-ink">חתך הרחוב, הרחובות הטובים של אשדוד</h1>
      <p className="mb-4 text-[14px] text-ink-soft">
        כך החתך נראה בדף הרחוב באפליקציה. בחרו רחוב: הרוחב נמדד עכשיו מהמפה הפתוחה.
      </p>
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="בחירת רחוב">
        {streets.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={s.id === street.id}
            onClick={() => {
              setStreet(s);
              history.replaceState(null, "", "#" + s.id);
            }}
            className="section-step px-3 text-[14px]"
            style={s.id === street.id ? { background: "var(--color-ink)", color: "#fff" } : undefined}
          >
            {s.name}
          </button>
        ))}
      </div>
      <section>
        <h2 className="mb-1 text-[19px] font-semibold text-ink">חתך הרחוב: {street.name}</h2>
        <p className="mb-3 text-[14px] text-ink-soft">
          כמה רחב הרחוב ביחס לגובה הבניינים. היחס הזה קובע אם הרחוב מרגיש כמו חדר או כמו מגרש פתוח.
        </p>
        <StreetSection
          key={street.id}
          streetId={street.id}
          saved={null}
          staff={false}
          dataBase="../public/geo/sections/"
          streetName={street.name}
          center={street.center as [number, number]}
          typologyLabel={typology?.label ?? null}
          benchmark={typology?.benchmarks.ratio ?? null}
          gisHeightToWidth={street.gis?.heightToWidth ?? null}
        />
      </section>
      <p className="mt-6 text-[12px] text-ink-faint">
        האפליקציה החיה: nicestreets-vercal.vercel.app. נתוני הרחובות נכונים ל-03.11.2026.
      </p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Preview />);
