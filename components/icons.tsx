/**
 * ערכת האייקונים של מסכי הלימוד.
 *
 * שפה אחת לכולם: רשת 24, קו 1.5, קצוות מעוגלים, צבע יחיד מ-currentColor,
 * בלי מילוי. הסגנון הוא שרטוט אדריכלי — תוכניות, חתכים, עצים, חזיתות,
 * ואנשים — ולא אייקונים של ממשק.
 *
 * האייקונים משמשים בתוכן הלימוד בלבד. בניווט יש תוויות טקסט ואין אייקונים.
 * כל אייקון הוא דקורטיבי: הכותרת שלצדו נושאת את המשמעות, ולכן aria-hidden.
 *
 * לצפייה בכולם יחד: /learn/icons (צוות בלבד).
 */

import type { CriterionKey, FamilyKey, TypologyKey } from "@/lib/city";

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/* ----------------------------------------------------- שנים־עשר הקריטריונים */

/** מקום ותנועה: ציר שעוברים בו, ועליו סימן שהוא גם יעד. */
const PlaceAndMovement = () => (
  <Icon>
    <path d="M2 18h20" />
    <path d="M5 18v-2M11 18v-2M17 18v-2" />
    <path d="M12 3a3.2 3.2 0 0 1 3.2 3.2c0 2.3-3.2 5.3-3.2 5.3S8.8 8.5 8.8 6.2A3.2 3.2 0 0 1 12 3Z" />
    <circle cx="12" cy="6.2" r="1" />
  </Icon>
);

/** צפיפות צמתים: שני צמתים וקו מידה קצר ביניהם. */
const IntersectionDensity = () => (
  <Icon>
    <path d="M6 3v18M18 3v18" />
    <path d="M3 8h18" />
    <path d="M6 16h12" />
    <path d="M8 14l-2 2 2 2M16 14l2 2-2 2" />
  </Icon>
);

/** עירוב שימושים: מסחר למטה, מגורים למעלה. */
const MixedUse = () => (
  <Icon>
    <path d="M4 21V3h16v18" />
    <path d="M2 21h20" />
    <path d="M4 10h16" />
    <rect x="7" y="5.5" width="3" height="3" />
    <rect x="14" y="5.5" width="3" height="3" />
    <path d="M7 21v-7h4v7" />
    <path d="M14 14h3" />
  </Icon>
);

/** רוחב זכות הדרך: קו מידה בין שני קווי המגרש. */
const RowWidth = () => (
  <Icon>
    <path d="M3 4v16M21 4v16" />
    <path d="M3 12h18" />
    <path d="M6 9l-3 3 3 3M18 9l3 3-3 3" />
    <path d="M3 19h4M17 19h4" />
  </Icon>
);

/** פרופורציות ומוגדרות: שני בניינים והיחס בין הרוחב לגובה. */
const Proportions = () => (
  <Icon>
    <path d="M3 21V6h5v15M16 21V9h5v12" />
    <path d="M2 21h20" />
    <path d="M8 14h8M10 12l-2 2 2 2M14 12l2 2-2 2" />
  </Icon>
);

/** חלוקת זכות הדרך: רצועות נפרדות לכל שימוש. */
const RowSplit = () => (
  <Icon>
    <path d="M2 19h20" />
    <path d="M6 19v-4M12 19v-7M18 19v-4" />
    <path d="M2 15h4M6 15h6M12 15h6M18 15h4" />
    <path d="M9 12v3M15 12v3" />
  </Icon>
);

/** מפגש מגרש–רחוב: מדרכה, גדר נמוכה, חצר, ואז הבניין. */
const PlotStreetMeeting = () => (
  <Icon>
    <path d="M2 20h20" />
    <path d="M2 16h20" />
    <path d="M6 16v-2M9 16v-2M12 16v-2" />
    <path d="M15 16V6h6v10" />
    <path d="M17 16v-3h2v3" />
  </Icon>
);

/** שקיפות וחזית פעילה: חלונות וכניסה, לא קיר אטום. */
const Transparency = () => (
  <Icon>
    <path d="M3 21V5h18v16" />
    <path d="M2 21h20" />
    <rect x="6" y="9" width="4" height="4" />
    <rect x="14" y="9" width="4" height="4" />
    <path d="M10 21v-5h4v5" />
  </Icon>
);

