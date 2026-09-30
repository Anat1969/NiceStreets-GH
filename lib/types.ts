import type { QuestionKey, StatusKey, TypologyKey } from "./city";

export interface Quarter {
  id: string;
  name: string;
  polygon: [number, number][];
  center: [number, number];
  schematic: boolean;
}

export interface Street {
  id: string;
  name: string;
  /** Registry code from the national street list; the street's real identity. */
  code: string | null;
  /**
   * Assigned by staff. The national registry carries no quarter, so this is
   * null until someone who knows the city sets it — never guessed.
   */
  quarterId: string | null;
  /** Set by staff, not by residents. Null means not classified yet. */
  typology: TypologyKey | null;
  line: [number, number][] | null;
  /**
   * מרכז הרחוב על המפה, [lon, lat]. מגיע מ-OpenStreetMap לפי שם הרחוב
   * והעיר, ולכן `centerSource` שומר מאיפה — כדי שלא ייראה כמו שכבת GIS
   * עירונית כשאינו כזה.
   */
  center: [number, number] | null;
  centerSource: "osm" | "municipal" | "staff" | null;
  gis: {
    rowWidthM?: number;
    heightToWidth?: number;
    canopyPct?: number;
    intersectionDistanceM?: number;
  } | null;
  verified: boolean;
  createdAt: string;
}

export type Scores = Record<QuestionKey, number>;

export interface Vote {
  id: string;
  streetId: string;
  quarterId: string | null;
  typology: TypologyKey | null;
  /** A resident's opinion that the street is of a different kind. */
  typologySuggestion: TypologyKey | null;
  scores: Scores;
  reason: string;
  photoId: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
  isDemo: boolean;
}

export type PhotoStatus = "pending" | "approved" | "rejected";

/**
 * Where a photo came from, which decides who may see it.
 * resident — uploaded with a vote, public only once approved.
 * example  — uploaded by the admin, public at once, and part of the example
 *            library on the Examples screen.
 * test     — staff-only at all times, and removed with the demo data.
 */
export type PhotoSource = "resident" | "example" | "test";

export interface Photo {
  id: string;
  voteId: string;
  streetId: string;
  storagePath: string;
  status: PhotoStatus;
  source: PhotoSource;
  createdAt: string;
  isDemo: boolean;
}

/**
 * The single rule for whether the public may see a photo. A "test" upload is
 * stored as approved so it behaves normally for staff, so status alone is not
 * enough — every public surface has to ask this, not the status field.
 */
export function isPublicPhoto(photo: Pick<Photo, "status" | "source">): boolean {
  return photo.status === "approved" && photo.source !== "test";
}

export interface StreetStatus {
  streetId: string;
  status: StatusKey;
  publicNote: string;
  updatedBy: string;
  updatedAt: string;
}

export interface StreetStats {
  street: Street;
  quarterName: string;
  votes: number;
  /**
   * כמה מתוך `votes` הם נתוני הדגמה.
   *
   * קודם לכן הדגל `isDemo` היה קיים על הקול ולא נספר בשום מקום, וכך
   * 115 קולות הדגמה הוצגו במסכים הציבוריים כדעת תושבים. מספר שמוצג
   * לציבור חייב לדעת לומר כמה ממנו אמיתי.
   */
  demoVotes: number;
  avgScore: number | null;
  perQuestion: Record<QuestionKey, number | null>;
  /** Approved photos, the ones the public sees. */
  photos: number;
  /** Uploaded but not yet moderated. */
  photosPending: number;
  /** Newest approved photo, for the cards that show one. */
  latestPhotoId: string | null;
  status: StreetStatus | null;
}

export interface QuarterStats {
  quarter: Quarter;
  votes: number;
  avgScore: number | null;
  streets: number;
}

export interface Totals {
  votes: number;
  /** כמה מתוך `votes` הם נתוני הדגמה. ראו StreetStats.demoVotes. */
  demoVotes: number;
  streets: number;
  photos: number;
  photosPending: number;
  /** Votes whose street is missing from the street list; should always be 0. */
  orphanVotes: number;
  byStatus: Record<StatusKey, number>;
}

export interface VoteInput {
  streetId: string;
  scores: Scores;
  reason: string;
  userId: string;
  typologySuggestion?: TypologyKey | null;
  photo?: { dataUrl: string } | null;
}
