import { QUESTIONS } from "../city";
import type { Scores, Street, Vote } from "../types";

const DEMO_REASONS = [
  "הולכים כאן לגן בבוקר וכל הדרך בצל.",
  "המדרכה צרה מדי כששני אנשים נפגשים.",
  "יש ספסלים ותמיד יושבים עליהם בערב.",
  "החנויות פתוחות לרחוב וזה מרגיש חי.",
  "חוצים כאן בריצה כי אין מעבר חצייה קרוב.",
  "בקיץ אי אפשר ללכת כאן בצהריים, אין עצים.",
  "הרחוב מטופח ומואר, נעים לחזור הביתה.",
];

export function buildDemoVotes(streets: Street[]): Vote[] {
  // Deterministic pseudo-random so the demo looks the same on every machine.
  let seed = 20260924;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const votes: Vote[] = [];
  streets.forEach((street, streetIndex) => {
    const count = 3 + Math.floor(rand() * 14);
    for (let i = 0; i < count; i += 1) {
      const scores = Object.fromEntries(
        QUESTIONS.map((q) => [q.key, 1 + Math.floor(rand() * 5)]),
      ) as Scores;
      const now = new Date(Date.now() - Math.floor(rand() * 30 * 86400000)).toISOString();
      votes.push({
        id: `demo-v-${streetIndex}-${i}`,
        streetId: street.id,
        quarterId: street.quarterId,
        typology: street.typology,
        scores,
        reason: rand() > 0.45 ? DEMO_REASONS[Math.floor(rand() * DEMO_REASONS.length)] : "",
        photoId: null,
        userId: `demo-user-${streetIndex}-${i}`,
        createdAt: now,
        updatedAt: now,
        isDemo: true,
      });
    }
  });
  return votes;
}