/** מקצב בניינים: הרבה בניינים צרים לאורך הדופן. */
const BuildingRhythm = () => (
  <Icon>
    <path d="M2 21h20" />
    <path d="M3 21V8h4v13M9 21V6h4v15M15 21V9h4v12" />
    <path d="M4.5 21v-3h1v3M10.5 21v-3h1v3M16.5 21v-3h1v3" />
  </Icon>
);

/** שפה משותפת עם מגוון: גובה וקו בניין אחידים, גגות שונים. */
const SharedLanguage = () => (
  <Icon>
    <path d="M2 21h20" />
    <path d="M3 21V11h5v10M16 21V11h5v10" />
    <path d="M9.5 21V11h5v10" />
    <path d="M3 11l2.5-3L8 11" />
    <path d="M9.5 11h5" />
    <path d="M16 11l2.5-2.5L21 11" />
  </Icon>
);

/** מגרשים קטנים: תוכנית, כמה מגרשים צרים לאורך הרחוב. */
const SmallPlots = () => (
  <Icon>
    <path d="M2 16h20" />
    <path d="M3 16V6h18v10" />
    <path d="M7.5 16V6M12 16V6M16.5 16V6" />
    <path d="M2 20h20" />
  </Icon>
);

/** חופת עצים והצללה: צמרות רציפות מעל מסלול ההליכה. */
const TreeCanopy = () => (
  <Icon>
    <path d="M2 20h20" />
    <path d="M7 20v-5M17 20v-5" />
    <path d="M3 9a4 4 0 0 1 8 0 4 4 0 0 1-4 3 4 4 0 0 1-4-3Z" />
    <path d="M13 9a4 4 0 0 1 8 0 4 4 0 0 1-4 3 4 4 0 0 1-4-3Z" />
  </Icon>
);

export const CRITERION_ICONS: Record<CriterionKey, () => React.ReactElement> = {
  place_and_movement: PlaceAndMovement,
  intersection_density: IntersectionDensity,
  mixed_use: MixedUse,
  row_width: RowWidth,
  proportions: Proportions,
  row_split: RowSplit,
  plot_street_meeting: PlotStreetMeeting,
  transparency: Transparency,
  building_rhythm: BuildingRhythm,
  shared_language: SharedLanguage,
  small_plots: SmallPlots,
  tree_canopy: TreeCanopy,
};

/* ------------------------------------------------------------ ארבע המשפחות */

/** שלד: רשת רחובות. */
const FamilySkeleton = () => (
  <Icon>
    <path d="M3 8h18M3 16h18M8 3v18M16 3v18" />
  </Icon>
);

/** חתך: קו קרקע ובניין משני צדדיו. */
const FamilySection = () => (
  <Icon>
    <path d="M2 18h20" />
    <path d="M3 18V8h4v10M17 18V8h4v10" />
    <path d="M9 18v-2h6v2" />
  </Icon>
);

/** חזית: מישור הבניין מול הרחוב. */
const FamilyFrontage = () => (
  <Icon>
    <path d="M2 21h20" />
    <path d="M4 21V4h16v17" />
    <path d="M7 8h4M13 8h4M7 13h4M13 13h4" />
    <path d="M10 21v-4h4v4" />
  </Icon>
);

/** מרקם ואקלים: עץ ושמש. */
const FamilyTexture = () => (
  <Icon>
    <path d="M2 20h20" />
    <path d="M9 20v-6" />
    <path d="M5 11a4 4 0 0 1 8 0 4 4 0 0 1-4 3 4 4 0 0 1-4-3Z" />
    <circle cx="18" cy="6" r="2.2" />
    <path d="M18 2v1M18 9v1M14.5 6h-1M22.5 6h-1" />
  </Icon>
);

export const FAMILY_ICONS: Record<FamilyKey, () => React.ReactElement> = {
  skeleton: FamilySkeleton,
  section: FamilySection,
  frontage: FamilyFrontage,
  texture: FamilyTexture,
};

