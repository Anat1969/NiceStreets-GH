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

/**
 * שנים־עשר הקריטריונים, בסדר ובניסוח של "הרחובות הטובים — זיקוק
 * הקריטריונים" (מינהל התכנון, היחידה לתכנון אסטרטגי, 2026; זיקוק של
 * אד' ענת דוד שטיבלמן). הרשימה הקודמת כאן נכתבה לפני שהמסמך היה בידי,
 * ולא הייתה זהה לו — לא בשמות, לא בחלוקה למשפחות ולא במה שנמדד.
 */
export type CriterionKey =
  | "place_and_movement"
  | "intersection_density"
  | "mixed_use"
  | "row_width"
  | "proportions"
  | "row_split"
  | "plot_street_meeting"
  | "transparency"
  | "building_rhythm"
  | "shared_language"
  | "small_plots"
  | "tree_canopy";

/** The measurable fields already carried on StreetAssignment.gis. */
export type GisMetricKey =
  | "rowWidthM"
  | "heightToWidth"
  | "canopyPct"
  | "intersectionDistanceM"
  | "buildingsPer100m"
  | "plotFrontageM";

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
  /**
   * אב הטיפוס במספרים, מתוך טבלת הטיפולוגיות במסמך. כל אב טיפוס נגזר
   * משלושה רחובות בלבד — כיוון, לא תקן.
   */
  benchmarks: {
    rowWidth: string;
    sidewalk: string;
    ratio: string;
    frontage: string;
    buildings: string;
    canopy: string;
    intersections: string;
  };
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
    buildingsPer100m?: number;
    plotFrontageM?: number;
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
/**
 * The area the municipal list uses for boulevards that run through several
 * quarters. A street assigned to it is rated per stretch — see lib/segments.ts.
 */
