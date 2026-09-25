import type {
  Photo,
  PhotoStatus,
  Quarter,
  Street,
  StreetStatus,
  Vote,
  VoteInput,
} from "../types";
import type { StatusKey, TypologyKey } from "../city";

export interface DataStore {
  readonly kind: "local" | "supabase";

  listQuarters(): Promise<Quarter[]>;
  /** Staff calibration: place a quarter's box on the real map. */
  setQuarterGeometry(input: {
    quarterId: string;
    center: [number, number];
    polygon: [number, number][];
  }): Promise<Quarter>;
  listStreets(): Promise<Street[]>;
  getStreet(id: string): Promise<Street | null>;
  /**
   * Creates the row for a canonical street the first time it is voted on.
   * `quarterId` is passed only for a street that crosses quarters, where the
   * resident says which stretch they mean and the row is that stretch.
   */
  createStreet(input: {
    code: string;
    name: string;
    quarterId?: string;
  }): Promise<Street>;
  /** Staff assignment of quarter and street type. */
  setStreetAssignment(input: {
    streetId: string;
    quarterId?: string | null;
    typology?: TypologyKey | null;
  }): Promise<Street>;

  upsertVote(input: VoteInput): Promise<Vote>;
  getUserVote(userId: string, streetId: string): Promise<Vote | null>;
  listVotes(filter?: { streetId?: string }): Promise<Vote[]>;

  listPhotos(filter?: {
    streetId?: string;
    status?: PhotoStatus;
  }): Promise<Photo[]>;
  readPhoto(id: string): Promise<{ body: Buffer; contentType: string } | null>;
  setPhotoStatus(id: string, status: PhotoStatus): Promise<void>;

  listStreetStatuses(): Promise<StreetStatus[]>;
  setStreetStatus(input: {
    streetId: string;
    status: StatusKey;
    publicNote: string;
    updatedBy: string;
  }): Promise<StreetStatus>;

  seedDemo(): Promise<number>;
  clearDemo(): Promise<number>;
}
