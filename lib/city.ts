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

import { STREET_QUARTERS } from "./street-quarters.generated";

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

export type FamilyKey = "skeleton" | "section" | "frontage" | "texture";

export type CriterionKey =
  | "axis_continuity"
  | "intersection_distance"
  | "transit_access"
  | "sidewalk_width"
  | "height_to_width"
  | "section_split"
  | "frontage_transparency"
  | "entrance_rhythm"
  | "mixed_use"
  | "tree_canopy"
  | "staying_place"
  | "furniture_lighting";

/** The measurable fields already carried on StreetAssignment.gis. */
export type GisMetricKey =
  | "rowWidthM"
  | "heightToWidth"
  | "canopyPct"
  | "intersectionDistanceM";

export interface Question {
  key: QuestionKey;
  label: string;
  help: string;
  /**
   * Terms the study uses inside this question that are not one of the twelve
   * criteria. Kept as written, so nothing from the source is lost.
   */
  alsoCovers: string[];
  /** true when the criterion is not part of the Planning Administration study. */
  local: boolean;
}

/**
 * How a criterion reaches a value.
 * "open" means the study names the criterion but the city has not yet decided
 * whether residents answer it or GIS measures it. It is stated, never guessed.
 */
export type CriterionLink =
  | { kind: "question"; questionKey: QuestionKey }
  | { kind: "gis"; metric: GisMetricKey }
  | { kind: "open"; note: string };

export interface Criterion {
  key: CriterionKey;
  name: string;
  text: string;
  familyKey: FamilyKey;
  link: CriterionLink;
}

export interface CriteriaFamily {
  key: FamilyKey;
  title: string;
  text: string;
  criteria: Criterion[];
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

/**
 * Built from the municipal street→quarter list
 * (data/ashdod-street-quarters.csv), matched against the national street
 * registry by scripts/assign-quarters.mjs. A name the registry does not
 * recognise is left out rather than guessed: the script reports it, and the
 * street simply shows "טרם שויך רובע" until someone decides.
 *
 * Street type (typology) is not in that list and stays unassigned.
 */
export const STREET_ASSIGNMENTS: Record<string, StreetAssignment> =
  Object.fromEntries(
    Object.entries(STREET_QUARTERS).map(([code, quarterId]) => [
      code,
      { quarterId } as StreetAssignment,
    ]),
  );

export const CITY = {
  id: "ashdod",
  name: "אשדוד",
  nameEn: "Ashdod",
  appTitle: "הרחובות הטובים של אשדוד",
  appShortTitle: "רחובות טובים",
  tagline: "מה הופך רחוב לטוב — ואיך אנחנו עושים את זה יחד",
  homeQuestion: "איזה רחוב באשדוד גורם לכם לרצות ללכת ברגל?",
  authority: "אגף אדריכלות העיר, עיריית אשדוד",
  /*
   * The municipal logo, as a file under public/. Left null until the official
   * file is in the repository: an app must not draw a city's mark from memory.
   * Set it to e.g. "/logo-ashdod.svg" once the file is there.
   */
  logo: null as string | null,
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
    alsoCovers: ["אקלים מקומי"],
    local: false,
  },
  {
    key: "walking",
    label: "הליכה וחצייה",
    help: "האם המדרכה רחבה ורציפה, והאם קל ובטוח לחצות?",
    alsoCovers: ["מעברי חצייה"],
    local: false,
  },
  {
    key: "frontages",
    label: "חזיתות",
    help: "האם חזיתות המבנים פתוחות לרחוב, עם חלונות וכניסות, ולא קירות אטומים?",
    alsoCovers: [],
    local: false,
  },
  {
    key: "staying",
    label: "מקום לשהות",
    help: "האם יש ספסל, כיכר קטנה או פינה שאפשר לעצור בה — ולא רק לעבור?",
    alsoCovers: ["יחס שהייה לתנועה"],
    local: false,
  },
  {
    key: "mix",
    label: "עירוב שימושים",
    help: "האם יש מסחר, שירותים ומגורים באותו רחוב, ופעילות לאורך היום?",
    alsoCovers: ["פעילות לאורך היום"],
    local: false,
  },
  {
    key: "maintenance",
    label: "תחזוקה",
    help: "האם הרחוב נקי, המדרכה שלמה והתאורה עובדת?",
    alsoCovers: [],
    local: true,
  },
  {
    key: "safety",
    label: "ביטחון",
    help: "האם נעים ובטוח להיות ברחוב גם בשעות הערב?",
    alsoCovers: [],
    local: true,
  },
];

/**
 * The four GIS metrics the street record already carries. A criterion measured
 * by the city points at one of these; nothing else is presented as measurable.
 */
export const GIS_METRICS: Record<GisMetricKey, { label: string; unit: string }> = {
  rowWidthM: { label: "רוחב זכות הדרך", unit: "מ'" },
  heightToWidth: { label: "יחס גובה לרוחב", unit: "" },
  canopyPct: { label: "שיעור חופת העצים", unit: "%" },
  intersectionDistanceM: { label: "מרחק בין צמתים", unit: "מ'" },
};

