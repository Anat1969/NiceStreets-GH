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

/** רציפות הציר: קו שממשיך בלי קטיעה, ומתחבר הלאה. */
const AxisContinuity = () => (
  <Icon>
    <path d="M2 12h20" />
    <path d="M7 12V7M17 12v5" />
    <circle cx="7" cy="12" r="1.2" />
    <circle cx="17" cy="12" r="1.2" />
  </Icon>
);

/** מרחק בין צמתים: שני צמתים וקו מידה ביניהם. */
const IntersectionDistance = () => (
  <Icon>
    <path d="M6 3v18M18 3v18" />
    <path d="M3 8h18" />
    <path d="M6 16h12" />
    <path d="M8 14l-2 2 2 2M16 14l2 2-2 2" />
  </Icon>
);

/** חיבור לתחבורה ציבורית: תחנה ומרחק הליכה אליה. */
const TransitAccess = () => (
  <Icon>
    <rect x="4" y="4" width="11" height="10" rx="1.5" />
    <path d="M4 10h11M7 14v2M12 14v2" />
    <path d="M18 8v11M18 19h3" />
    <circle cx="18" cy="5.5" r="1.4" />
  </Icon>
);

/** רוחב מדרכה: חתך, ורוחב מסומן על המדרכה. */
const SidewalkWidth = () => (
  <Icon>
    <path d="M2 17h20" />
    <path d="M2 13h7M15 13h7" />
    <path d="M3 9h5M4 7l-1 2 1 2M7 7l1 2-1 2" />
    <path d="M12 17v-4" />
  </Icon>
);

/** יחס גובה לרוחב: שני בניינים וקו הרוחב ביניהם. */
const HeightToWidth = () => (
  <Icon>
    <path d="M3 21V6h5v15M16 21V9h5v12" />
    <path d="M2 21h20" />
    <path d="M8 14h8M10 12l-2 2 2 2M14 12l2 2-2 2" />
  </Icon>
);

/** חלוקת החתך: רצועות נפרדות לכל שימוש. */
const SectionSplit = () => (
  <Icon>
    <path d="M2 19h20" />
    <path d="M6 19v-4M12 19v-7M18 19v-4" />
    <path d="M2 15h4M6 15h6M12 15h6M18 15h4" />
    <path d="M9 12v3M15 12v3" />
  </Icon>
);

/** שקיפות החזית: חזית עם חלונות וכניסה, לא קיר אטום. */
const FrontageTransparency = () => (
  <Icon>
    <path d="M3 21V5h18v16" />
    <path d="M2 21h20" />
    <rect x="6" y="9" width="4" height="4" />
    <rect x="14" y="9" width="4" height="4" />
    <path d="M10 21v-5h4v5" />
  </Icon>
);

/** מקצב הכניסות: כניסות תכופות לאורך החזית. */
const EntranceRhythm = () => (
  <Icon>
    <path d="M2 21h20" />
    <path d="M3 21V7h18v14" />
    <path d="M6 21v-5h3v5M14 21v-5h3v5" />
    <path d="M11 21v-3h1.5v3" />
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

/** חופת עצים: צמרות רציפות מעל מסלול ההליכה. */
const TreeCanopy = () => (
  <Icon>
    <path d="M2 20h20" />
    <path d="M7 20v-5M17 20v-5" />
    <path d="M3 9a4 4 0 0 1 8 0 4 4 0 0 1-4 3 4 4 0 0 1-4-3Z" />
    <path d="M13 9a4 4 0 0 1 8 0 4 4 0 0 1-4 3 4 4 0 0 1-4-3Z" />
  </Icon>
);

/** מקום לשהייה: ספסל, ואדם שעוצר לידו. */
const StayingPlace = () => (
  <Icon>
    <path d="M2 20h20" />
    <path d="M3 14h10M4 14v4M12 14v4" />
    <path d="M3 11h10" />
    <circle cx="18" cy="8" r="1.6" />
    <path d="M18 10v5M16 20l2-5 2 5" />
  </Icon>
);

/** ריהוט רחוב ותאורה: עמוד תאורה בגובה הולך רגל. */
const FurnitureLighting = () => (
  <Icon>
    <path d="M2 20h20" />
    <path d="M8 20V7M8 7h6a2 2 0 0 1 2 2v1" />
    <path d="M14 10h4l-2 3-2-3Z" />
    <path d="M6 20h4" />
  </Icon>
);

export const CRITERION_ICONS: Record<CriterionKey, () => React.ReactElement> = {
  axis_continuity: AxisContinuity,
  intersection_distance: IntersectionDistance,
  transit_access: TransitAccess,
  sidewalk_width: SidewalkWidth,
  height_to_width: HeightToWidth,
  section_split: SectionSplit,
  frontage_transparency: FrontageTransparency,
  entrance_rhythm: EntranceRhythm,
  mixed_use: MixedUse,
  tree_canopy: TreeCanopy,
  staying_place: StayingPlace,
  furniture_lighting: FurnitureLighting,
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
