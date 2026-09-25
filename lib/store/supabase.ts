import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { STREET_ASSIGNMENTS } from "../city";
import type { StatusKey, TypologyKey } from "../city";
import type {
  Photo,
  PhotoStatus,
  Quarter,
  Street,
  StreetStatus,
  Vote,
  VoteInput,
} from "../types";
import type { DataStore } from "./types";
import { buildDemoVotes } from "./demo";

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

function toStreet(row: Row): Street {
  return {
    id: row.id,
    name: row.name,
    code: row.code ?? null,
    quarterId: row.quarter_id ?? null,
    typology: row.typology ?? null,
    line: row.line ?? null,
    gis: row.gis ?? null,
    verified: Boolean(row.verified),
    createdAt: row.created_at,
  };
}

function toVote(row: Row): Vote {
  return {
    id: row.id,
    streetId: row.street_id,
    quarterId: row.quarter_id ?? null,
    typology: row.typology ?? null,
    typologySuggestion: row.typology_suggestion ?? null,
    scores: row.scores,
    reason: row.reason ?? "",
    photoId: row.photo_id ?? null,
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isDemo: Boolean(row.is_demo),
  };
}

function toPhoto(row: Row): Photo {
  return {
    id: row.id,
    voteId: row.vote_id ?? "",
    streetId: row.street_id,
    storagePath: row.storage_path,
    status: row.status,
    createdAt: row.created_at,
    isDemo: Boolean(row.is_demo),
  };
}

function toStatus(row: Row): StreetStatus {
  return {
    streetId: row.street_id,
    status: row.status,
    publicNote: row.public_note ?? "",
    updatedBy: row.updated_by ?? "",
    updatedAt: row.updated_at,
  };
}

function decodeDataUrl(dataUrl: string): { body: Buffer; ext: string; mime: string } | null {
  const match = /^data:(image\/(png|jpe?g|webp));base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  const sub = match[2].toLowerCase();
  return {
    body: Buffer.from(match[3], "base64"),
    ext: sub.startsWith("jp") ? "jpg" : sub,
    mime: match[1].toLowerCase(),
  };
}

/**
 * Server-side Supabase adapter. Uses the service-role key, so every call in
 * this class must already have been authorised by the route handler.
 * Browser clients never talk to Supabase directly; RLS in supabase/schema.sql
 * is the second line of defence.
 */
export class SupabaseStore implements DataStore {
  readonly kind = "supabase" as const;
  private db: SupabaseClient;

  constructor(url: string, serviceKey: string) {
    this.db = createClient(url, serviceKey, { auth: { persistSession: false } });
  }

  private async rows(table: string, build: (q: any) => any = (q) => q): Promise<Row[]> {
    const { data, error } = await build(this.db.from(table).select("*"));
    if (error) throw new Error(`${table}: ${error.message}`);
    return data ?? [];
  }

