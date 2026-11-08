"use client";

import Link from "next/link";
import { useState } from "react";
import type { FamilyKey } from "@/lib/city";
import StreetRoom, { RoomLegend, type RoomLayer } from "@/components/StreetRoom";
import Rich from "@/components/Rich";
import { FamilyMark, criterionFill } from "@/components/CriteriaMark";
import type { CriterionKey } from "@/lib/city";

export interface HeroLayer extends RoomLayer {
  /** התשובה לשאלה של השכבה, בלי השאלה עצמה. */
  answer: string;
  criteria: { key: CriterionKey; name: string }[];
}

/*
 * הכותרת של דף הבית, בגריד של שתי שורות (ענת, 09.11.2026):
 *   שורה 1: הטקסט והכפתורים | החדר העירוני
 *   שורה 2: מסגרת התשובה    | ארבעת כפתורי השכבות
 * מסגרת התשובה יושבת באותה שורה כמו כפתורי השכבות ומיושרת אליהם. אלה
 * התובנות החשובות ביותר בדף, ולכן הן גדולות ובולטות. ריחוף או פוקוס על
 * שכבה מחליף את התשובה; כל כפתור עדיין מוביל לעמוד השכבה שלו.
 */
export default function HomeHero({
  eyebrow,
  title,
  sub,
  question,
  layers,
}: {
  eyebrow: string;
  title: string;
  sub: string;
  question: string;
  layers: HeroLayer[];
}) {
  const [active, setActive] = useState<FamilyKey | null>(null);
  const layer = layers.find((l) => l.key === active) ?? null;
  const on = (key: FamilyKey | null) => () => setActive(key);

  return (
    <section className="hero hero-grid mb-8">
      <div className="hero-copy rise">
        <p className="eyebrow mb-2">{eyebrow}</p>
        <Rich as="h1" className="hero-title mb-3">
          {title}
        </Rich>
        <Rich as="p" className="hero-sub mb-2">
          {sub}
        </Rich>
        <p className="mb-4 text-[16px] font-semibold text-ink">{question}</p>
        <div className="cta-grid">
          <Link href="/choose" className="btn btn-primary">
            לבחור רחוב ולדרג
          </Link>
          <Link href="/learn" className="btn btn-ghost">
            ללמוד מה הופך רחוב לטוב
          </Link>
        </div>
      </div>

      <div className="hero-room rise" style={{ "--i": 2 } as React.CSSProperties}>
        <StreetRoom layers={layers} active={active} onActive={setActive} showLegend={false} />
      </div>

      <div className="hero-legend rise" style={{ "--i": 3 } as React.CSSProperties}>
        <RoomLegend layers={layers} active={active} on={on} />
      </div>

      <div
        className="hero-answer layer-answer"
        data-open={layer ? "" : undefined}
        data-layer={layer?.key}
        aria-live="polite"
      >
        {layer ? (
          <>
            <p className="layer-answer-q">
              <FamilyMark family={layer.key} size={26} />
              <span>
                <span className="layer-answer-name">{layer.title}</span>
                {layer.question}
              </span>
            </p>
            <p className="layer-answer-a">{layer.answer}</p>
            <ul className="layer-answer-c" aria-label={`${layer.criteria.length} קריטריונים`}>
              {layer.criteria.map((c) => (
                <li key={c.key}>
                  <FamilyMark family={layer.key} fill={criterionFill(c.key)} size={14} />
                  {c.name}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="how">רחפו מעל שכבה ברחוב, או מעל אחד מארבעת הכפתורים, כדי לראות מה היא שואלת ומה עונה עליה.</p>
        )}
      </div>
    </section>
  );
}
