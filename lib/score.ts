/**
 * סולם הציון: נשמר 1–5, מוצג 0–10.
 *
 * התושבים עונים על כל שאלה בסולם 1 עד 5 — חמישה כפתורים הם מה שנכון
 * לטופס בנייד, וזה גם הסולם של 117 הקולות שכבר נשמרו. שינוי סולם
 * התשובה היה הופך אותם לבלתי ניתנים להשוואה עם מה שיגיע אחריהם.
 *
 * הציון המוצג, לעומת זאת, הוא 0 עד 10: 7.8 נתפס מיד, 3.9 פחות. ההמרה
 * מדויקת (כפל ב-2), ולכן היא אינה מוסיפה ואינה מאבדת מידע.
 */
export const SCORE_MAX = 10;

/** מהסולם השמור (1–5) לסולם המוצג (2–10). */
export function toTen(score: number): number {
  return score * 2;
}

/**
 * צבע הציון, על רצף ולא במדרגות.
 *
 * קודם לכן הצבע נקבע ב-Math.round על סולם 1–5, ולכן כל הרחובות
 * שנעו בין 2.63 ל-3.33 קיבלו בדיוק את אותו צבע: קידוד שלא קידד דבר.
 * כאן הצבע מוסע ברצף בין חמש עוגנים, וכל הפרש בציון נראה.
 *
 * הגוון נושא את המידע (חלודה → ענבר → ירוק), והבהירות נשארת דומה,
 * כדי שטקסט כהה יקרא על כל אחד מהם.
 */
/*
 * מעברי גוון רחבים, לא גוונים שכנים. הסולם רץ מאדום־לבנים עמוק, דרך
 * כתום וצהוב, לירוק ולירוק עמוק — חמישה גוונים שונים לגמרי ולא חמש
 * דרגות של אותו צבע. `textOnScore` בוחר טקסט כהה או לבן לפי הבהירות,
 * כדי שהמספר שבתוך הסימן יישאר קריא על כל אחד מהם.
 */
const STOPS: [number, [number, number, number]][] = [
  [2, [166, 54, 44]],
  [4, [222, 118, 38]],
  [6, [232, 199, 62]],
  [8, [122, 174, 72]],
  [10, [22, 110, 74]],
];

export const NO_SCORE_COLOR = "#c3c8cf";

/** מקבל ציון בסולם המוצג (0–10) ומחזיר צבע. */
export function scoreColorTen(score: number | null): string {
  if (score === null) return NO_SCORE_COLOR;
  const value = Math.max(STOPS[0][0], Math.min(SCORE_MAX, score));
  for (let i = 0; i < STOPS.length - 1; i += 1) {
    const [lo, a] = STOPS[i];
    const [hi, b] = STOPS[i + 1];
    if (value <= hi) {
      const t = (value - lo) / (hi - lo);
      const mix = a.map((c, k) => Math.round(c + (b[k] - c) * t));
      return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
    }
  }
  const last = STOPS[STOPS.length - 1][1];
  return `rgb(${last[0]}, ${last[1]}, ${last[2]})`;
}

/**
 * צבע הטקסט שיישב על צבע הציון: כהה על הבהירים, לבן על הכהים.
 * נגזר מהבהירות היחסית ולא נקבע ידנית, כדי שלא יישבר כשהסולם משתנה.
 */
export function textOnScore(score: number | null): string {
  if (score === null) return INK;
  const rgb = scoreColorTen(score).match(/\d+/g)?.map(Number) ?? [0, 0, 0];
  // נבחר מה שנותן ניגודיות גבוהה יותר, ולא סף בהירות שרירותי: סף כזה
  // בחר לבן על כתום ועל ירוק בהיר, ושם שני הצבעים נכשלו ב-WCAG.
  return contrast(rgb, INK_RGB) >= contrast(rgb, [255, 255, 255]) ? INK : "#ffffff";
}

const INK = "#16202b";
const INK_RGB: [number, number, number] = [22, 32, 43];

function relativeLuminance([r, g, b]: number[]): number {
  const [rl, gl, bl] = [r, g, b].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function contrast(a: number[], b: number[]): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** תווית הציון בסולם המוצג, עם ספרה אחת אחרי הנקודה. */
export function scoreOutOfTen(score: number | null): string {
  return score === null ? "—" : toTen(score).toFixed(1);
}
