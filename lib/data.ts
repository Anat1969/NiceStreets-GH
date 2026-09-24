import { getStore } from "./store";
import {
  buildQuarterStats,
  buildStreetStats,
  buildTotals,
} from "./stats";
import type { QuarterStats, StreetStats, Totals } from "./types";

export interface CityData {
  streetStats: StreetStats[];
  quarterStats: QuarterStats[];
  totals: Totals;
}

/** One read of everything the public screens need. */
export async function loadCityData(): Promise<CityData> {
  const store = getStore();
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
  };
}
