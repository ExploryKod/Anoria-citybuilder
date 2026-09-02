import { CROPS } from './CropType.js';
import {
  createResourceStock,
  getCategoryAmount,
  takeCategoryAmount,
  addCategoryAmount,
  capResourceStockAt,
} from './ResourceStock.js';

/** @typedef {'wheat' | 'carrot' | 'cabbage' | 'fruit' | 'game'} FoodCategory */

export const FOOD_CATEGORIES = Object.freeze([...CROPS, 'fruit', 'game']);
const TOTAL_KEY = 'food';

/**
 * Building food stock (farm crops, gathering/hunting, total food).
 * Food's own instantiation of the generic ResourceStock mechanic.
 *
 * @param {object} [raw]
 * @returns {Readonly<{
 *   wheat: number,
 *   carrot: number,
 *   cabbage: number,
 *   fruit: number,
 *   game: number,
 *   food: number,
 * }>}
 */
export function createFoodStock(raw = {}) {
  return createResourceStock(raw, FOOD_CATEGORIES, TOTAL_KEY);
}

export function emptyFoodStock() {
  return createFoodStock();
}

/**
 * @param {ReturnType<typeof createFoodStock>} stock
 * @param {FoodCategory} category
 */
export function getFoodCategoryAmount(stock, category) {
  return getCategoryAmount(stock, category);
}

/**
 * @param {ReturnType<typeof createFoodStock>} stock
 * @param {import('./CropType.js').Crop} crop
 */
export function getCropAmount(stock, crop) {
  return getFoodCategoryAmount(stock, crop);
}

/**
 * Remove baskets from any food category; sync `food` downward.
 * @returns {ReturnType<typeof createFoodStock>}
 */
export function takeFoodCategory(stock, category, amount) {
  return takeCategoryAmount(stock, category, amount, FOOD_CATEGORIES, TOTAL_KEY);
}

/**
 * Remove baskets of a crop; sync `food` downward.
 * @returns {ReturnType<typeof createFoodStock>}
 */
export function takeCrop(stock, crop, amount) {
  return takeFoodCategory(stock, crop, amount);
}

/**
 * Add baskets of a crop; sync `food` upward (caller may cap separately).
 * @returns {ReturnType<typeof createFoodStock>}
 */
export function addCrop(stock, crop, amount) {
  return addCategoryAmount(stock, crop, amount, FOOD_CATEGORIES, TOTAL_KEY);
}

/**
 * Cap total food at maxStock; scale all categories down proportionally if needed.
 * @returns {ReturnType<typeof createFoodStock>}
 */
export function capStockAt(stock, maxStock) {
  return capResourceStockAt(stock, maxStock, FOOD_CATEGORIES, TOTAL_KEY);
}