export const CROSSING_AREA_ID = "q-main-axis";

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
  buildingsPer100m: { label: "בניינים לכל 100 מ' דופן", unit: "" },
  plotFrontageM: { label: "רוחב חזית המגרש", unit: "מ'" },
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
    text: "האם מגיעים לרחוב? הרחוב ברשת העירונית — מקום מול תנועה, צמתים ושימושים.",
    criteria: [
      {
        key: "place_and_movement",
        name: "מקום ותנועה",
        text:
          "הרחוב האהוב הוא יעד בפני עצמו, לא רק צינור שעוברים בו. נבדק מיקומו " +
          "במטריצת מקום–תנועה: כמה הוא מזמין שהייה, וכמה הוא ציר מעבר.",
        familyKey: "skeleton",
        link: {
          kind: "open",
          note:
            "המסמך מדרג ידנית במטריצת Link and Place. טרם נקבע אם באשדוד " +
            "הדירוג ייעשה בשאלה לתושבים או בניתוח של האגף.",
        },
      },
      {
        key: "intersection_density",
        name: "צפיפות צמתים",
        text:
          "צמתים קרובים פירושם יותר דרכים להגיע, יותר הליכה ויותר מסחר. " +
          "נמדד המרחק הממוצע בין צמתים ומגוון אורכי הבלוקים לאורך הרחוב.",
        familyKey: "skeleton",
        link: { kind: "gis", metric: "intersectionDistanceM" },
      },
      {
        key: "mixed_use",
        name: "עירוב שימושים",
        text:
          "רחוב \"חי\" הוא רחוב שיש סיבה להגיע אליו בכל שעה. נמדד היחס בין " +
          "שטחים סחירים לשטחים ציבוריים, וקומת קרקע פעילה.",
        familyKey: "skeleton",
        link: { kind: "question", questionKey: "mix" },
      },
    ],
  },
  {
    key: "section",
    title: "חתך",
    text: "האם נעים לעמוד בו? רוחב זכות הדרך, הפרופורציות, ולמי מחולק הרוחב.",
    criteria: [
      {
        key: "row_width",
        name: "רוחב זכות הדרך",
        text:
          "צר עובד. חתך צר מאפשר לחצות, לראות את הצד השני ולהרגיש בתוך חלל. " +
          "נמדד המרחק בין קווי המגרש משני צידי הרחוב.",
        familyKey: "section",
        link: { kind: "gis", metric: "rowWidthM" },
      },
      {
        key: "proportions",
        name: "פרופורציות ומוגדרות",
        text:
          "הרחוב מרגיש כמו חדר כשהבניינים — או העצים — סוגרים עליו. נמדד היחס " +
          "בין רוחב הרחוב לגובה המבנים, והמרווח בין בניינים שכנים.",
        familyKey: "section",
        link: { kind: "gis", metric: "heightToWidth" },
      },
      {
        key: "row_split",
        name: "חלוקת זכות הדרך",
        text:
          "השאלה היא למי שייך הרחוב: לרכב או לאדם. נמדדת חלוקת הרוחב בין " +
          "מדרכה, מיסעה, חניה ושביל אופניים.",
        familyKey: "section",
        link: { kind: "question", questionKey: "walking" },
      },
    ],
  },
  {
    key: "frontage",
    title: "דופן",
    text: "האם מעניין ללכת בו? המטר הראשון מהמדרכה, השקיפות, המקצב והשפה.",
    criteria: [
      {
        key: "plot_street_meeting",
        name: "מפגש מגרש–רחוב",
        text:
          "המטר הראשון מהמדרכה קובע אם הבניין מדבר עם הרחוב. נמדד המרחק בין " +
          "הבניין לגבול המגרש, ומה נמצא ביניהם: חזית, חצר או גדר.",
        familyKey: "frontage",
        link: {
          kind: "open",
          note:
            "דורש קו בניין וחזית לכל מגרש. אינו בשכבת ה-GIS שבידי האגף, " +
            "וטרם נקבע אם ייאסף בסקר שטח או מהתב\"ע.",
        },
      },
      {
        key: "transparency",
        name: "שקיפות וחזית פעילה",
        text:
          "חזית שקופה מזמינה סקרנות וביטחון; חזית אטומה מנתקת. נבדקים חלונות " +
          "ראווה, פתחים וכניסות מול קירות אטומים וקומות חניה.",
        familyKey: "frontage",
        link: { kind: "question", questionKey: "frontages" },
      },
      {
        key: "building_rhythm",
        name: "מקצב בניינים",
        text:
          "הרבה בניינים קטנים פירושם הליכה מעניינת וקנה מידה אנושי. נספר מספר " +
          "הבניינים לכל 100 מ' של דופן, בצד הגבוה מבין השניים.",
        familyKey: "frontage",
        link: { kind: "gis", metric: "buildingsPer100m" },
      },
      {
        key: "shared_language",
        name: "שפה משותפת עם מגוון",
        text:
          "מסגרת אחת, הרבה קולות: אחידות בגובה ובחומר, שונות בסגנון. נבדקת " +
          "לכידות חזותית — גובה ונפח, קו בניין וחומרים דומים — בלי חזרתיות.",
        familyKey: "frontage",
        link: {
          kind: "open",
          note:
            "הערכה חזותית ולא מדידה. טרם נקבע אם תיקבע בעין מקצועית באגף או " +
            "בשאלה נוספת לתושבים.",
        },
      },
    ],
  },
  {
    key: "texture",
    title: "מרקם ואקלים",
    text: "האם יחזיק מעמד וישרוד קיץ? גודל המגרשים, וחופת העצים.",
    criteria: [
      {
        key: "small_plots",
        name: "מגרשים קטנים",
        text:
          "מגרש קטן מאפשר לרחוב להתחדש בהדרגה במקום להשתנות בבת אחת. נבדק " +
          "תמהיל גודלי המגרשים לאורך הרחוב, ורוחב חזית המגרש לרחוב.",
        familyKey: "texture",
        link: { kind: "gis", metric: "plotFrontageM" },
      },
      {
        key: "tree_canopy",
        name: "חופת עצים והצללה",
        text:
          "באקלים הישראלי הצל הוא תנאי להליכה, לא קישוט. נמדד אחוז שטח הרחוב " +
          "שמכוסה בחופת עצים, וההצללה מהבינוי.",
        familyKey: "texture",
        link: { kind: "question", questionKey: "shade" },
      },
    ],
  },
];

/**
 * שלוש השאלות שהמסמך אינו מודד, והאפליקציה כן שואלת.
 *
 * המסמך אומר זאת במפורש: "טיפוח וביטחון לא נמדדים במסמך — ודווקא אותם
 * העירייה יכולה לשפר מהר". השהייה נשאלת מאותה סיבה: היא מה שהתושבים
 * מתארים, גם כשאין לה מדד.
 */
