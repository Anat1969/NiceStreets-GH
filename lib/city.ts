/**
 * City configuration — the single file another city needs to replace.
 *
 * Everything that is specific to Ashdod (quarters, street list, typologies,
 * colours, copy) lives here. The rest of the app reads from this module only.
 *
 * DATA STATUS (see README, "לאימות לפני עלייה לאוויר"):
 * `quarters[].polygon` and the street list below are PLACEHOLDERS for the
 * municipal GIS layer. They are schematic and must be replaced with the
 * official GeoJSON before the app is opened to the public.
 * Use `npm run import:gis` (scripts/import-gis.mjs) once the layers exist.
 */

export type Scale = 1 | 2 | 3 | 4 | 5;

export type QuestionKey =
  | "shade"
  | "walking"
  | "frontages"
  | "staying"
  | "mix"
  | "maintenance"
  | "safety";

export type TypologyKey =
  | "neighborhood_commercial"
  | "main_commercial"
  | "residential"
  | "boulevard"
  | "pedestrian_mall"
  | "linear_park";

export type StatusKey =
  | "received"
  | "under_review"
  | "planned"
  | "in_progress"
  | "done";

export interface Question {
  key: QuestionKey;
  label: string;
  help: string;
  /** Which of the 12 criteria this resident question maps to. */
  criteria: string[];
  /** true when the criterion is not part of the Planning Administration study. */
  local: boolean;
}

export interface Typology {
  key: TypologyKey;
  label: string;
  description: string;
  /** Reference values used on the street card to give context. */
  benchmarks: { rowWidth: string; ratio: string; canopy: string };
}

export interface Quarter {
  id: string;
  name: string;
  /** Schematic polygon: [lon, lat] ring. Replace with municipal GIS. */
  polygon: [number, number][];
  center: [number, number];
  schematic: boolean;
}

/**
 * What staff know about a street beyond its name. The national street registry
 * (data/ashdod-streets.json) carries neither quarter nor street type, so both
 * are assigned here or from the admin screen — never guessed from the name.
 *
 * Keyed by the registry code. A street missing from this map is still usable:
 * residents can vote on it, and it shows as "טרם שויך רובע" until someone sets it.
 */
export interface StreetAssignment {
  quarterId?: string;
  /** Several quarters means the resident is asked which stretch they mean. */
  quarterIds?: string[];
  typology?: TypologyKey;
  gis?: {
    rowWidthM?: number;
    heightToWidth?: number;
    canopyPct?: number;
    intersectionDistanceM?: number;
  };
  line?: [number, number][];
}

export const STREET_ASSIGNMENTS: Record<string, StreetAssignment> = {
  // Filled by staff. Left empty on purpose: assigning a quarter without the
  // municipal source would be a guess presented as fact.
};

export const CITY = {
  id: "ashdod",
  name: "אשדוד",
  nameEn: "Ashdod",
  appTitle: "הרחובות הטובים של אשדוד",
  appShortTitle: "רחובות טובים",
  tagline: "מה הופך רחוב לטוב — ואיך אנחנו עושים את זה יחד",
  homeQuestion: "איזה רחוב באשדוד גורם לכם לרצות ללכת ברגל?",
  authority: "אגף אדריכלות העיר, עיריית אשדוד",
  center: [34.6553, 31.7963] as [number, number],
  zoom: 12.4,
  bounds: [
    [34.58, 31.74],
    [34.73, 31.87],
  ] as [[number, number], [number, number]],
};

export const PRINCIPLES = [
  {
    key: "knowledge",
    title: "ידע",
    text: "שנים־עשר קריטריונים לרחוב טוב, בשפה פשוטה, עם דוגמאות מהעיר ומהעולם.",
  },
  {
    key: "understanding",
    title: "הבנה",
    text: "כל רחוב נמדד מול רחובות מאותו סוג — שדרה מול שדרה, רחוב מגורים מול רחוב מגורים.",
  },
  {
    key: "implementation",
    title: "יישום",
    text: "הקול שלכם מוביל לפעולה גלויה: לכל רחוב יש סטטוס עירוני שמתעדכן על המפה.",
  },
];

