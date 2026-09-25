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
  quarterId: string;
  typology: TypologyKey;
  line: [number, number][] | null;
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
  quarterId: string;
  typology: TypologyKey;
  scores: Scores;
  reason: string;
  photoId: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
  isDemo: boolean;
}

export type PhotoStatus = "pending" | "approved" | "rejected";

export interface Photo {
  id: string;
  voteId: string;
  streetId: string;
  storagePath: string;
  status: PhotoStatus;
  createdAt: string;
  isDemo: boolean;
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
  avgScore: number | null;
  perQuestion: Record<QuestionKey, number | null>;
  /** Approved photos, the ones the public sees. */
  photos: number;
  /** Uploaded but not yet moderated. */
  photosPending: number;
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
  photo?: { dataUrl: string } | null;
}
