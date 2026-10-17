/**
 * What the farms of a city can expect over a year, set against what its citizens eat and what its granaries can keep. A farm harvests once a year
 * and what the citizens eat must then be kept until the next harvest, so two things can go wrong, and a farm reports both:
 * - too many farms: the city harvests more than its citizens eat (`surplus`). What does not fit in the granaries stays unsold in the fields and goes
 *   bad when the next harvest comes in (`spoilRisk`);
 * - granaries too small: what the citizens must eat until the next harvest does not fit in the granaries (`unkeepable`), whatever the number of farms.
 * Nothing is judged while the city has no citizens to feed: a farm placed before its houses are lived in has nothing to complain about yet.
 *
 * @param {object} params
 * @param {Record<string, number>} params.harvestByCategory units each crop yields in a year, over all the farms
 * @param {number} params.demand units the citizens eat over a year
 * @param {{ byCategory: Record<string, number>, total: number }} params.storage what the working granaries can keep: per crop (its ceiling in the
 *   granaries that take it) and in all (their capacity)
 * @returns {{ harvest: number, demand: number, kept: number, surplus: number, spoilRisk: number, unkeepable: number, judged: boolean }}
 */
export function foodForecastOf({ harvestByCategory, demand, storage }) {
  if (!Number.isFinite(demand) || demand < 0) throw new Error(`[food] the yearly demand must be a number of at least 0, got ${demand}`);
  if (!Number.isFinite(storage.total) || storage.total < 0) throw new Error(`[food] the storage capacity must be a number of at least 0, got ${storage.total}`);
  const harvest = Object.values(harvestByCategory).reduce((sum, units) => sum + units, 0);
  const keptByCategory = Object.entries(harvestByCategory).reduce((sum, [category, units]) => sum + Math.min(units, storage.byCategory[category] ?? 0), 0);
  const kept = Math.min(keptByCategory, storage.total);
  if (!(demand > 0)) return { harvest, demand, kept, surplus: 0, spoilRisk: 0, unkeepable: 0, judged: false };
  return {
    harvest,
    demand,
    kept,
    surplus: Math.max(0, harvest - demand),
    spoilRisk: Math.max(0, harvest - kept),
    unkeepable: Math.max(0, demand - kept),
    judged: true,
  };
}