export const QUESTIONS: Question[] = [
  {
    key: "shade",
    label: "צל",
    help: "האם יש חופת עצים או הצללה שמאפשרת ללכת ברחוב גם בקיץ?",
    criteria: ["חופת עצים", "אקלים מקומי"],
    local: false,
  },
  {
    key: "walking",
    label: "הליכה וחצייה",
    help: "האם המדרכה רחבה ורציפה, והאם קל ובטוח לחצות?",
    criteria: ["רוחב מדרכה", "חלוקת החתך", "מעברי חצייה"],
    local: false,
  },
  {
    key: "frontages",
    label: "חזיתות",
    help: "האם חזיתות המבנים פתוחות לרחוב, עם חלונות וכניסות, ולא קירות אטומים?",
    criteria: ["שקיפות החזית", "מקצב הכניסות"],
    local: false,
  },
  {
    key: "staying",
    label: "מקום לשהות",
    help: "האם יש ספסל, כיכר קטנה או פינה שאפשר לעצור בה — ולא רק לעבור?",
    criteria: ["מקום לשהייה", "יחס שהייה לתנועה"],
    local: false,
  },
  {
    key: "mix",
    label: "עירוב שימושים",
    help: "האם יש מסחר, שירותים ומגורים באותו רחוב, ופעילות לאורך היום?",
    criteria: ["עירוב שימושים", "פעילות לאורך היום"],
    local: false,
  },
  {
    key: "maintenance",
    label: "תחזוקה",
    help: "האם הרחוב נקי, המדרכה שלמה והתאורה עובדת?",
    criteria: ["תחזוקה"],
    local: true,
  },
  {
    key: "safety",
    label: "ביטחון",
    help: "האם נעים ובטוח להיות ברחוב גם בשעות הערב?",
    criteria: ["תחושת ביטחון"],
    local: true,
  },
];

export const CRITERIA_FAMILIES = [
  {
    key: "skeleton",
    title: "שלד",
    text: "הרשת שמחזיקה את הרחוב: רציפות, גודל המקטע ומרחק בין צמתים.",
    criteria: [
      { name: "רציפות הציר", text: "רחוב שממשיך ומתחבר לרחובות אחרים, בלי קטיעות." },
      { name: "מרחק בין צמתים", text: "מקטעים קצרים מייצרים יותר אפשרויות בחירה להולך הרגל." },
      { name: "חיבור לתחבורה ציבורית", text: "תחנה במרחק הליכה נוח מרוב הכתובות ברחוב." },
    ],
  },
  {
    key: "section",
    title: "חתך",
    text: "חלוקת רוחב זכות הדרך בין הולכי רגל, עצים, אופניים ורכב.",
    criteria: [
      { name: "רוחב מדרכה", text: "מדרכה שמאפשרת שני אנשים זה לצד זה בלי לרדת לכביש." },
      { name: "יחס גובה לרוחב", text: "הפרופורציה בין גובה הבניינים לרוחב הרחוב מגדירה את תחושת המקום." },
      { name: "חלוקת החתך", text: "מקום מוגדר לכל שימוש — הליכה, עצים, ישיבה, אופניים, חנייה." },
    ],
  },
  {
    key: "frontage",
    title: "חזית",
    text: "הקו שבו הבניין פוגש את הרחוב — מה שקובע אם הרחוב חי.",
    criteria: [
      { name: "שקיפות החזית", text: "חלונות וכניסות במפלס הרחוב במקום קירות וחניונים." },
      { name: "מקצב הכניסות", text: "כניסות תכופות מייצרות רחוב מעניין להליכה." },
      { name: "עירוב שימושים", text: "מסחר, שירותים ומגורים באותו ציר." },
    ],
  },
  {
    key: "texture",
    title: "מרקם ואקלים",
    text: "מה שהופך רחוב לנעים בפועל, ביום חול בקיץ.",
    criteria: [
      { name: "חופת עצים", text: "צל רציף לאורך מסלול ההליכה, לא עצים בודדים." },
      { name: "מקום לשהייה", text: "ספסלים, פינות ישיבה, מרחב לעמוד ולדבר." },
      { name: "ריהוט רחוב ותאורה", text: "תאורה בגובה הולך רגל ותחזוקה שוטפת." },
    ],
  },
];