/**
 * The hierarchy the Learn screen renders: four families, twelve criteria, and
 * for each criterion the single place its value comes from.
 *
 * Three criteria carry link.kind === "open": the study names them, but the
 * city has not yet decided whether a resident question or a GIS metric answers
 * them. They are shown as open on purpose — filling them in here would be a
 * guess presented as policy.
 */
export const CRITERIA_FAMILIES: CriteriaFamily[] = [
  {
    key: "skeleton",
    title: "שלד",
    text: "הרשת שמחזיקה את הרחוב: רציפות, גודל המקטע ומרחק בין צמתים.",
    criteria: [
      {
        key: "axis_continuity",
        name: "רציפות הציר",
        text: "רחוב שממשיך ומתחבר לרחובות אחרים, בלי קטיעות.",
        familyKey: "skeleton",
        link: { kind: "open", note: "טרם נקבע אם נמדד בשאלה לתושבים או בשכבת GIS." },
      },
      {
        key: "intersection_distance",
        name: "מרחק בין צמתים",
        text: "מקטעים קצרים מייצרים יותר אפשרויות בחירה להולך הרגל.",
        familyKey: "skeleton",
        link: { kind: "gis", metric: "intersectionDistanceM" },
      },
      {
        key: "transit_access",
        name: "חיבור לתחבורה ציבורית",
        text: "תחנה במרחק הליכה נוח מרוב הכתובות ברחוב.",
        familyKey: "skeleton",
        link: { kind: "open", note: "טרם נקבע אם נמדד בשאלה לתושבים או בשכבת GIS." },
      },
    ],
  },
  {
    key: "section",
    title: "חתך",
    text: "חלוקת רוחב זכות הדרך בין הולכי רגל, עצים, אופניים ורכב.",
    criteria: [
      {
        key: "sidewalk_width",
        name: "רוחב מדרכה",
        text: "מדרכה שמאפשרת שני אנשים זה לצד זה בלי לרדת לכביש.",
        familyKey: "section",
        link: { kind: "question", questionKey: "walking" },
      },
      {
        key: "height_to_width",
        name: "יחס גובה לרוחב",
        text: "הפרופורציה בין גובה הבניינים לרוחב הרחוב מגדירה את תחושת המקום.",
        familyKey: "section",
        link: { kind: "gis", metric: "heightToWidth" },
      },
      {
        key: "section_split",
        name: "חלוקת החתך",
        text: "מקום מוגדר לכל שימוש — הליכה, עצים, ישיבה, אופניים, חנייה.",
        familyKey: "section",
        link: { kind: "question", questionKey: "walking" },
      },
    ],
  },
  {
    key: "frontage",
    title: "חזית",
    text: "הקו שבו הבניין פוגש את הרחוב — מה שקובע אם הרחוב חי.",
    criteria: [
      {
        key: "frontage_transparency",
        name: "שקיפות החזית",
        text: "חלונות וכניסות במפלס הרחוב במקום קירות וחניונים.",
        familyKey: "frontage",
        link: { kind: "question", questionKey: "frontages" },
      },
      {
        key: "entrance_rhythm",
        name: "מקצב הכניסות",
        text: "כניסות תכופות מייצרות רחוב מעניין להליכה.",
        familyKey: "frontage",
        link: { kind: "question", questionKey: "frontages" },
      },
      {
        key: "mixed_use",
        name: "עירוב שימושים",
        text: "מסחר, שירותים ומגורים באותו ציר.",
        familyKey: "frontage",
        link: { kind: "question", questionKey: "mix" },
      },
    ],
  },
  {
    key: "texture",
    title: "מרקם ואקלים",
    text: "מה שהופך רחוב לנעים בפועל, ביום חול בקיץ.",
    criteria: [
      {
        key: "tree_canopy",
        name: "חופת עצים",
        text: "צל רציף לאורך מסלול ההליכה, לא עצים בודדים.",
        familyKey: "texture",
        link: { kind: "question", questionKey: "shade" },
      },
      {
        key: "staying_place",
        name: "מקום לשהייה",
        text: "ספסלים, פינות ישיבה, מרחב לעמוד ולדבר.",
        familyKey: "texture",
        link: { kind: "question", questionKey: "staying" },
      },
      {
        key: "furniture_lighting",
        name: "ריהוט רחוב ותאורה",
        text: "תאורה בגובה הולך רגל ותחזוקה שוטפת.",
        familyKey: "texture",
        link: { kind: "open", note: "טרם נקבע אם נמדד בשאלת התחזוקה, בשאלת הביטחון, או בשכבת GIS." },
      },
    ],
  },
];

export const CRITERIA: Criterion[] = CRITERIA_FAMILIES.flatMap((f) => f.criteria);

export const CRITERION_MAP = Object.fromEntries(
  CRITERIA.map((c) => [c.key, c]),
) as Record<CriterionKey, Criterion>;

