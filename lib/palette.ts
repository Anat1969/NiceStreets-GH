/**
 * שבע ערכות צבע, לפי סדר הקשת.
 *
 * כל ערכה בנויה באותו עיקרון: פיגמנט כהה להדגשה, וגוון בהיר מאותו צבע
 * כרקע. רק הכרום משתנה — סולם 1–5 נשאר אדום־לירוק וצבעי הסטטוס נשארים
 * כפי שהם, כי שם הצבע נושא משמעות.
 *
 * כל הערכים חושבו ואומתו ב-scripts/build-palettes.mjs מול WCAG AA, בשישה
 * צירופים לכל ערכה. המינימום הכולל הוא 4.64. צהוב וכתום מקבלים בהירות
 * נמוכה יותר מהשאר: פיגמנט צהוב בהיר לא נושא טקסט לבן.
 *
 * ירוק וכחול נשארים בערכי המותג המדויקים שהיו בשימוש קודם.
 *
 * הקובץ משותף לכפתור ולפריסה בשרת, ולכן אסור שייבא דבר שקיים רק בשרת.
 */
export const PALETTE_COOKIE = "gs_palette";

export type Palette =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "teal"
  | "blue"
  | "violet";

/** לפי סדר הקשת. ברשימה RTL הראשון יופיע מימין. */
export const PALETTES: { value: Palette; label: string; swatch: string }[] = [
  { value: "red", label: "אדום", swatch: "#862f27" },
  { value: "orange", label: "כתום", swatch: "#7e461b" },
  { value: "yellow", label: "צהוב", swatch: "#755d15" },
  { value: "green", label: "ירוק", swatch: "#1f6f5c" },
  { value: "teal", label: "תכלת", swatch: "#1d5e72" },
  { value: "blue", label: "כחול", swatch: "#1b3f78" },
  { value: "violet", label: "סגול", swatch: "#5a3276" },
];

/** ירוק הוא ברירת המחדל: זה צבע המותג של האגף. */
export const DEFAULT_PALETTE: Palette = "green";

const KEYS = new Set<string>(PALETTES.map((p) => p.value));

export function parsePalette(value: string | undefined): Palette {
  return value && KEYS.has(value) ? (value as Palette) : DEFAULT_PALETTE;
}

/**
 * הצבע שהדפדפן צובע בו את הכרום שלו — שורת הכתובת באנדרואיד, ושורת המצב
 * באפליקציה עצמאית. הוא חייב לעקוב אחר הערכה שנבחרה.
 */
export const PALETTE_THEME_COLOR: Record<Palette, string> = Object.fromEntries(
  PALETTES.map((p) => [p.value, p.swatch]),
) as Record<Palette, string>;
