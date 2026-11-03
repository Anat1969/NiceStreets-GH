/**
 * מספרים נכתבים תמיד כספרה, גם באחד ובשניים.
 *
 * קודם לכן נכתב "קול אחד" ו"שני קולות". זה עברית תקינה, אבל מספר שנכתב
 * במילה אי אפשר לסרוק בעין ואי אפשר להשוות בין שורות: ברשימה שבה כתוב
 * "קול אחד" ליד "7 קולות" העין לא רואה יחס. הספרה נשארת ספרה, ושם העצם
 * מתאים לה.
 */
function count(n: number, one: string, many: string, none: string): string {
  if (n === 0) return none;
  return `${n.toLocaleString("he-IL")} ${n === 1 ? one : many}`;
}

export function votesLabel(n: number): string {
  return count(n, "קול", "קולות", "אין קולות");
}

export function photosLabel(n: number): string {
  return count(n, "תמונה", "תמונות", "אין תמונות");
}

export function streetsFoundLabel(n: number): string {
  if (n === 0) return "לא נמצאו רחובות";
  return `נמצאו ${n.toLocaleString("he-IL")} ${n === 1 ? "רחוב" : "רחובות"}`;
}

/** רשימה בתוך משפט: "תמונה, שם רחוב ותיאור". */
export function joinHebrew(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} ו${parts[parts.length - 1]}`;
}

/**
 * ציון ממוצע בסולם המוצג (0–10), בספרה אחת אחרי הנקודה.
 * ההמרה עצמה ב-lib/score.ts, יחד עם ההסבר למה הסולם השמור נשאר 1–5.
 */
export { scoreOutOfTen as scoreLabel } from "./score";
