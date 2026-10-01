import { QUARTER_MAP, QUESTIONS, STATUSES } from "./city";
import type { QuestionKey, StatusKey } from "./city";
import { isPublicPhoto } from "./types";
import type {
  Photo,
  Quarter,
  QuarterStats,
  Street,
  StreetStats,
  StreetStatus,
  Totals,
  Vote,
} from "./types";

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Average of the seven questions, on the same 1–5 scale. */
export function voteScore(vote: Vote): number {
  const values = QUESTIONS.map((q) => vote.scores[q.key]).filter(
    (v): v is number => typeof v === "number",
  );
  return mean(values) ?? 0;
}

export function buildStreetStats(
  streets: Street[],
  votes: Vote[],
  photos: Photo[],
  statuses: StreetStatus[],
  quarters: Quarter[] = [],
): StreetStats[] {
  const quarterName = new Map(
    (quarters.length ? quarters : Object.values(QUARTER_MAP)).map((q) => [q.id, q.name]),
  );
  const statusByStreet = new Map(statuses.map((s) => [s.streetId, s]));
  const approvedPhotos = photos.filter(isPublicPhoto);
  const pendingPhotos = photos.filter((p) => p.status === "pending");

  const voteById = new Map(votes.map((v) => [v.id, v]));

  return streets.map((street) => {
    const streetVotes = votes.filter((v) => v.streetId === street.id);
    /*
     * סדר התמונות של הרחוב: קודם אלה שהגיעו עם קול, לפי הקול האחרון,
     * ורק אחריהן תמונות שצולמו מכרטיס הרחוב בלי דירוג.
     *
     * התמונה הראשונה כאן היא הפנים של הרחוב בכל המסכים, ולכן עדיף
     * שתהיה תמונה שמישהו צירף לדעה שכתב: יש מאחוריה משפט וציון,
     * ואפשר להגיע מהן אליו.
     */
    const streetApproved = approvedPhotos
      .filter((p) => p.streetId === street.id)
      .sort((a, b) => {
        const va = voteById.get(a.voteId);
        const vb = voteById.get(b.voteId);
        if (Boolean(va) !== Boolean(vb)) return va ? -1 : 1;
        if (va && vb && va.updatedAt !== vb.updatedAt) {
          return vb.updatedAt.localeCompare(va.updatedAt);
        }
        return b.createdAt.localeCompare(a.createdAt);
      });
    const perQuestion = Object.fromEntries(
      QUESTIONS.map((q) => [
        q.key,
        mean(
          streetVotes
            .map((v) => v.scores[q.key])
            .filter((v): v is number => typeof v === "number"),
        ),
      ]),
    ) as Record<QuestionKey, number | null>;

    return {
      street,
      quarterName: street.quarterId
        ? (quarterName.get(street.quarterId) ?? street.quarterId)
        : "טרם שויך רובע",
      votes: streetVotes.length,
      demoVotes: streetVotes.filter((v) => v.isDemo).length,
      avgScore: mean(streetVotes.map(voteScore)),
      perQuestion,
      photos: streetApproved.length,
      photosPending: pendingPhotos.filter((p) => p.streetId === street.id).length,
      latestPhotoId: streetApproved[0]?.id ?? null,
      status: statusByStreet.get(street.id) ?? null,
    };
  });
}

export function buildQuarterStats(
  quarters: Quarter[],
  streetStats: StreetStats[],
): QuarterStats[] {
  return quarters.map((quarter) => {
    const rows = streetStats.filter((s) => s.street.quarterId === quarter.id);
    const withVotes = rows.filter((r) => r.avgScore !== null);
    return {
      quarter,
      votes: rows.reduce((sum, r) => sum + r.votes, 0),
      avgScore: mean(
        withVotes.flatMap((r) => Array<number>(r.votes).fill(r.avgScore as number)),
      ),
      streets: rows.filter((r) => r.votes > 0).length,
    };
  });
}

/**
 * Totals are counted from the votes and photos themselves, not from the
 * per-street rows. A vote whose street is missing from the street list used to
 * disappear from every number without a trace; now it is still counted, and
 * `orphanVotes` makes the inconsistency visible instead of silent.
 */
