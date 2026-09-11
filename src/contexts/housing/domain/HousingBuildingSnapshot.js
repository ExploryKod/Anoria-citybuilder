/**
 * Read model for a residential building in the Housing BC.
 *
 * @typedef {object} HousingBuildingSnapshot
 * @property {string} id
 * @property {string} type
 * @property {number | null} x
 * @property {number | null} y
 * @property {number} roadCount
 * @property {number} pop
 * @property {number} level Mutable per-instance tier progression (1 = autarky,
 *   any tier the social group's catalog declares beyond that — see
 *   `socialCategoryCatalog.js`). Distinct from the house color, which never
 *   changes after placement — see `residentialGroup` in the shared building
 *   catalog.
 * @property {number | null} lastPopulationGrowthMonth
 * @property {number | null} [lastFamineDeathMonth]
 * @property {{ totalUnfed?: number, month?: number, categoriesTaken?: string[] } | null} [lastConsumption]
 * @property {import('./value-objects/FoodStocks.js').FoodStocks} [stocks]
 * @property {number} [price]
 * @property {string[]} [neighbors]
 */

/**
 * @param {object} params
 * @returns {HousingBuildingSnapshot}
 */
export function createHousingBuildingSnapshot({
  id,
  type = '',
  x = null,
  y = null,
  roadCount = 0,
  pop = 0,
  level = 1,
  lastPopulationGrowthMonth = null,
  lastFamineDeathMonth = null,
  lastConsumption = null,
  stocks = { food: 0, wheat: 0, carrot: 0, cabbage: 0 },
  price = 0,
  neighbors = [],
  // Passed through as-is — this is what lets a Supply-context field the
  // Housing BC didn't ask for (e.g. `servedFlags`, written by
  // DistributeResourceToConsumers.js onto the same underlying `houses`
  // row) survive a read without this file needing to know it exists. Same
  // fix as SupplyBuildingSnapshot.js — see
  // contexts/supply/docs/period-lock-catalog-refactor.md.
  ...rest
}) {
  return Object.freeze({
    ...rest,
    id,
    type,
    x,
    y,
    roadCount: roadCount ?? 0,
    pop: pop ?? 0,
    level: Number.isFinite(level) && level >= 1 ? Math.floor(level) : 1,
    lastPopulationGrowthMonth: lastPopulationGrowthMonth ?? null,
    lastFamineDeathMonth: lastFamineDeathMonth ?? null,
    // `...lastConsumption` passthrough first — same fix as `servedFlags`
    // above: a field this constructor doesn't name explicitly (e.g.
    // `categoriesTaken`, read by HouseTierRequirementPolicy's `goodsVariety`
    // kind) must still round-trip, not silently vanish on next read.
    lastConsumption: lastConsumption
      ? {
          ...lastConsumption,
          month: Number.isFinite(lastConsumption.month) ? Math.floor(lastConsumption.month) : 0,
          totalUnfed: Number.isFinite(lastConsumption.totalUnfed)
            ? Math.max(0, Math.floor(lastConsumption.totalUnfed))
            : 0,
        }
      : null,
    stocks: (() => {
      const wheat = stocks.wheat ?? 0;
      const carrot = stocks.carrot ?? 0;
      const cabbage = stocks.cabbage ?? 0;
      const fruit = stocks.fruit ?? 0;
      const game = stocks.game ?? 0;
      const fromCategories = wheat + carrot + cabbage + fruit + game;
      // Keep food aligned with visible categories when they carry stock.
      const food = fromCategories > 0 ? fromCategories : (stocks.food ?? 0);
      return { food, wheat, carrot, cabbage, fruit, game };
    })(),
    price: price ?? 0,
    neighbors: neighbors ?? [],
  });
}