export const LOCAL_QUESTION_KEYS: QuestionKey[] = ["staying", "maintenance", "safety"];

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

/** העמוד שבו הקריטריון נמצא, אחרי פירוק מסך הלימוד לעמודים נפרדים. */
export function criterionHref(key: CriterionKey): string {
  return `/learn/criteria/${CRITERION_MAP[key].familyKey}`;
}

/** Criteria the study names but the city has not yet assigned a source to. */
export const OPEN_CRITERIA = CRITERIA.filter((c) => c.link.kind === "open");

export const TYPOLOGIES: Typology[] = [
  {
    key: "neighborhood_commercial",
    label: "מסחרי שכונתי",
    description: "ציר מסחר קטן שמשרת את השכונה — מכולת, בית קפה, שירותים.",
    benchmarks: {
      rowWidth: "12–14 מ'",
      sidewalk: "50%",
      ratio: "1:1 עד 1:1.2",
      frontage: "מסחרית, קו בניין 0",
      buildings: "3–4",
      canopy: "כ-10%",
      intersections: "70–90 מ'",
    },
  },
  {
    key: "main_commercial",
    label: "מסחרי ראשי",
    description: "ציר מסחר עירוני עם תנועה גבוהה ופעילות לאורך היום.",
    benchmarks: {
      rowWidth: "18–25 מ'",
      sidewalk: "40%",
      ratio: "1:1.2 עד 1:1.5",
      frontage: "מסחרית, קו בניין 0",
      buildings: "3.5",
      canopy: "כ-35%",
      intersections: "80–120 מ'",
    },
  },
  {
    key: "residential",
    label: "רחוב מגורים",
    description: "רחוב שקט שמשרת בעיקר את תושביו, עם תנועה מקומית.",
    benchmarks: {
      rowWidth: "11.5–21 מ'",
      sidewalk: "40%",
      ratio: "1:1.5 עד 1:1.8",
      frontage: "חצר וגדר נמוכה",
      buildings: "2–3.5",
      canopy: "כ-50%",
      intersections: "80–125 מ'",
    },
  },
  {
    key: "boulevard",
    label: "שדרה עירונית",
    description: "ציר רחב עם טיילת מרכזית או שדרת עצים מפרידה.",
    benchmarks: {
      rowWidth: "30–40 מ'",
      sidewalk: "55%",
      ratio: "1:2.5 עד 1:3",
      frontage: "חצר או מסחרית",
      buildings: "4–5",
      canopy: "כ-33%",
      intersections: "70–105 מ'",
    },
  },
  {
    key: "pedestrian_mall",
    label: "מדרחוב",
    description: "רחוב להולכי רגל בלבד או בעדיפות מוחלטת להולכי רגל.",
    benchmarks: {
      rowWidth: "11–18 מ'",
      sidewalk: "100%",
      ratio: "כ-1:1",
      frontage: "מסחרית, קו בניין 0",
      buildings: "כ-5",
      canopy: "כ-5%",
      intersections: "50–105 מ'",
    },
  },
  {
    key: "linear_park",
    label: "נופי / פארק לינארי",
    description: "ציר ירוק או חופי שמחבר בין חלקי העיר ומשמש גם לפנאי.",
    benchmarks: {
      rowWidth: "18–80 מ'",
      sidewalk: "משתנה",
      ratio: "משתנה",
      frontage: "חצר או שטח פתוח",
      buildings: "2–2.8",
      canopy: "7–25%",
      intersections: "125–250 מ'",
    },
  },
];

/*
 * הצבעים נושאים טקסט לבן ב-13px, ולכן כל אחד חייב לעבור 4.5:1 מול לבן.
 * "התקבל" ו"בבדיקה" היו 3.05 ו-3.01 והוכהו; שלושת האחרים עברו כפי שהם.
 */
export const STATUSES: { key: StatusKey; label: string; color: string }[] = [
  { key: "received", label: "התקבל", color: "#667283" },
  { key: "under_review", label: "בבדיקה", color: "#96690F" },
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
  /** Set only where the street's own official name states the type. */
  typology: TypologyKey | null;
  /** המקור שממנו נלקחו הדוגמה והמספר שבה, כולל מספרי עמודים. */
  source: string;
}