export const TYPOLOGIES: Typology[] = [
  {
    key: "neighborhood_commercial",
    label: "מסחרי שכונתי",
    description: "ציר מסחר קטן שמשרת את השכונה — מכולת, בית קפה, שירותים.",
    benchmarks: { rowWidth: "16–22 מ'", ratio: "1:1 עד 1:1.5", canopy: "40%+" },
  },
  {
    key: "main_commercial",
    label: "מסחרי ראשי",
    description: "ציר מסחר עירוני עם תנועה גבוהה ופעילות לאורך היום.",
    benchmarks: { rowWidth: "24–35 מ'", ratio: "1:1.5 עד 1:2", canopy: "30%+" },
  },
  {
    key: "residential",
    label: "רחוב מגורים",
    description: "רחוב שקט שמשרת בעיקר את תושביו, עם תנועה מקומית.",
    benchmarks: { rowWidth: "12–18 מ'", ratio: "1:1", canopy: "50%+" },
  },
  {
    key: "boulevard",
    label: "שדרה",
    description: "ציר רחב עם טיילת מרכזית או שדרת עצים מפרידה.",
    benchmarks: { rowWidth: "30–50 מ'", ratio: "1:2", canopy: "45%+" },
  },
  {
    key: "pedestrian_mall",
    label: "מדרחוב",
    description: "רחוב להולכי רגל בלבד או בעדיפות מוחלטת להולכי רגל.",
    benchmarks: { rowWidth: "10–20 מ'", ratio: "1:1", canopy: "50%+" },
  },
  {
    key: "linear_park",
    label: "פארק קווי / ציר נופי",
    description: "ציר ירוק או חופי שמחבר בין חלקי העיר ומשמש גם לפנאי.",
    benchmarks: { rowWidth: "משתנה", ratio: "פתוח", canopy: "60%+" },
  },
];

export const STATUSES: { key: StatusKey; label: string; color: string }[] = [
  { key: "received", label: "התקבל", color: "#8B94A3" },
  { key: "under_review", label: "בבדיקה", color: "#C08A2E" },
  { key: "planned", label: "מתוכנן", color: "#2E6FA3" },
  { key: "in_progress", label: "בביצוע", color: "#1F7A5C" },
  { key: "done", label: "הושלם", color: "#14603F" },
];

