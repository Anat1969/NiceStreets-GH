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
  listStreets(): Promise<Street[]>;
  getStreet(id: string): Promise<Street | null>;
  createStreet(input: {
    name: string;
    quarterId: string;
    typology: TypologyKey;
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
