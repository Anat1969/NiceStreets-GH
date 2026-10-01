import type {
  Photo,
  PhotoSource,
  PhotoStatus,
  Quarter,
  Report,
  ReportKind,
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
  /** ממקם רחוב על המפה. המקור נשמר לצד הנקודה. */
  setStreetCenter(
    streetId: string,
    center: [number, number],
    source: "osm" | "municipal" | "staff",
  ): Promise<void>;

  /** Staff assignment of quarter and street type. */
  setStreetAssignment(input: {
    streetId: string;
    quarterId?: string | null;
    typology?: TypologyKey | null;
  }): Promise<Street>;

  /**
   * תמונות תוכן: תמונה אחת לכל מקום קבוע. `listContentImageSlots` מחזיר רק
   * את המפתחות, כי המסכים צריכים לדעת מה קיים ולא לטעון את הבייטים.
   */
  listContentImageSlots(): Promise<string[]>;
  readContentImage(slot: string): Promise<{ body: Buffer; contentType: string } | null>;
  setContentImage(input: { slot: string; dataUrl: string; alt?: string }): Promise<void>;
  deleteContentImage(slot: string): Promise<void>;

  upsertVote(input: VoteInput): Promise<Vote>;
  getUserVote(userId: string, streetId: string): Promise<Vote | null>;
  listVotes(filter?: { streetId?: string }): Promise<Vote[]>;

  /**
   * Admin upload: the photo is published as it is saved, with no queue.
   * `source` decides who sees it.
   */
  createPhoto(input: {
    streetId: string;
    dataUrl: string;
    source: PhotoSource;
    caption?: string;
    /**
     * ברירת המחדל היא "approved", כי הנתיב הזה נבנה להעלאה של המנהלת.
     * תמונה שתושב מצלם מכרטיס הרחוב מגיעה עם "pending" ועוברת בתור.
     */
    status?: PhotoStatus;
  }): Promise<Photo>;
  listPhotos(filter?: {
    streetId?: string;
    status?: PhotoStatus;
  }): Promise<Photo[]>;
  readPhoto(id: string): Promise<{ body: Buffer; contentType: string } | null>;
  setPhotoStatus(id: string, status: PhotoStatus): Promise<void>;

  /**
   * דיווח לעירייה או הצעת רחוב. התמונה היא חובה ונשמרת עם הדיווח עצמו,
   * ולא בטבלת התמונות הציבוריות: היא ראיה לצוות ואינה מיועדת לפרסום,
   * ולכן אינה עוברת בתור האישור ואינה מופיעה בשום מסך ציבורי.
   */
  createReport(input: {
    kind: ReportKind;
    streetId?: string | null;
    streetName: string;
    quarterId?: string | null;
    body: string;
    userId: string;
    dataUrl: string;
  }): Promise<Report>;
  listReports(filter?: { kind?: ReportKind; handled?: boolean }): Promise<Report[]>;
  readReportPhoto(id: string): Promise<{ body: Buffer; contentType: string } | null>;
  setReportHandled(id: string, handled: boolean): Promise<void>;

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
