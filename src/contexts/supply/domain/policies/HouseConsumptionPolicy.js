import { CROPS } from '../value-objects/CropType.js';
import {
  createFoodStock,
  getCropAmount,
  takeCrop,
} from '../value-objects/FoodStock.js';

/** @typedef {'wheat' | 'carrot' | 'cabbage'} Crop */

/** Priority order when a house consumes food baskets. */
export const HOUSE_FOOD_CONSUMPTION_ORDER = Object.freeze([
  'wheat',
  'carrot',
  'cabbage',
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
 *   consumed: Record<Crop, number>,
 *   demand: number,
 *   unfed: number,
 * }}
 */
export function applyHouseFoodConsumption(stock, population) {
  const pop = Number.isFinite(population) ? Math.max(0, Math.floor(population)) : 0;
  const demand = pop * basketsPerCitizenPerMonth();
  let remaining = demand;
  let nextStock = createFoodStock(stock);
  /** @type {Record<Crop, number>} */
  const consumed = { wheat: 0, carrot: 0, cabbage: 0 };

  for (const crop of HOUSE_FOOD_CONSUMPTION_ORDER) {
    if (remaining <= 0) break;
    const available = getCropAmount(nextStock, crop);
    const taken = Math.min(remaining, available);
    if (taken <= 0) continue;
    consumed[crop] = taken;
    nextStock = takeCrop(nextStock, crop, taken);
    remaining -= taken;
  }

  return {
    nextStock,
    consumed,
    demand,
    unfed: remaining,
  };
}

/** @param {Record<Crop, number>} consumed */
export function totalConsumedBaskets(consumed) {
  return CROPS.reduce((sum, crop) => sum + (consumed[crop] || 0), 0);
}
