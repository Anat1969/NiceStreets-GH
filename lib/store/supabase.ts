import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseServer } from "../supabase/server";
import { STREET_ASSIGNMENTS } from "../city";
import type { StatusKey, TypologyKey } from "../city";
import type {
  Photo,
  PhotoSource,
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
    center: row.center ?? null,
    centerSource: row.center_source ?? null,
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
    source: (row.source ?? "resident") as PhotoSource,
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
 * Server-side Supabase adapter.
 *
 * Every call runs as the person behind the current request: the client is
 * built from their session cookies, with the publishable key. RLS in the
 * database is the authority on who may read and write what; the route
 * handlers' checks only decide what to show and which error to give.
 */
export class SupabaseStore implements DataStore {
  readonly kind = "supabase" as const;

  private async db(): Promise<SupabaseClient> {
    return supabaseServer();
  }

  private async rows(table: string, build: (q: any) => any = (q) => q): Promise<Row[]> {
    const { data, error } = await build((await this.db()).from(table).select("*"));
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
      centerSource: row.center_source ?? null,
    }));
  }

  async setQuarterGeometry(input: {
    quarterId: string;
    center: [number, number];
    polygon: [number, number][];
  }): Promise<Quarter> {
    const { data, error } = await (await this.db())
      .from("quarters")
      .update({
        center: input.center,
        polygon: input.polygon,
        schematic: false,
        center_source: "staff",
      })
      .eq("id", input.quarterId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return {
      id: data.id,
      name: data.name,
      polygon: data.polygon ?? [],
      center: data.center ?? [0, 0],
      schematic: Boolean(data.schematic),
      centerSource: data.center_source ?? null,
    };
  }

  async listStreets(): Promise<Street[]> {
    return (await this.rows("streets")).map(toStreet);
  }

  async getStreet(streetId: string): Promise<Street | null> {
    const rows = await this.rows("streets", (q) => q.eq("id", streetId).limit(1));
    return rows[0] ? toStreet(rows[0]) : null;
  }

  async createStreet(input: {
    code: string;
    name: string;
    quarterId?: string;
  }): Promise<Street> {
    // Through ensure_street(): a resident may create the row for a street the
    // first time it is rated, and nothing else about streets.
    const assignment = STREET_ASSIGNMENTS[input.code] ?? {};
    const { data, error } = await (await this.db()).rpc("ensure_street", {
      p_code: input.code,
      p_name: input.name,
      p_quarter_id: input.quarterId ?? assignment.quarterId ?? null,
      p_typology: assignment.typology ?? null,
      p_line: assignment.line ?? null,
      p_gis: assignment.gis ?? null,
    });
    if (error) throw new Error(error.message);
    return toStreet(Array.isArray(data) ? data[0] : data);
  }

  async setStreetCenter(
    streetId: string,
    center: [number, number],
    source: "osm" | "municipal" | "staff",
  ): Promise<void> {
    const { error } = await (await this.db())
      .from("streets")
      .update({ center, center_source: source })
      .eq("id", streetId);
    if (error) throw new Error(error.message);
  }

  async setStreetAssignment(input: {
    streetId: string;
    quarterId?: string | null;
    typology?: TypologyKey | null;
  }): Promise<Street> {
    const patch: Row = {};
    if (input.quarterId !== undefined) patch.quarter_id = input.quarterId;
    if (input.typology !== undefined) patch.typology = input.typology;
    const { data, error } = await (await this.db())
      .from("streets")
      .update(patch)
      .eq("id", input.streetId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return toStreet(data);
  }

  async listContentImageSlots(): Promise<string[]> {
    const { data, error } = await (await this.db()).from("content_images").select("slot");
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => row.slot as string);
  }

  async readContentImage(
    slot: string,
  ): Promise<{ body: Buffer; contentType: string } | null> {
    const { data, error } = await (await this.db())
      .from("content_images")
      .select("content_type, data_base64")
      .eq("slot", slot)
      .limit(1);
    if (error) throw new Error(error.message);
    const row = data?.[0];
    if (!row) return null;
    return {
      body: Buffer.from(row.data_base64, "base64"),
      contentType: row.content_type,
    };
  }

  async setContentImage(input: {
    slot: string;
    dataUrl: string;
    alt?: string;
  }): Promise<void> {
    const decoded = decodeDataUrl(input.dataUrl);
    if (!decoded) throw new Error("PHOTO_FORMAT");
    if (decoded.body.byteLength > MAX_PHOTO_BYTES) throw new Error("PHOTO_TOO_LARGE");
    const { error } = await (await this.db()).from("content_images").upsert({
      slot: input.slot,
      content_type: decoded.mime,
      data_base64: decoded.body.toString("base64"),
      alt: input.alt ?? "",
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  }

  async deleteContentImage(slot: string): Promise<void> {
    const { error } = await (await this.db()).from("content_images").delete().eq("slot", slot);
    if (error) throw new Error(error.message);
  }

  async upsertVote(input: VoteInput): Promise<Vote> {
    const db = await this.db();
    const street = await this.getStreet(input.streetId);
    if (!street) throw new Error("STREET_NOT_FOUND");

    const decoded = input.photo?.dataUrl ? decodeDataUrl(input.photo.dataUrl) : null;
    if (input.photo?.dataUrl && !decoded) throw new Error("PHOTO_FORMAT");
    if (decoded && decoded.body.byteLength > MAX_PHOTO_BYTES) throw new Error("PHOTO_TOO_LARGE");

    const existing = await this.getUserVote(input.userId, input.streetId);

    // The vote is saved first and the photo attached to it after, so every
    // write is one the resident is allowed to make on their own rows.
    const { data, error } = await db
      .from("votes")
      .upsert(
        {
          street_id: input.streetId,
          quarter_id: street.quarterId,
          typology: street.typology,
          typology_suggestion: input.typologySuggestion ?? existing?.typologySuggestion ?? null,
          scores: input.scores,
          reason: input.reason,
          photo_id: existing?.photoId ?? null,
          user_id: input.userId,
          updated_at: new Date().toISOString(),
          is_demo: false,
        },
        { onConflict: "user_id,street_id" },
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    const vote = toVote(data);

    if (!decoded) return vote;

    const storagePath = `${input.streetId}/${crypto.randomUUID()}.${decoded.ext}`;
    const photo = await db
      .from("photos")
      .insert({
        street_id: input.streetId,
        vote_id: vote.id,
        storage_path: storagePath,
        status: "pending",
        source: "resident",
        is_demo: false,
      })
      .select("*")
      .single();
    if (photo.error) throw new Error(photo.error.message);
    // The image lives in photo_blobs as base64 text, so the whole dataset is
    // one database to back up, restore and move between projects.
    const blob = await db.from("photo_blobs").insert({
      photo_id: photo.data.id,
      content_type: decoded.mime,
      data_base64: decoded.body.toString("base64"),
    });
    if (blob.error) {
      await db.from("photos").delete().eq("id", photo.data.id);
      throw new Error(blob.error.message);
    }
    const linked = await db
      .from("votes")
      .update({ photo_id: photo.data.id })
      .eq("id", vote.id)
      .select("*")
      .single();
    if (linked.error) throw new Error(linked.error.message);
    return toVote(linked.data);
  }

  async getUserVote(userId: string, streetId: string): Promise<Vote | null> {
    const rows = await this.rows("votes", (q) =>
      q.eq("user_id", userId).eq("street_id", streetId).limit(1),
    );
    return rows[0] ? toVote(rows[0]) : null;
  }

  async listVotes(filter?: { streetId?: string }): Promise<Vote[]> {
    // votes_public: every vote, without who wrote it. Screens never need that.
    const rows = await this.rows("votes_public", (q) =>
      filter?.streetId ? q.eq("street_id", filter.streetId) : q,
    );
    return rows.map((row) => toVote({ ...row, user_id: "" }));
  }

  /**
   * Admin upload. The photo is stored already published, because the admin is
   * the person the moderation queue exists for — sending her own photo to her
   * own queue would be theatre. A "test" photo is the exception: it is never
   * public, whatever its status says.
   */
  async createPhoto(input: {
    streetId: string;
    dataUrl: string;
    source: PhotoSource;
    status?: PhotoStatus;
  }): Promise<Photo> {
    const decoded = decodeDataUrl(input.dataUrl);
    if (!decoded) throw new Error("PHOTO_FORMAT");
    if (decoded.body.byteLength > MAX_PHOTO_BYTES) throw new Error("PHOTO_TOO_LARGE");

    const storagePath = `${input.streetId}/${crypto.randomUUID()}.${decoded.ext}`;
    const { data, error } = await (await this.db())
      .from("photos")
      .insert({
        street_id: input.streetId,
        vote_id: null,
        storage_path: storagePath,
        status: input.status ?? "approved",
        source: input.source,
        is_demo: input.source === "test",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    const blob = await (await this.db()).from("photo_blobs").insert({
      photo_id: data.id,
      content_type: decoded.mime,
      data_base64: decoded.body.toString("base64"),
    });
    if (blob.error) {
      await (await this.db()).from("photos").delete().eq("id", data.id);
      throw new Error(blob.error.message);
    }
    return toPhoto(data);
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
    const db = await this.db();
    // A public photo comes through public_photo_blob(); anything else only
    // staff can read, and RLS returns nothing to anyone else.
    const open = await db.rpc("public_photo_blob", { p_photo_id: photoId });
    let row: Row | null = open.error ? null : (open.data?.[0] ?? null);
    if (!row) {
      const { data } = await db
        .from("photo_blobs")
        .select("content_type, data_base64")
        .eq("photo_id", photoId)
        .maybeSingle();
      row = data;
    }
    if (!row?.data_base64) return null;
    return {
      body: Buffer.from(row.data_base64, "base64"),
      contentType: row.content_type ?? "image/jpeg",
    };
  }

  async setPhotoStatus(photoId: string, status: PhotoStatus): Promise<void> {
    const { error } = await (await this.db()).from("photos").update({ status }).eq("id", photoId);
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
    const { data, error } = await (await this.db())
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

    const { data, error } = await (await this.db()).from("votes").insert(votes).select("id");
    if (error) throw new Error(error.message);

    const statusKeys: StatusKey[] = ["under_review", "done"];
    await (await this.db()).from("street_status").upsert(
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
    const { data: votes, error } = await (await this.db())
      .from("votes")
      .delete()
      .eq("is_demo", true)
      .select("id");
    if (error) throw new Error(error.message);
    await (await this.db()).from("photos").delete().eq("is_demo", true);
    // Test uploads are demo data by another name, and go with it.
    await (await this.db()).from("photos").delete().eq("source", "test");
    await (await this.db()).from("street_status").delete().eq("updated_by", "demo");
    return votes?.length ?? 0;
  }
}