  async listQuarters(): Promise<Quarter[]> {
    const rows = await this.rows("quarters");
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      polygon: row.polygon ?? [],
      center: row.center ?? [0, 0],
      schematic: Boolean(row.schematic),
    }));
  }

  async listStreets(): Promise<Street[]> {
    return (await this.rows("streets")).map(toStreet);
  }

  async getStreet(streetId: string): Promise<Street | null> {
    const rows = await this.rows("streets", (q) => q.eq("id", streetId).limit(1));
    return rows[0] ? toStreet(rows[0]) : null;
  }

  async createStreet(input: { code: string; name: string }): Promise<Street> {
    const existing = await this.rows("streets", (q) => q.eq("code", input.code).limit(1));
    if (existing[0]) return toStreet(existing[0]);

    const assignment = STREET_ASSIGNMENTS[input.code] ?? {};
    const { data, error } = await this.db
      .from("streets")
      .insert({
        code: input.code,
        name: input.name,
        quarter_id: assignment.quarterId ?? null,
        typology: assignment.typology ?? null,
        line: assignment.line ?? null,
        gis: assignment.gis ?? null,
        verified: true,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return toStreet(data);
  }

  async setStreetAssignment(input: {
    streetId: string;
    quarterId?: string | null;
    typology?: TypologyKey | null;
  }): Promise<Street> {
    const patch: Row = {};
    if (input.quarterId !== undefined) patch.quarter_id = input.quarterId;
    if (input.typology !== undefined) patch.typology = input.typology;
    const { data, error } = await this.db
      .from("streets")
      .update(patch)
      .eq("id", input.streetId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return toStreet(data);
  }

  async upsertVote(input: VoteInput): Promise<Vote> {
    const street = await this.getStreet(input.streetId);
    if (!street) throw new Error("STREET_NOT_FOUND");

    const existingRows = await this.rows("votes", (q) =>
      q.eq("user_id", input.userId).eq("street_id", input.streetId).limit(1),
    );
    const existing = existingRows[0] ? toVote(existingRows[0]) : null;

    let photoId = existing?.photoId ?? null;
    if (input.photo?.dataUrl) {
      const decoded = decodeDataUrl(input.photo.dataUrl);
      if (!decoded) throw new Error("PHOTO_FORMAT");
      if (decoded.body.byteLength > MAX_PHOTO_BYTES) throw new Error("PHOTO_TOO_LARGE");
      const storagePath = `${input.streetId}/${crypto.randomUUID()}.${decoded.ext}`;
      const { data, error } = await this.db
        .from("photos")
        .insert({
          street_id: input.streetId,
          vote_id: existing?.id ?? null,
          storage_path: storagePath,
          status: "pending",
          is_demo: false,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      // The image lives in photo_blobs as base64 text, so the whole dataset is
      // one database to back up, restore and move between projects.
      const blob = await this.db.from("photo_blobs").insert({
        photo_id: data.id,
        content_type: decoded.mime,
        data_base64: decoded.body.toString("base64"),
      });
      if (blob.error) {
        await this.db.from("photos").delete().eq("id", data.id);
        throw new Error(blob.error.message);
      }
      photoId = data.id;
    }

    const payload = {
      street_id: input.streetId,
      quarter_id: street.quarterId,
      typology: street.typology,
      typology_suggestion: input.typologySuggestion ?? existing?.typologySuggestion ?? null,
      scores: input.scores,
      reason: input.reason,
      photo_id: photoId,
      user_id: input.userId,
      updated_at: new Date().toISOString(),
      is_demo: false,
    };

    const { data, error } = await this.db
      .from("votes")
      .upsert(payload, { onConflict: "user_id,street_id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    if (photoId) {
      await this.db.from("photos").update({ vote_id: data.id }).eq("id", photoId);
    }
    return toVote(data);
  }

  async getUserVote(userId: string, streetId: string): Promise<Vote | null> {
    const rows = await this.rows("votes", (q) =>
      q.eq("user_id", userId).eq("street_id", streetId).limit(1),
    );
    return rows[0] ? toVote(rows[0]) : null;
  }

  async listVotes(filter?: { streetId?: string }): Promise<Vote[]> {
    const rows = await this.rows("votes", (q) =>
      filter?.streetId ? q.eq("street_id", filter.streetId) : q,
    );
    return rows.map(toVote);
  }

  async listPhotos(filter?: { streetId?: string; status?: PhotoStatus }): Promise<Photo[]> {
    const rows = await this.rows("photos", (q) => {
      let query = q;
      if (filter?.streetId) query = query.eq("street_id", filter.streetId);
      if (filter?.status) query = query.eq("status", filter.status);
      return query;
    });
    return rows.map(toPhoto);
  }

  async readPhoto(photoId: string): Promise<{ body: Buffer; contentType: string } | null> {
    const { data, error } = await this.db
      .from("photo_blobs")
      .select("content_type, data_base64")
      .eq("photo_id", photoId)
      .maybeSingle();
    if (error || !data?.data_base64) return null;
    return {
      body: Buffer.from(data.data_base64, "base64"),
      contentType: data.content_type ?? "image/jpeg",
    };
  }

  async setPhotoStatus(photoId: string, status: PhotoStatus): Promise<void> {
    const { error } = await this.db.from("photos").update({ status }).eq("id", photoId);
    if (error) throw new Error(error.message);
  }

  async listStreetStatuses(): Promise<StreetStatus[]> {
    return (await this.rows("street_status")).map(toStatus);
  }

  async setStreetStatus(input: {
    streetId: string;
    status: StatusKey;
    publicNote: string;
    updatedBy: string;
  }): Promise<StreetStatus> {
    const { data, error } = await this.db
      .from("street_status")
      .upsert(
        {
          street_id: input.streetId,
          status: input.status,
          public_note: input.publicNote,
          updated_by: input.updatedBy,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "street_id" },
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return toStatus(data);
  }

  async seedDemo(): Promise<number> {
    const existing = await this.rows("votes", (q) => q.eq("is_demo", true).limit(1));
    if (existing.length > 0) return 0;

    const streets = await this.listStreets();
    if (streets.length === 0) throw new Error("NO_STREETS_TO_SEED");

    const votes = buildDemoVotes(streets).map((vote) => ({
      street_id: vote.streetId,
      quarter_id: vote.quarterId,
      typology: vote.typology,
      typology_suggestion: null,
      scores: vote.scores,
      reason: vote.reason,
      user_id: vote.userId,
      created_at: vote.createdAt,
      updated_at: vote.updatedAt,
      is_demo: true,
    }));

    const { data, error } = await this.db.from("votes").insert(votes).select("id");
    if (error) throw new Error(error.message);

    const statusKeys: StatusKey[] = [
      "received",
      "under_review",
      "planned",
      "in_progress",
      "done",
    ];
    await this.db.from("street_status").upsert(
      streets.slice(0, 8).map((street, index) => ({
        street_id: street.id,
        status: statusKeys[index % statusKeys.length],
        public_note: "נתוני הדגמה — לא עדכון עירוני אמיתי.",
        updated_by: "demo",
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "street_id" },
    );

    return data?.length ?? 0;
  }

  async clearDemo(): Promise<number> {
    const { data: votes, error } = await this.db
      .from("votes")
      .delete()
      .eq("is_demo", true)
      .select("id");
    if (error) throw new Error(error.message);
    await this.db.from("photos").delete().eq("is_demo", true);
    await this.db.from("street_status").delete().eq("updated_by", "demo");
    return votes?.length ?? 0;
  }
}
