import { basketsPerCitizenPerMonth } from './HouseConsumptionPolicy.js';
import { createFoodStock } from '../value-objects/FoodStock.js';

/**
 * Level 1 (autarky / hunter-gatherer) houses feed themselves directly —
 * bypassing farms/markets entirely. Each month, `stocks.food` is topped up
 * (never reduced) to at least that month's need, so famished-population and
 * affluence reads (which use raw `stocks.food`) never report hunger for
 * these houses. No new crop type / basket accounting: crops (wheat, carrot,
 * cabbage) are intentionally left untouched — see `CropType.js`/`FoodStock.js`.
 *
 * @param {object} params
 * @param {number} params.pop
 * @param {import('../value-objects/FoodStocks.js').FoodStocks | null | undefined} params.stocks
 * @returns {{
 *   nextStock: ReturnType<typeof createFoodStock>,
 *   credited: number,
 * }}
 */
export function computeSubsistenceFoodCredit({ pop, stocks }) {
  const population = Number.isFinite(pop) ? Math.max(0, Math.floor(pop)) : 0;
  const needed = population * basketsPerCitizenPerMonth();
  const current = createFoodStock(stocks);

  if (needed <= current.food) {
    return { nextStock: current, credited: 0 };
  }

  const nextStock = createFoodStock({ ...current, food: needed });
  return { nextStock, credited: needed - current.food };
}