export const FAMILY_MAP = Object.fromEntries(
  CRITERIA_FAMILIES.map((f) => [f.key, f]),
) as Record<FamilyKey, CriteriaFamily>;

/** The reverse of the link: which criteria a resident question stands for. */
export function criteriaForQuestion(questionKey: QuestionKey): Criterion[] {
  return CRITERIA.filter(
    (c) => c.link.kind === "question" && c.link.questionKey === questionKey,
  );
}

/** Criteria the study names but the city has not yet assigned a source to. */
export const OPEN_CRITERIA = CRITERIA.filter((c) => c.link.kind === "open");

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

export interface Example {
  key: string;
  title: string;
  /** Hebrew name plus the Latin name, so the place is findable on a map. */
  place: string;
  text: string;
  family: FamilyKey;
  /**
   * Criteria the example's own description names. Nothing is tagged that the
   * text does not say, so the filter never promises more than the library has.
   */
  criterionKeys: CriterionKey[];
  /** Set only where the description states the street type. */
  typology: TypologyKey | null;
}

export const EXAMPLES: Example[] = [
  {
    key: "rothschild",
    title: "שדרה עם חופת עצים רציפה",
    place: "שדרות רוטשילד, תל אביב — Rothschild Boulevard, Tel Aviv, Israel",
    text: "טיילת מרכזית מוצלת שמייצרת מסלול הליכה עצמאי לאורך הציר, עם ישיבה לכל אורכו.",
    family: "texture",
    criterionKeys: ["tree_canopy", "staying_place"],
    typology: "boulevard",
  },
  {
    key: "lilienblum",
    title: "חזית מסחרית עם מקצב כניסות צפוף",
    place: "רחוב לילינבלום, תל אביב — Lilienblum Street, Tel Aviv, Israel",
    text: "כניסה כל כמה מטרים, חלונות ראווה במפלס הרחוב, כמעט בלי קירות אטומים.",
    family: "frontage",
    criterionKeys: ["entrance_rhythm", "frontage_transparency"],
    typology: null,
  },
  {
    key: "nachalat-binyamin",
    title: "מדרחוב שכונתי",
    place: "מדרחוב נחלת בנימין, תל אביב — Nachalat Binyamin, Tel Aviv, Israel",
    text: "רחוב שמסירת הרכב ממנו הפכה אותו למרחב שהייה, לא רק מעבר.",
    family: "section",
    criterionKeys: ["section_split", "staying_place"],
    typology: "pedestrian_mall",
  },
  {
    key: "ashdod-promenade",
    title: "ציר חופי כפארק קווי",
    place: "טיילת אשדוד — Ashdod Beach Promenade, Ashdod, Israel",
    text: "ציר נופי רציף שמחבר בין הרובעים המערביים לחוף, עם הצללה ונקודות שהייה.",
    family: "skeleton",
    criterionKeys: ["axis_continuity", "tree_canopy", "staying_place"],
    typology: "linear_park",
  },
  {
    key: "frug",
    title: "רחוב מגורים עם חתך מחולק",
    place: "רחוב פרוג, תל אביב — Frug Street, Tel Aviv, Israel",
    text: "רוחב זכות דרך צנוע שמחולק בבירור בין הליכה, עצים וחנייה.",
    family: "section",
    criterionKeys: ["section_split"],
    typology: "residential",
  },
  {
    key: "virreina",
    title: "כיכר קטנה כחלק מהרחוב",
    place: "Plaça de la Virreina, Barcelona, Spain",
    text: "הרחבה קטנה בתוך רצף הרחוב שמייצרת מקום לשהות בלי לפגוע בתנועה.",
    family: "texture",
    criterionKeys: ["staying_place"],
    typology: null,
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

/**
 * Besides the numbered quarters, the municipal list classifies streets into
 * areas that are not quarters: the city centre, the southern CBD, the marina,
 * the industrial zones, the port hinterland, and the boulevards that cross the
 * city. They are kept as areas so no street loses its classification.
 *
 * The crossing boulevards are not a place: a street there runs through several
 * quarters. Its box on the map is schematic like all the rest, until the
 * municipal GIS lines replace it.
 */
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
  { id: "q-city", name: "הקריה (הסיטי)", center: [34.6255, 31.8082] },
  { id: "q-cbd-south", name: "מע\"ר דרום", center: [34.6255, 31.7826] },
  { id: "q-main-axis", name: "צירים ראשיים חוצי עיר", center: [34.6255, 31.7697] },
  { id: "q-port", name: "עורף הנמל", center: [34.6255, 31.8211] },
  { id: "q-ind-north", name: "אזור תעשייה צפוני", center: [34.6404, 31.8211] },
  { id: "q-ind-halutzim", name: "אזור תעשייה קריית חלוצים", center: [34.6556, 31.8211] },
  { id: "q-ind-light", name: "אזור תעשייה קלה", center: [34.6706, 31.8211] },
  { id: "q-ind-ad-halom", name: "אזור תעשייה עד הלום", center: [34.6860, 31.7697] },
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
