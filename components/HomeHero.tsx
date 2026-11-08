"use client";

import Link from "next/link";
import { useState } from "react";
import type { FamilyKey } from "@/lib/city";
import StreetRoom, { type RoomLayer } from "@/components/StreetRoom";
import Rich from "@/components/Rich";

export interface HeroLayer extends RoomLayer {
  /** התשובה לשאלה של השכבה, בלי השאלה עצמה. */
  answer: string;
  criteria: string[];
}

/*
 * הכותרת של דף הבית. החדר העירוני ומסגרת התשובה חולקים מצב אחד:
 * ריחוף (או פוקוס) על שכבה או על הכפתור שלה פותח מתחת ל"ללמוד מה הופך
 * רחוב לטוב" מסגרת באותו רוחב, עם השאלה, התשובה והקריטריונים. כל כפתור
 * עדיין מוביל לעמוד השכבה שלו (ענת, 08.11.2026).
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

  return (
    <section className="hero mb-8">
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

        <div className="layer-answer" data-open={layer ? "" : undefined} aria-live="polite">
          {layer ? (
            <>
              <p className="layer-answer-q">
                <span className="room-swatch" data-layer={layer.key} aria-hidden="true" />
                {layer.title}: {layer.question}
              </p>
              <p className="layer-answer-a">{layer.answer}</p>
              <p className="layer-answer-c">
                {layer.criteria.length} קריטריונים: {layer.criteria.join(" · ")}
              </p>
            </>
          ) : (
            <p className="layer-answer-hint">רחפו מעל שכבה ברחוב, או מעל הכפתור שלה, כדי לראות מה היא שואלת.</p>
          )}
        </div>
      </div>
      <div className="rise" style={{ "--i": 2 } as React.CSSProperties}>
        <StreetRoom layers={layers} active={active} onActive={setActive} />
      </div>
    </section>
  );
}
