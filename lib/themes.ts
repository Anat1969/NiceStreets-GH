/**
 * נושא השמות של כל רובע — "הידעת?".
 *
 * מקורות המידע כאן אינם מסכימים ביניהם, ולכן לכל נושא יש סטטוס.
 *
 * מילון הנושאים שנמסר סותר את רשימת הרחובות שנמסרה קודם, בעשרה רובעים.
 * למשל: המילון קובע שרובע ח' הוא "מלכי ישראל", אבל כל עשרים הרחובות
 * שברשימה שייכים לרובע ח' הם שמות פרחים; והמלכים נמצאים ברשימה ברובע י'.
 * נראה שהמילון ממוספר אחרת, או שייך למקור אחר.
 *
 * רובע שסומן `contested` לא מציג "הידעת" כלל. עדיף בלי מידע מאשר עם מידע
 * שגוי: תושב שיקרא שהרחוב שלו נקרא על שם משהו אחר ממה שהוא יודע, יפסיק
 * להאמין גם לשאר האפליקציה.
 *
 * `observed` הוא מה שעולה מהרחובות עצמם ברשימת העירייה. הוא הצעה לאישור,
 * לא קביעה: הנוסח הסופי של נושא רובע הוא החלטה של האגף.
 */

export type ThemeStatus = "confirmed" | "contested";

export interface QuarterTheme {
  /** הנוסח שיוצג לתושב. */
  theme: string;
  status: ThemeStatus;
  /** מה עולה בפועל מרשימת הרחובות, כשהוא שונה מהנוסח שנמסר. */
  observed?: string;
}

export const QUARTER_THEMES: Record<string, QuarterTheme> = {
  "q-a": {
    theme: "חלוצים, מעפילים ובוני העיר הראשונים",
    status: "confirmed",
  },
  "q-b": {
    theme: "אישים, חכמי ספרד וראשי הציונות",
    status: "confirmed",
  },
  "q-c": {
    theme: "רבנים, חכמי ישראל ועסקני ציונות",
    status: "confirmed",
  },
  "q-d": {
    theme: "נביאים ומנהיגים מתקופת התנ\"ך",
    status: "contested",
    observed: "הרי ארץ ישראל וספינות מעפילים — הר ארבל, הר מירון, אקסודוס, אח\"י אילת",
  },
  "q-e": {
    theme: "ציירים, פסלים, אנשי רוח, סופרים ומשוררים",
    status: "contested",
    observed: "משוררים ופייטנים לצד קהילות יהודיות — יהודה הלוי, אבן עזרא, קהילת ורשה, קהילת סלוניקי",
  },
  "q-f": {
    theme: "שלוש הרגלים, לוחמי מחתרות ונושאים דתיים",
    status: "contested",
    observed: "שבטי ישראל — שבט ראובן, שבט יהודה, שבט בנימין",
  },
  "q-g": {
    theme: "תנאים, אמוראים וראשי ישיבות",
    status: "confirmed",
  },
  "q-h": {
    theme: "מלכי ישראל ויהודה",
    status: "contested",
    observed: "פרחים — הכלנית, הנרקיס, הרקפת, החבצלת",
  },
  "q-i": {
    theme: "ראשונים, חכמי ישראל ואנשי מדע",
    status: "contested",
    observed: "המושבות והיישובים הראשונים — ראשון לציון, זכרון יעקב, דגניה, גדרה",
  },
  "q-j": {
    theme: "הרים, נחלים, עמקים ונופים בארץ ישראל",
    status: "contested",
    observed: "מלכי ישראל ויהודה — המלך דוד, המלך שלמה, המלך חזקיה",
  },
  "q-k": {
    theme: "מזלות, כוכבים, גרמי שמיים ומערכת השמש",
    status: "contested",
    observed: "הרים ונחלים בארץ ישראל — החרמון, הכרמל, הירדן, ים המלח",
  },
  "q-l": {
    theme: "שבטי ישראל",
    status: "contested",
    observed: "אבני החושן לצד יוצרים ישראלים — אודם, ברקת, יהלום, נעמי שמר, אהוד מנור",
  },
  "q-m": {
    theme: "משוררי ישראל המודרניים וחתני פרס ישראל",
    status: "contested",
    observed: "נחלי ארץ ישראל — נחל שורק, נחל לכיש, נחל הבשור",
  },
  "q-p": {
    theme: "הרי ישראל",
    status: "contested",
    observed: "חודשי השנה העברית והעונות — תשרי, כסלו, ניסן, אביב, סתיו",
  },
  "q-city": {
    theme: "עצמאות ישראל, מוסדות המדינה והציונות",
    status: "confirmed",
  },
  "q-cbd-south": {
    theme: "תרבות, אמנות וחדשנות ישראלית",
    status: "confirmed",
  },
  "q-ind-halutzim": {
    theme: "מלאכה, בנייה ובעלי מקצוע",
    status: "confirmed",
  },
  "q-ind-light": {
    theme: "מדע, תעשייה ועבודה",
    status: "confirmed",
  },
};

/** הנושא שמוצג לתושב, או null כשאין נושא מאושר לרובע הזה. */
export function confirmedTheme(quarterId: string | null): string | null {
  if (!quarterId) return null;
  const entry = QUARTER_THEMES[quarterId];
  return entry && entry.status === "confirmed" ? entry.theme : null;
}

/** הרובעים שבהם שני המקורות סותרים זה את זה, להצגה לצוות. */
export function contestedThemes(): { quarterId: string; entry: QuarterTheme }[] {
  return Object.entries(QUARTER_THEMES)
    .filter(([, entry]) => entry.status === "contested")
    .map(([quarterId, entry]) => ({ quarterId, entry }));
}