export function buildTotals(
  streetStats: StreetStats[],
  votes: Vote[],
  photos: Photo[],
): Totals {
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s.key, 0])) as Record<
    StatusKey,
    number
  >;
  streetStats.forEach((s) => {
    if (s.status) byStatus[s.status.status] += 1;
  });

  const knownStreetIds = new Set(streetStats.map((s) => s.street.id));
  const votedStreetIds = new Set(votes.map((v) => v.streetId));

  /*
   * כמה קולות התמונות האלה מייצגות.
   *
   * ברוגוזין יש 5 תמונות מאושרות וקול אחד: אותו תושב צילם חמש פעמים
   * מכרטיס הרחוב, וכל תמונה נתלתה על הקול הקיים שלו. "7 תמונות" ליד
   * "3 קולות" נראה כמו סתירה, והוא אינו — אבל מספר שדורש הסבר בעל פה
   * אינו מספר שאפשר להציג לציבור. המספר הזה הוא ההסבר.
   */
  const publicPhotos = photos.filter(isPublicPhoto);
  const voteIdsWithPhoto = new Set(
    publicPhotos.map((p) => p.voteId).filter((id): id is string => Boolean(id)),
  );

  return {
    votes: votes.length,
    demoVotes: votes.filter((v) => v.isDemo).length,
    streets: votedStreetIds.size,
    streetsKnown: streetStats.length,
    photos: publicPhotos.length,
    photoVotes: voteIdsWithPhoto.size,
    photosPending: photos.filter((p) => p.status === "pending").length,
    orphanVotes: votes.filter((v) => !knownStreetIds.has(v.streetId)).length,
    byStatus,
  };
}

export interface PhotoShareRow {
  quarterId: string | null;
  quarterName: string;
  votes: number;
  withPhoto: number;
  /** 0–1, או null כשאין קולות אמיתיים ברובע. */
  share: number | null;
}

/**
 * שיעור הקולות שצורפה להם תמונה, לפי רובע.
 *
 * למה זה נמדד: התמונה בדירוג היא רשות, ובכוונה. המחיר של רשות הוא שהיא
 * אינה מתחלקת שווה — רובע שבו מצלמים יותר ייראה מתועד יותר, ואם מישהו
 * יסתכל על התמונות כעל מדגם הוא יסיק מהן מה שאין בהן. המספר הזה הוא
 * ההגנה: הוא מראה איפה הפער, כדי שההחלטות יישענו על הקולות ולא על
 * התמונות.
 *
 * נתוני הדגמה אינם נספרים כאן. הם נוצרו בלי תמונות, והיו מדללים כל רובע
 * שיש בהם.
 */
export function photoShareByQuarter(
  votes: Vote[],
  photos: Photo[],
  streets: Street[],
  quarters: Quarter[],
): PhotoShareRow[] {
  const quarterOfStreet = new Map(streets.map((s) => [s.id, s.quarterId]));
  const votesWithPhoto = new Set(
    photos.map((p) => p.voteId).filter((id): id is string => Boolean(id)),
  );
  const real = votes.filter((v) => !v.isDemo);

  const rows: PhotoShareRow[] = quarters.map((quarter) => {
    const inQuarter = real.filter(
      (v) => (v.quarterId ?? quarterOfStreet.get(v.streetId) ?? null) === quarter.id,
    );
    const withPhoto = inQuarter.filter(
      (v) => v.photoId !== null || votesWithPhoto.has(v.id),
    ).length;
    return {
      quarterId: quarter.id,
      quarterName: quarter.name,
      votes: inQuarter.length,
      withPhoto,
      share: inQuarter.length === 0 ? null : withPhoto / inQuarter.length,
    };
  });

  // קולות ברחוב שטרם שויך לרובע אינם נעלמים מהמדד.
  const unassigned = real.filter(
    (v) => !(v.quarterId ?? quarterOfStreet.get(v.streetId) ?? null),
  );
  if (unassigned.length > 0) {
    const withPhoto = unassigned.filter(
      (v) => v.photoId !== null || votesWithPhoto.has(v.id),
    ).length;
    rows.push({
      quarterId: null,
      quarterName: "טרם שויך רובע",
      votes: unassigned.length,
      withPhoto,
      share: withPhoto / unassigned.length,
    });
  }

  return rows.sort((a, b) => b.votes - a.votes);
}

export function topStreets(streetStats: StreetStats[], limit = 5): StreetStats[] {
  return [...streetStats]
    .filter((s) => s.votes > 0)
    .sort((a, b) => b.votes - a.votes || (b.avgScore ?? 0) - (a.avgScore ?? 0))
    .slice(0, limit);
}
