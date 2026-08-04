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
 * @property {1 | 2} level Mutable per-instance progression (1 = autarky, 2 =
 *   group profession). Distinct from the house color, which never changes
 *   after placement — see `residentialGroup` in the shared building catalog.
 * @property {number | null} lastPopulationGrowthMonth
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
  stocks = { food: 0, wheat: 0, carrot: 0, cabbage: 0 },
  price = 0,
  neighbors = [],
}) {
  return Object.freeze({
    id,
    type,
    x,
    y,
    roadCount: roadCount ?? 0,
    pop: pop ?? 0,
    level: level === 2 ? 2 : 1,
    lastPopulationGrowthMonth: lastPopulationGrowthMonth ?? null,
    stocks: {
      food: stocks.food ?? 0,
      wheat: stocks.wheat ?? 0,
      carrot: stocks.carrot ?? 0,
      cabbage: stocks.cabbage ?? 0,
      fruit: stocks.fruit ?? 0,
      game: stocks.game ?? 0,
    },
    price: price ?? 0,
    neighbors: neighbors ?? [],
  });
}
