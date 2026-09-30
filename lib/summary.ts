import { QUESTIONS, QUESTION_MAP } from "./city";
import type { QuestionKey } from "./city";
import type { StreetStats } from "./types";

/**
 * מה התושבים חושבים על הרחוב, במשפטים.
 *
 * מי שמגיע לכרטיס הרחוב מרשימת המובילים רוצה תשובה, לא שבעה מדדים
 * שעליו להרכיב מהם תמונה בעצמו. הסיכום נבנה מהנתונים בלבד — הוא לעולם
 * אינו מוסיף פרשנות שאין לה מספר מאחוריה, ואינו מרכך מספר נמוך.
 */
export function summarise(stats: StreetStats, reasonCount: number): string {
  if (stats.votes === 0) {
    return "עדיין לא דירגו את הרחוב הזה. הקול הראשון יקבע את נקודת הפתיחה שלו.";
  }

  const parts: string[] = [];
  const votes = stats.votes.toLocaleString("he-IL");
  const noun = stats.votes === 1 ? "תושב אחד דירג" : `${votes} תושבים דירגו`;
  const avg = stats.avgScore;

  parts.push(
    avg === null
      ? `${noun} את הרחוב.`
      : `${noun} את הרחוב, והציון הממוצע שלו הוא ${avg.toFixed(1)} מתוך 5${verdict(avg)}.`,
  );

  // החזק והחלש ביותר, רק כשיש באמת פער ביניהם.
  const scored = QUESTIONS.map((q) => ({
    key: q.key as QuestionKey,
    value: stats.perQuestion[q.key],
  })).filter((r): r is { key: QuestionKey; value: number } => r.value !== null);

  if (scored.length >= 2) {
    const sorted = [...scored].sort((a, b) => b.value - a.value);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    if (best.value - worst.value >= 0.5) {
      parts.push(
        `הכי חזק אצלו: ${QUESTION_MAP[best.key].label} (${best.value.toFixed(1)}). ` +
          `הכי חלש: ${QUESTION_MAP[worst.key].label} (${worst.value.toFixed(1)}).`,
      );
    } else {
      parts.push(
        `הדירוגים אחידים למדי: כל השאלות נעות סביב ${best.value.toFixed(1)}, בלי חוזקה או חולשה בולטת.`,
      );
    }
  }

  if (reasonCount > 0) {
    parts.push(
      reasonCount === 1
        ? "תושב אחד גם הסביר במילים למה, ואפשר לקרוא אותו למטה."
        : `${reasonCount.toLocaleString("he-IL")} מהם גם הסבירו במילים למה, ואפשר לקרוא אותם למטה.`,
    );
  }

  if (stats.photos > 0) {
    parts.push(
      stats.photos === 1
        ? "יש גם תמונה אחת מאושרת מהרחוב."
        : `יש גם ${stats.photos.toLocaleString("he-IL")} תמונות מאושרות מהרחוב.`,
    );
  }

  return parts.join(" ");
}

/** תיאור קצר של הציון, בסולם שנגזר מ-1 עד 5 ולא מהרושם. */
function verdict(avg: number): string {
  if (avg >= 4.2) return " — מהגבוהים בסולם";
  if (avg >= 3.4) return " — טוב";
  if (avg >= 2.6) return " — בינוני";
  if (avg >= 1.8) return " — נמוך";
  return " — נמוך מאוד";
}