export const EXAMPLES = [
  {
    title: "שדרה עם חופת עצים רציפה",
    place: "שדרות רוטשילד, תל אביב — Rothschild Boulevard, Tel Aviv, Israel",
    text: "טיילת מרכזית מוצלת שמייצרת מסלול הליכה עצמאי לאורך הציר, עם ישיבה לכל אורכו.",
    family: "texture",
  },
  {
    title: "חזית מסחרית עם מקצב כניסות צפוף",
    place: "רחוב לילינבלום, תל אביב — Lilienblum Street, Tel Aviv, Israel",
    text: "כניסה כל כמה מטרים, חלונות ראווה במפלס הרחוב, כמעט בלי קירות אטומים.",
    family: "frontage",
  },
  {
    title: "מדרחוב שכונתי",
    place: "מדרחוב נחלת בנימין, תל אביב — Nachalat Binyamin, Tel Aviv, Israel",
    text: "רחוב שמסירת הרכב ממנו הפכה אותו למרחב שהייה, לא רק מעבר.",
    family: "section",
  },
  {
    title: "ציר חופי כפארק קווי",
    place: "טיילת אשדוד — Ashdod Beach Promenade, Ashdod, Israel",
    text: "ציר נופי רציף שמחבר בין הרובעים המערביים לחוף, עם הצללה ונקודות שהייה.",
    family: "skeleton",
  },
  {
    title: "רחוב מגורים עם חתך מחולק",
    place: "רחוב פרוג, תל אביב — Frug Street, Tel Aviv, Israel",
    text: "רוחב זכות דרך צנוע שמחולק בבירור בין הליכה, עצים וחנייה.",
    family: "section",
  },
  {
    title: "כיכר קטנה כחלק מהרחוב",
    place: "Plaça de la Virreina, Barcelona, Spain",
    text: "הרחבה קטנה בתוך רצף הרחוב שמייצרת מקום לשהות בלי לפגוע בתנועה.",
    family: "texture",
  },
];

/** Schematic quarter polygons — a simple grid over Ashdod, for demo only. */
function ring(lon: number, lat: number, w = 0.016, h = 0.013): [number, number][] {
  return [
    [lon - w / 2, lat - h / 2],
    [lon + w / 2, lat - h / 2],
    [lon + w / 2, lat + h / 2],
    [lon - w / 2, lat + h / 2],
    [lon - w / 2, lat - h / 2],
  ];
}

const QUARTER_SEED: { id: string; name: string; center: [number, number] }[] = [
  { id: "q-a", name: "רובע א'", center: [34.6402, 31.8082] },
  { id: "q-b", name: "רובע ב'", center: [34.6556, 31.8085] },
  { id: "q-c", name: "רובע ג'", center: [34.6706, 31.8086] },
  { id: "q-d", name: "רובע ד'", center: [34.6404, 31.7955] },
  { id: "q-e", name: "רובע ה'", center: [34.6556, 31.7955] },
  { id: "q-f", name: "רובע ו'", center: [34.6706, 31.7955] },
  { id: "q-g", name: "רובע ז'", center: [34.6404, 31.7826] },
  { id: "q-h", name: "רובע ח'", center: [34.6556, 31.7826] },
  { id: "q-i", name: "רובע ט'", center: [34.6706, 31.7826] },
  { id: "q-j", name: "רובע י'", center: [34.6404, 31.7697] },
  { id: "q-k", name: "רובע י\"א", center: [34.6556, 31.7697] },
  { id: "q-l", name: "רובע י\"ב", center: [34.6706, 31.7697] },
  { id: "q-m", name: "רובע י\"ג", center: [34.6404, 31.7568] },
  { id: "q-n", name: "רובע י\"ד", center: [34.6556, 31.7568] },
  { id: "q-o", name: "רובע ט\"ו", center: [34.6706, 31.7568] },
  { id: "q-p", name: "רובע ט\"ז", center: [34.6860, 31.7826] },
  { id: "q-q", name: "רובע י\"ז", center: [34.6860, 31.7955] },
  { id: "q-marina", name: "אזור המרינה והחוף", center: [34.6255, 31.7955] },
];

export const QUARTERS: Quarter[] = QUARTER_SEED.map((q) => ({
  id: q.id,
  name: q.name,
  center: q.center,
  polygon: ring(q.center[0], q.center[1]),
  schematic: true,
}));


export const QUESTION_MAP = Object.fromEntries(QUESTIONS.map((q) => [q.key, q]));
export const TYPOLOGY_MAP = Object.fromEntries(TYPOLOGIES.map((t) => [t.key, t]));
export const QUARTER_MAP = Object.fromEntries(QUARTERS.map((q) => [q.id, q]));
export const STATUS_MAP = Object.fromEntries(STATUSES.map((s) => [s.key, s]));
