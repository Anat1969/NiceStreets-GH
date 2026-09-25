import { getStore } from "./store";
import { buildQuarterStats, buildStreetStats, buildTotals } from "./stats";
import { QUARTERS, STATUSES } from "./city";
import type { StatusKey } from "./city";
import type { QuarterStats, StreetStats, Totals } from "./types";

export interface CityData {
  streetStats: StreetStats[];
  quarterStats: QuarterStats[];
  totals: Totals;
  /** Set when the data layer failed; the screens then render empty, not blank. */
  error: string | null;
}

function emptyTotals(): Totals {
  return {
    votes: 0,
    streets: 0,
    photos: 0,
    byStatus: Object.fromEntries(STATUSES.map((s) => [s.key, 0])) as Record<
      StatusKey,
      number
    >,
  };
}

/**
 * One read of everything the public screens need.
 *
 * A failure here must never take the whole site down with a server-side
 * exception: the screens render empty and say so, and /api/health carries the
 * message for diagnosis.
 */
export async function loadCityData(): Promise<CityData> {
  const store = getStore();
  try {
    const [streets, votes, photos, statuses, quarters] = await Promise.all([
      store.listStreets(),
      store.listVotes(),
      store.listPhotos(),
      store.listStreetStatuses(),
      store.listQuarters(),
    ]);
    const streetStats = buildStreetStats(streets, votes, photos, statuses, quarters);
    return {
      streetStats,
      quarterStats: buildQuarterStats(quarters, streetStats),
      totals: buildTotals(streetStats),
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("loadCityData failed:", message);
    return {
      streetStats: [],
      quarterStats: QUARTERS.map((quarter) => ({
        quarter,
        votes: 0,
        avgScore: null,
        streets: 0,
      })),
      totals: emptyTotals(),
      error: message,
    };
  }
}