export const EXAMPLES: Example[] = [
  {
    key: "place_and_movement",
    title: "מקום ועורק תנועה גם יחד",
    place: "רחוב דיזנגוף, תל אביב — Dizengoff Street, Tel Aviv, Israel",
    text: "כל 18 הרחובות שנותחו דורגו גבוה כ\"מקום\"; החשיבות התנועתית היא שמשתנה ביניהם. דיזנגוף מחזיק את שניהם בו-זמנית.",
    family: "skeleton",
    criterionKeys: ["place_and_movement"],
    typology: null,
    source: "מינהל התכנון, \"הרחובות הטובים\", 2026, עמ' 20, 27",
  },
  {
    key: "intersection_density",
    title: "52 מ' בממוצע בין צמתים",
    place: "רחוב פלורנטין, תל אביב — Florentin Street, Tel Aviv, Israel",
    text: "ב-15 מתוך 18 הרחובות המרחק החציוני בין צמתים קטן מ-150 מ'. בפלורנטין הוא 52 מ', והרשת הצפופה היא שמייצרת את ההליכה.",
    family: "skeleton",
    criterionKeys: ["intersection_density"],
    typology: null,
    source: "מינהל התכנון, \"הרחובות הטובים\", 2026, עמ' 19, 30",
  },
  {
    key: "mixed_use",
    title: "שוק לצד עסקים קטנים",
    place: "רחוב סירקין, הדר הכרמל, חיפה — Syrkin Street, Hadar HaCarmel, Haifa, Israel",
    text: "שוק תלפיות לצד עסקים קטנים. המילה שחוזרת בנימוקי המשיבים היא \"חי\": מסחר, שירותים ומגורים באותו רחוב, לאורך כל היום.",
    family: "skeleton",
    criterionKeys: ["mixed_use"],
    typology: null,
    source: "מינהל התכנון, \"הרחובות הטובים\", 2026, עמ' 21, 42",
  },
  {
    key: "row_width",
    title: "רוחב 14 מ'",
    place: "רחוב נחלת בנימין, תל אביב — Nahalat Binyamin Street, Tel Aviv, Israel",
    text: "11 מתוך 18 הרחובות ברוחב 10–20 מ'. הספרות ממליצה על עד 30 מ', ובשדרות 30–40 מ'.",
    family: "section",
    criterionKeys: ["row_width"],
    typology: null,
    source: "מינהל התכנון, \"הרחובות הטובים\", 2026, עמ' 22, 28",
  },
  {
    key: "proportions",
    title: "העצים מגדירים חלל רחב",
    place: "שדרות רוטשילד, תל אביב — Rothschild Boulevard, Tel Aviv, Israel",
    text: "מוגדרות חזקה מתחילה ביחס 1:2 ומטה; ברחובות טובים רבים היחס הוא 1:1 עד 1:1.25. כאן דווקא העצים, ולא הבניינים, סוגרים את החלל.",
    family: "section",
    criterionKeys: ["proportions"],
    typology: "boulevard",
    source: "מינהל התכנון, \"הרחובות הטובים\", 2026, עמ' 23, 25, 29",
  },
  {
    key: "row_split",
    title: "56% מדרכה, 16% אופניים",
    place: "רחוב דיזנגוף, תל אביב — Dizengoff Street, Tel Aviv, Israel",
    text: "ב-11 מתוך 18 הרחובות לפחות מחצית מזכות הדרך היא מדרכה. בשישה מהם יש גם שביל אופניים.",
    family: "section",
    criterionKeys: ["row_split"],
    typology: null,
    source: "מינהל התכנון, \"הרחובות הטובים\", 2026, עמ' 22, 33",
  },
  {
    key: "plot_street_meeting",
    title: "חצר קדמית וגדר נמוכה",
    place: "רחוב דובנוב, תל אביב — Dubnov Street, Tel Aviv, Israel",
    text: "ברחובות מסחריים קו הבניין הוא 0 מ'. ברחובות מגורים, חצר קדמית וגדר נמוכה שמאפשרת להציץ.",
    family: "frontage",
    criterionKeys: ["plot_street_meeting"],
    typology: null,
    source: "מינהל התכנון, \"הרחובות הטובים\", 2026, עמ' 22, 68",
  },
  {
    key: "transparency",
    title: "בתי מלאכה וברים נפתחים למדרכה",
    place: "רחוב פלורנטין, תל אביב — Florentin Street, Tel Aviv, Israel",
    text: "חזיתות עשירות בפרטים מאטות את ההליכה ומעודדות שהייה. גדרות גבוהות יוצרות מונוטוניות.",
    family: "frontage",
    criterionKeys: ["transparency"],
    typology: null,
    source: "מינהל התכנון, \"הרחובות הטובים\", 2026, עמ' 25, 100",
  },
  {
    key: "building_rhythm",
    title: "5.2 בניינים לכל 100 מ'",
    place: "שדרות ארלוזורוב, עפולה — Arlozorov Boulevard, Afula, Israel",
    text: "ברוב הרחובות 3–5 בניינים לכל 100 מ'. במדרחובים ובשדרות עד 5.",
    family: "frontage",
    criterionKeys: ["building_rhythm"],
    typology: "boulevard",
    source: "מינהל התכנון, \"הרחובות הטובים\", 2026, עמ' 24, 90",
  },
  {
    key: "shared_language",
    title: "אבן ירושלמית כשפה אחת",
    place: "רחוב עמק רפאים, המושבה הגרמנית, ירושלים — Emek Refaim Street, German Colony, Jerusalem, Israel",
    text: "ברוב הרחובות יש שפה משותפת, ובתוכה מבנים משניים, סגנונות וגבהים שונים.",
    family: "frontage",
    criterionKeys: ["shared_language"],
    typology: null,
    source: "מינהל התכנון, \"הרחובות הטובים\", 2026, עמ' 9, 25, 48",
  },
  {
    key: "small_plots",
    title: "ריבוי מגרשים קטנים",
    place: "רחוב ביאליק, רמת גן — Bialik Street, Ramat Gan, Israel",
    text: "ב-12 מתוך 18 הרחובות, 80% ומעלה מהמגרשים הם עד דונם. רוחב חזית אופייני: 16–37 מ'.",
    family: "texture",
    criterionKeys: ["small_plots"],
    typology: null,
    source: "מינהל התכנון, \"הרחובות הטובים\", 2026, עמ' 7, 21, 32",
  },
  {
    key: "tree_canopy",
    title: "56% חופת עצים",
    place: "רחוב הנשיא בן צבי, הרצליה — HaNasi Ben Zvi Street, Herzliya, Israel",
    text: "מחצית מהמשיבים לסקר ציינו עצים והצללה. בשמונה מתוך 18 הרחובות החופה מעל 20%. ברחובות צרים גם הבניינים מצלים.",
    family: "texture",
    criterionKeys: ["tree_canopy"],
    typology: null,
    source: "מינהל התכנון, \"הרחובות הטובים\", 2026, עמ' 9, 21, 31",
  },
];

