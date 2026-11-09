/**
 * What the farms of a city can expect over a year, set against what its citizens eat and what its granaries can keep. A farm harvests once a year
 * and what the citizens eat must then be kept until the next harvest, so things can go wrong, and a farm reports them:
 * - too many farms: the city harvests more than its citizens eat (`surplus`). What does not fit in the granaries stays unsold in the fields and goes
 *   bad when the next harvest comes in (`spoilRisk`);
 * - granaries too small: what the citizens must eat until the next harvest does not fit in the granaries (`unkeepable`), whatever the number of farms;
 * - farms standing idle: a farm no one works at (no worker present, or the sick, or no road) harvests nothing (`idleFarms`): the harvest to expect
 *   is that of the farms that work (`harvest`), against what all the farms standing could give (`potential`).
 * Nothing is judged while the city has no citizens to feed: a farm placed before its houses are lived in has nothing to complain about yet.
 *
 * The room of the granaries is judged on the crops the farms plant (`plantedByCategory`, working or not), since it does not depend on who works the
 * fields; the surplus and the spoilage on what the working farms really harvest.
 *
 * @param {object} params
 * @param {Record<string, number>} params.harvestByCategory units each crop yields in a year, over the farms that work
 * @param {Record<string, number>} params.plantedByCategory units each crop would yield in a year, over all the farms standing
 * @param {number} params.demand units the citizens eat over a year
 * @param {{ byCategory: Record<string, number>, total: number }} params.storage what the working granaries can keep: per crop (its ceiling in the
 *   granaries that take it) and in all (their capacity)
 * @returns {{ harvest: number, potential: number, demand: number, kept: number, surplus: number, spoilRisk: number, unkeepable: number, judged: boolean }}
 */
export function foodForecastOf({ harvestByCategory, plantedByCategory, demand, storage }) {
  if (!Number.isFinite(demand) || demand < 0) throw new Error(`[food] the yearly demand must be a number of at least 0, got ${demand}`);
  if (!Number.isFinite(storage.total) || storage.total < 0) throw new Error(`[food] the storage capacity must be a number of at least 0, got ${storage.total}`);
  if (!plantedByCategory) throw new Error('[food] the forecast needs what all the farms standing would yield (plantedByCategory)');
  const sum = (units) => Object.values(units).reduce((total, amount) => total + amount, 0);
  /** What the granaries can keep of a harvest: each crop up to its ceiling, all of them up to the capacity. */
  const keptOf = (units) => Math.min(Object.entries(units).reduce((total, [category, amount]) => total + Math.min(amount, storage.byCategory[category] ?? 0), 0), storage.total);
  const harvest = sum(harvestByCategory);
  const potential = sum(plantedByCategory);
  const kept = keptOf(plantedByCategory);
  if (!(demand > 0)) return { harvest, potential, demand, kept, surplus: 0, spoilRisk: 0, unkeepable: 0, judged: false };
  return {
    harvest,
    potential,
    demand,
    kept,
    surplus: Math.max(0, harvest - demand),
    spoilRisk: Math.max(0, harvest - keptOf(harvestByCategory)),
    unkeepable: Math.max(0, demand - kept),
    judged: true,
  };
}
