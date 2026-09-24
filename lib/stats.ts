import { QUARTER_MAP, QUESTIONS, STATUSES } from "./city";
import type { QuestionKey, StatusKey } from "./city";
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
  const approvedPhotos = photos.filter((p) => p.status === "approved");

  return streets.map((street) => {
    const streetVotes = votes.filter((v) => v.streetId === street.id);
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
      quarterName: quarterName.get(street.quarterId) ?? street.quarterId,
      votes: streetVotes.length,
      avgScore: mean(streetVotes.map(voteScore)),
      perQuestion,
      photos: approvedPhotos.filter((p) => p.streetId === street.id).length,
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

export function buildTotals(streetStats: StreetStats[]): Totals {
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s.key, 0])) as Record<
    StatusKey,
    number
  >;
  streetStats.forEach((s) => {
    if (s.status) byStatus[s.status.status] += 1;
  });
  return {
    votes: streetStats.reduce((sum, s) => sum + s.votes, 0),
    streets: streetStats.filter((s) => s.votes > 0).length,
    photos: streetStats.reduce((sum, s) => sum + s.photos, 0),
    byStatus,
  };
}

export function topStreets(streetStats: StreetStats[], limit = 5): StreetStats[] {
  return [...streetStats]
    .filter((s) => s.votes > 0)
    .sort((a, b) => b.votes - a.votes || (b.avgScore ?? 0) - (a.avgScore ?? 0))
    .slice(0, limit);
}