/*
 * TODO — שכבות ה-GIS העירוניות אינן במאגר.
 *
 * אין כאן פוליגונים. עד גרסה זו נוצר כאן ריבוע לכל רובע, והמפה ציירה אותו
 * כאילו היה הגבול האמיתי. ריבוע כזה הוא מידע שגוי שנראה כמו מידע נכון,
 * והוא הוסר.
 *
 * ה-`center` שלמטה הוא נקודת פתיחה לכלי המיקום של הצוות בלבד, לא מיקום
 * אמיתי — ולכן כל רובע מסומן `schematic: true` והמפה אינה מציירת אותו.
 * רובע מצויר רק אחרי שהצוות מיקם אותו, או אחרי טעינת `data/quarters.geojson`
 * דרך `npm run import:gis`.
 */

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
  polygon: [],
  schematic: true,
}));


export const QUESTION_MAP = Object.fromEntries(QUESTIONS.map((q) => [q.key, q]));
export const TYPOLOGY_MAP = Object.fromEntries(TYPOLOGIES.map((t) => [t.key, t]));
export const QUARTER_MAP = Object.fromEntries(QUARTERS.map((q) => [q.id, q]));
export const STATUS_MAP = Object.fromEntries(STATUSES.map((s) => [s.key, s]));

/**
 * הדוגמה של כל קריטריון, לפי מפתח הקריטריון. במסמך יש בדיוק דוגמה אחת
 * לכל קריטריון, ולכן מפתח הדוגמה זהה לו.
 */
export const EXAMPLE_MAP = Object.fromEntries(
  EXAMPLES.map((e) => [e.key, e]),
) as Partial<Record<CriterionKey, Example>>;
