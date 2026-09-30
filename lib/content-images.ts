/**
 * תמונות תוכן — תמונה אחת לכל מקום קבוע באפליקציה.
 *
 * טבלת `photos` קושרת כל תמונה לרחוב. לקריטריון, לסוג רחוב, לדוגמה
 * בספרייה וללוגו אין רחוב, ולכן הם יושבים כאן, וכל אחד מזוהה במפתח המקום
 * שלו: `criterion:tree_canopy`, `typology:boulevard`, `logo`.
 *
 * המפתח נבנה כאן ולא נכתב ביד בכל מסך, כך שאי אפשר להעלות תמונה למקום
 * שאינו קיים בגלל טעות כתיב.
 */

export type ImageSlotKind =
  | "question"
  | "criterion"
  | "typology"
  | "example"
  | "logo";

export type ImageSlot = string;

export function imageSlot(kind: ImageSlotKind, key?: string): ImageSlot {
  return key ? `${kind}:${key}` : kind;
}

const KINDS: ImageSlotKind[] = [
  "question",
  "criterion",
  "typology",
  "example",
  "logo",
];

/** מקבל מפתח מבחוץ ומחזיר אותו רק אם הוא בצורה מוכרת. */
export function parseImageSlot(raw: string): ImageSlot | null {
  const value = String(raw ?? "").trim();
  if (!value || value.length > 80) return null;
  if (!/^[a-z_]+(:[a-z0-9_-]+)?$/.test(value)) return null;
  const kind = value.split(":")[0] as ImageSlotKind;
  return KINDS.includes(kind) ? value : null;
}

/** הכתובת שממנה נטענים הבייטים. */
export function imageSlotUrl(slot: ImageSlot): string {
  return `/api/content-images/${encodeURIComponent(slot)}`;
}
