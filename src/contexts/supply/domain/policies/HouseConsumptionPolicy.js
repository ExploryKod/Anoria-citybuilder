import { CROPS } from '../value-objects/CropType.js';
import {
  createFoodStock,
  getFoodCategoryAmount,
  takeFoodCategory,
} from '../value-objects/FoodStock.js';

/** @typedef {import('../value-objects/FoodStock.js').FoodCategory} FoodCategory */

/**
 * Priority when a house consumes food baskets:
 * gathering (fruit, game) first, then market crops.
 */
export const HOUSE_FOOD_CONSUMPTION_ORDER = Object.freeze([
  'fruit',
  'game',
  ...CROPS,
]);

/** One basket per citizen per month. */
export function basketsPerCitizenPerMonth() {
  return 1;
}

/**
 * @param {ReturnType<typeof createFoodStock>} stock
 * @param {number} population
 * @returns {{
 *   nextStock: ReturnType<typeof createFoodStock>,
 *   consumed: Record<FoodCategory, number>,
 *   demand: number,
 *   unfed: number,
 * }}
 */
export function applyHouseFoodConsumption(stock, population) {
  const pop = Number.isFinite(population) ? Math.max(0, Math.floor(population)) : 0;
  const demand = pop * basketsPerCitizenPerMonth();
  let remaining = demand;
  let nextStock = createFoodStock(stock);
  /** @type {Record<FoodCategory, number>} */
  const consumed = {
    fruit: 0,
    game: 0,
    wheat: 0,
    carrot: 0,
    cabbage: 0,
  };

  for (const category of HOUSE_FOOD_CONSUMPTION_ORDER) {
    if (remaining <= 0) break;
    const available = getFoodCategoryAmount(nextStock, category);
    const taken = Math.min(remaining, available);
    if (taken <= 0) continue;
    consumed[category] = taken;
    nextStock = takeFoodCategory(nextStock, category, taken);
    remaining -= taken;
  }

  return {
    nextStock,
    consumed,
    demand,
    unfed: remaining,
  };
}

/** @param {Record<FoodCategory, number>} consumed */
export function totalConsumedBaskets(consumed) {
  return HOUSE_FOOD_CONSUMPTION_ORDER.reduce(
    (sum, category) => sum + (consumed[category] || 0),
    0,
  );
}
