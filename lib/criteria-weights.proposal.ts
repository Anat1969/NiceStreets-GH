/**
 * הצעה בלבד — לא מחוברת לשום חישוב באפליקציה.
 *
 * משקלים מנומקים לקריטריונים, לפי docs/criteria-research.md (09.11.2026).
 * המטרה: להחליף אותם במשקלים מכוילים מנתוני אשדוד, אחרי שתתווסף השאלה
 * הכוללת ("האם הייתם בוחרים ללכת ברחוב הזה?") ויצטברו כ-300 קולות.
 *
 * tier: 1 = תנאי סף, 2 = ליבה, 3 = צורה, 4 = פתוח (אין נתון).
 * family "management" היא השכבה החמישית הסמויה: תחזוקה וביטחון.
 */

export type ProposalFamily = "skeleton" | "section" | "frontage" | "texture" | "management";

export interface WeightProposal {
  /** מפתח קריטריון מ-lib/city.ts, או מפתח שאלה מקומית. */
  key: string;
  family: ProposalFamily;
  tier: 1 | 2 | 3 | 4;
  weight: number;
  /** מפתח שאלת התושב שמזינה את הקריטריון, אם יש. */
  residentQuestion: string | null;
  /** המדד האוטומטי המוצע, ומקורו (ראו docs/data-sources.md). */
  measure: string | null;
  rationale: string;
}

export const MIN_VOTES = {
  /** מתחת לזה: "קולות ראשונים", בלי מקום בדירוג. */
  preliminary: 10,
  /** מכאן: השוואה בין רחובות מאותו סוג. Mujahid et al. 2007: כ-25 לאשכול. */
  comparable: 20,
} as const;

export const WEIGHT_PROPOSAL: WeightProposal[] = [
  {
    key: "tree_canopy",
    family: "texture",
    tier: 1,
    weight: 0.16,
    residentQuestion: "shade",
    measure: "חופה ב-buffer של 7.5 מ' מציר הדרך — מיפוי חופות עצים, המרכז למיפוי ישראל (data.gov.il)",
    rationale: "באקלים הישראלי צל הוא תנאי להליכה. מחצית ממשיבי סקר המקור ציינו עצים והצללה.",
  },
  {
    key: "row_split",
    family: "section",
    tier: 1,
    weight: 0.14,
    residentQuestion: "walking",
    measure: "שיעור מדרכה ומעברי חצייה — OSM, ובהמשך שכבת מדרכות עירונית",
    rationale: "Jacobs: 'places for people to walk with some leisure' הוא התנאי הראשון.",
  },
  {
    key: "safety",
    family: "management",
    tier: 1,
    weight: 0.1,
    residentQuestion: "safety",
    measure: "תאונות עם נפגעים הולכי רגל לפי REHOV1 — הלמ\"ס, PUF (data.gov.il)",
    rationale: "Gehl: 'protection' היא הקבוצה הראשונה מתוך שלוש.",
  },
  {
    key: "transparency",
    family: "frontage",
    tier: 2,
    weight: 0.13,
    residentQuestion: "frontages",
    measure: "עסקים בקומת הקרקע — OSM shop/amenity, ובהמשך רישוי עסקים",
    rationale: "שימושים פעילים מנבאים הולכי רגל (Ewing et al. 2016).",
  },
  {
    key: "mixed_use",
    family: "skeleton",
    tier: 2,
    weight: 0.12,
    residentQuestion: "mix",
    measure: "צפיפות נקודות עניין לק\"מ רחוב — OSM",
    rationale: "כמו שקיפות: השימושים הם שמביאים אנשים.",
  },
  {
    key: "place_and_movement",
    family: "skeleton",
    tier: 2,
    weight: 0.1,
    residentQuestion: "staying",
    measure: "ספסלים וכיכרות (OSM), תחנות תחבורה ציבורית (GTFS)",
    rationale: "ריהוט רחוב מנבא הולכי רגל (Ewing et al. 2016).",
  },
  {
    key: "maintenance",
    family: "management",
    tier: 2,
    weight: 0.07,
    residentQuestion: "maintenance",
    measure: "פניות מוקד 106 לק\"מ, 12 חודשים — קובץ העירייה",
    rationale: "Jacobs מונה תחזוקה בין שמונת התנאים. קל לשיפור מהיר.",
  },
  {
    key: "proportions",
    family: "section",
    tier: 3,
    weight: 0.06,
    residentQuestion: null,
    measure: "יחס גובה לרוחב — OSM buildings + קומות, ובהמשך שכבת מבנים עירונית",
    rationale: "enclosure אצל Ewing & Handy; אמינות שיפוט בינונית (ICC כ-0.58).",
  },
  {
    key: "intersection_density",
    family: "skeleton",
    tier: 3,
    weight: 0.04,
    residentQuestion: null,
    measure: "מרחק בין צמתים — data/streets.geojson (עירייה)",
    rationale: "נמדד במלואו מהשכבה העירונית.",
  },
  {
    key: "row_width",
    family: "section",
    tier: 3,
    weight: 0.03,
    residentQuestion: null,
    measure: "רוחב בין חזיתות — OSM, ובהמשך קדסטר",
    rationale: "הקשר לסוג הרחוב יותר מאשר איכות בפני עצמה.",
  },
  {
    key: "building_rhythm",
    family: "frontage",
    tier: 3,
    weight: 0.03,
    residentQuestion: null,
    measure: "בניינים ל-100 מ' דופן — OSM buildings",
    rationale: "human scale אצל Ewing & Handy.",
  },
  {
    key: "small_plots",
    family: "texture",
    tier: 3,
    weight: 0.02,
    residentQuestion: null,
    measure: "רוחב חזית מגרש — קדסטר מפ\"י (data.gov.il)",
    rationale: "משתנה לאט; הקשר תכנוני.",
  },
  {
    key: "plot_street_meeting",
    family: "frontage",
    tier: 4,
    weight: 0,
    residentQuestion: null,
    measure: "קו בניין קדמי — תב\"ע (מבא\"ת), לא נגיש אוטומטית מחוץ לישראל",
    rationale: "ממתין לנתון.",
  },
  {
    key: "shared_language",
    family: "frontage",
    tier: 4,
    weight: 0,
    residentQuestion: null,
    measure: null,
    rationale: "שיפוט מומחה בלבד.",
  },
];
