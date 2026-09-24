import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import { QUARTERS, SEED_STREETS } from "../city";
import type { StatusKey, TypologyKey } from "../city";
import type {
  Photo,
  PhotoStatus,
  Quarter,
  Scores,
  Street,
  StreetStatus,
  Vote,
  VoteInput,
} from "../types";
import type { DataStore } from "./types";
import { buildDemoVotes } from "./demo";

interface Snapshot {
  version: 1;
  streets: Street[];
  votes: Vote[];
  photos: Photo[];
  statuses: StreetStatus[];
}

/**
 * Where the JSON store lives. On a serverless host the project directory is
 * read-only, so fall back to the writable temp directory there. That storage
 * is ephemeral — connect Supabase before opening the app to the public.
 */
const DATA_DIR = process.env.LOCAL_DATA_DIR
  ? path.resolve(process.env.LOCAL_DATA_DIR)
  : process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
    ? path.join(os.tmpdir(), "good-streets")
    : path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "store.json");
const PHOTO_DIR = path.join(DATA_DIR, "photos");

function emptySnapshot(): Snapshot {
  return {
    version: 1,
    streets: SEED_STREETS.map((s) => ({
      id: s.id,
      name: s.name,
      quarterId: s.quarterId,
      typology: s.typology,
      line: s.line,
      gis: s.gis ?? null,
      verified: s.verified,
      createdAt: new Date(0).toISOString(),
    })),
    votes: [],
    photos: [],
    statuses: [],
  };
}

let cache: Snapshot | null = null;
let queue: Promise<unknown> = Promise.resolve();

/** Serialise all reads/writes so concurrent requests cannot interleave. */
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function load(): Promise<Snapshot> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(FILE, "utf8");
    cache = JSON.parse(raw) as Snapshot;
  } catch {
    cache = emptySnapshot();
    await persist(cache);
  }
  return cache;
}

async function persist(snapshot: Snapshot): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(snapshot, null, 2), "utf8");
  await fs.rename(tmp, FILE);
  cache = snapshot;
}

function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function decodeDataUrl(dataUrl: string): { body: Buffer; ext: string } | null {
  const match = /^data:(image\/(png|jpe?g|webp));base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  const ext = match[2].toLowerCase().startsWith("jp") ? "jpg" : match[2].toLowerCase();
  return { body: Buffer.from(match[3], "base64"), ext };
}

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

export class LocalStore implements DataStore {
  readonly kind = "local" as const;

  async listQuarters(): Promise<Quarter[]> {
    return QUARTERS.map((q) => ({ ...q }));
  }

  async listStreets(): Promise<Street[]> {
    const snapshot = await withLock(load);
    return snapshot.streets.map((s) => ({ ...s }));
  }

  async getStreet(streetId: string): Promise<Street | null> {
    const snapshot = await withLock(load);
    return snapshot.streets.find((s) => s.id === streetId) ?? null;
  }

  async createStreet(input: {
    name: string;
    quarterId: string;
    typology: TypologyKey;
  }): Promise<Street> {
    return withLock(async () => {
      const snapshot = await load();
      const name = input.name.trim();
      const existing = snapshot.streets.find(
        (s) => s.name === name && s.quarterId === input.quarterId,
      );
      if (existing) return { ...existing };
      const street: Street = {
        id: id("s"),
        name,
        quarterId: input.quarterId,
        typology: input.typology,
        line: null,
        gis: null,
        verified: false,
        createdAt: new Date().toISOString(),
      };
      snapshot.streets.push(street);
      await persist(snapshot);
      return { ...street };
    });
  }

  async upsertVote(input: VoteInput): Promise<Vote> {
    return withLock(async () => {
      const snapshot = await load();
      const street = snapshot.streets.find((s) => s.id === input.streetId);
      if (!street) throw new Error("STREET_NOT_FOUND");

      const now = new Date().toISOString();
      const existing = snapshot.votes.find(
        (v) => v.userId === input.userId && v.streetId === input.streetId,
      );

      let photoId: string | null = existing?.photoId ?? null;
      if (input.photo?.dataUrl) {
        const decoded = decodeDataUrl(input.photo.dataUrl);
        if (!decoded) throw new Error("PHOTO_FORMAT");
        if (decoded.body.byteLength > MAX_PHOTO_BYTES) throw new Error("PHOTO_TOO_LARGE");
        await fs.mkdir(PHOTO_DIR, { recursive: true });
        const newPhotoId = id("p");
        const storagePath = `${newPhotoId}.${decoded.ext}`;
        await fs.writeFile(path.join(PHOTO_DIR, storagePath), decoded.body);
        snapshot.photos.push({
          id: newPhotoId,
          voteId: existing?.id ?? "",
          streetId: input.streetId,
          storagePath,
          status: "pending",
          createdAt: now,
          isDemo: false,
        });
        photoId = newPhotoId;
      }

      const vote: Vote = existing
        ? { ...existing, scores: input.scores, reason: input.reason, photoId, updatedAt: now }
        : {
            id: id("v"),
            streetId: input.streetId,
            quarterId: street.quarterId,
            typology: street.typology,
            scores: input.scores,
            reason: input.reason,
            photoId,
            userId: input.userId,
            createdAt: now,
            updatedAt: now,
            isDemo: false,
          };

      if (existing) {
        snapshot.votes = snapshot.votes.map((v) => (v.id === vote.id ? vote : v));
      } else {
        snapshot.votes.push(vote);
      }
      if (photoId) {
        snapshot.photos = snapshot.photos.map((p) =>
          p.id === photoId ? { ...p, voteId: vote.id } : p,
        );
      }
      await persist(snapshot);
      return { ...vote };
    });
  }