/* ------------------------------------------------------- שש הטיפולוגיות */

const NeighborhoodCommercial = () => (
  <Icon>
    <path d="M2 20h20" />
    <path d="M4 20V9h7v11M13 20v-7h7v7" />
    <path d="M4 9l2-3h5l2 3" />
    <rect x="6" y="12" width="3" height="3" />
  </Icon>
);

const MainCommercial = () => (
  <Icon>
    <path d="M2 21h20" />
    <path d="M3 21V4h6v17M15 21V7h6v14" />
    <path d="M5 8h2M5 12h2M17 11h2M17 15h2" />
    <path d="M11 21v-4h2v4" />
  </Icon>
);

const Residential = () => (
  <Icon>
    <path d="M2 20h20" />
    <path d="M4 20v-8l4-3 4 3v8" />
    <path d="M14 20v-6l3-2 3 2v6" />
    <path d="M7 20v-3h2v3" />
  </Icon>
);

const Boulevard = () => (
  <Icon>
    <path d="M2 20h20M2 4h20" />
    <path d="M12 4v16" />
    <path d="M12 9a2.5 2.5 0 0 1 5 0 2.5 2.5 0 0 1-2.5 2 2.5 2.5 0 0 1-2.5-2Z" />
    <path d="M7 13a2.5 2.5 0 0 1 5 0 2.5 2.5 0 0 1-2.5 2A2.5 2.5 0 0 1 7 13Z" />
  </Icon>
);

const PedestrianMall = () => (
  <Icon>
    <path d="M3 21V5h18v16" />
    <path d="M2 21h20" />
    <circle cx="9" cy="10" r="1.5" />
    <path d="M9 12v4M7.5 21l1.5-5 1.5 5" />
    <circle cx="16" cy="11" r="1.3" />
    <path d="M16 13v3M15 21l1-5 1 5" />
  </Icon>
);

const LinearPark = () => (
  <Icon>
    <path d="M2 21h20" />
    <path d="M3 17c4-3 14-3 18 0" />
    <path d="M6 13a2.5 2.5 0 0 1 5 0 2.5 2.5 0 0 1-2.5 2A2.5 2.5 0 0 1 6 13Z" />
    <path d="M14 10a2.5 2.5 0 0 1 5 0 2.5 2.5 0 0 1-2.5 2 2.5 2.5 0 0 1-2.5-2Z" />
    <path d="M8.5 15v2M16.5 12v3" />
  </Icon>
);

export const TYPOLOGY_ICONS: Record<TypologyKey, () => React.ReactElement> = {
  neighborhood_commercial: NeighborhoodCommercial,
  main_commercial: MainCommercial,
  residential: Residential,
  boulevard: Boulevard,
  pedestrian_mall: PedestrianMall,
  linear_park: LinearPark,
};

/* ------------------------------------------------- ארבעת כרטיסי המדור */

const HubCriteria = () => (
  <Icon>
    <path d="M4 4h16v16H4z" />
    <path d="M4 9h16M4 14h16M9 4v16M14 4v16" />
  </Icon>
);

const HubTypes = () => (
  <Icon>
    <path d="M2 20h20" />
    <path d="M3 20V6h5v14M10 20v-9h4v9M16 20V9h5v11" />
  </Icon>
);

const HubExamples = () => (
  <Icon>
    <rect x="3" y="5" width="18" height="14" rx="1.5" />
    <path d="M3 15l5-4 4 3 3-2 6 4" />
    <circle cx="8.5" cy="9" r="1.3" />
  </Icon>
);

const HubHelp = () => (
  <Icon>
    <path d="M2 21h20" />
    <circle cx="8" cy="6" r="2" />
    <path d="M8 8v6M5.5 21L8 14l2.5 7" />
    <path d="M14 13h7M17.5 9.5v7" />
  </Icon>
);

export type HubKey = "criteria" | "types" | "examples" | "help";

export const HUB_ICONS: Record<HubKey, () => React.ReactElement> = {
  criteria: HubCriteria,
  types: HubTypes,
  examples: HubExamples,
  help: HubHelp,
};