  async getUserVote(userId: string, streetId: string): Promise<Vote | null> {
    const snapshot = await withLock(load);
    return snapshot.votes.find((v) => v.userId === userId && v.streetId === streetId) ?? null;
  }

  async listVotes(filter?: { streetId?: string }): Promise<Vote[]> {
    const snapshot = await withLock(load);
    return snapshot.votes
      .filter((v) => !filter?.streetId || v.streetId === filter.streetId)
      .map((v) => ({ ...v }));
  }

  async listPhotos(filter?: { streetId?: string; status?: PhotoStatus }): Promise<Photo[]> {
    const snapshot = await withLock(load);
    return snapshot.photos
      .filter((p) => !filter?.streetId || p.streetId === filter.streetId)
      .filter((p) => !filter?.status || p.status === filter.status)
      .map((p) => ({ ...p }));
  }

  async readPhoto(photoId: string): Promise<{ body: Buffer; contentType: string } | null> {
    const snapshot = await withLock(load);
    const photo = snapshot.photos.find((p) => p.id === photoId);
    if (!photo) return null;
    try {
      const body = await fs.readFile(path.join(PHOTO_DIR, photo.storagePath));
      const ext = photo.storagePath.split(".").pop();
      return { body, contentType: ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg" };
    } catch {
      return null;
    }
  }

  async setPhotoStatus(photoId: string, status: PhotoStatus): Promise<void> {
    await withLock(async () => {
      const snapshot = await load();
      snapshot.photos = snapshot.photos.map((p) => (p.id === photoId ? { ...p, status } : p));
      await persist(snapshot);
    });
  }

  async listStreetStatuses(): Promise<StreetStatus[]> {
    const snapshot = await withLock(load);
    return snapshot.statuses.map((s) => ({ ...s }));
  }

  async setStreetStatus(input: {
    streetId: string;
    status: StatusKey;
    publicNote: string;
    updatedBy: string;
  }): Promise<StreetStatus> {
    return withLock(async () => {
      const snapshot = await load();
      const record: StreetStatus = {
        streetId: input.streetId,
        status: input.status,
        publicNote: input.publicNote,
        updatedBy: input.updatedBy,
        updatedAt: new Date().toISOString(),
      };
      const index = snapshot.statuses.findIndex((s) => s.streetId === input.streetId);
      if (index >= 0) snapshot.statuses[index] = record;
      else snapshot.statuses.push(record);
      await persist(snapshot);
      return record;
    });
  }

  async seedDemo(): Promise<number> {
    return withLock(async () => {
      const snapshot = await load();
      if (snapshot.votes.some((v) => v.isDemo)) return 0;
      const votes = buildDemoVotes(snapshot.streets);
      snapshot.votes.push(...votes);
      const statusKeys: StatusKey[] = ["received", "under_review", "planned", "in_progress", "done"];
      snapshot.streets.slice(0, 8).forEach((street, index) => {
        if (snapshot.statuses.some((s) => s.streetId === street.id)) return;
        snapshot.statuses.push({
          streetId: street.id,
          status: statusKeys[index % statusKeys.length],
          publicNote: "נתוני הדגמה — לא עדכון עירוני אמיתי.",
          updatedBy: "demo",
          updatedAt: new Date().toISOString(),
        });
      });
      await persist(snapshot);
      return votes.length;
    });
  }

  async clearDemo(): Promise<number> {
    return withLock(async () => {
      const snapshot = await load();
      const before = snapshot.votes.length;
      snapshot.votes = snapshot.votes.filter((v) => !v.isDemo);
      snapshot.photos = snapshot.photos.filter((p) => !p.isDemo);
      snapshot.statuses = snapshot.statuses.filter((s) => s.updatedBy !== "demo");
      await persist(snapshot);
      return before - snapshot.votes.length;
    });
  }
}
