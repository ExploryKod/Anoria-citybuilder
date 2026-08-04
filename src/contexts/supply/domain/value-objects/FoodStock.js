import { CROPS } from './CropType.js';

/** @typedef {'wheat' | 'carrot' | 'cabbage' | 'fruit' | 'game'} FoodCategory */

export const FOOD_CATEGORIES = Object.freeze([...CROPS, 'fruit', 'game']);

/**
 * Building food stock (farm crops, gathering/hunting, total food).
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
  const wheat = nonNegInt(raw.wheat);
  const carrot = nonNegInt(raw.carrot);
  const cabbage = nonNegInt(raw.cabbage);
  const fruit = nonNegInt(raw.fruit);
  const game = nonNegInt(raw.game);
  const explicitFood = raw.food;
  const food =
    explicitFood === undefined || explicitFood === null
      ? wheat + carrot + cabbage + fruit + game
      : nonNegInt(explicitFood);

  return Object.freeze({ wheat, carrot, cabbage, fruit, game, food });
}

export function emptyFoodStock() {
  return createFoodStock();
}

/**
 * @param {ReturnType<typeof createFoodStock>} stock
 * @param {FoodCategory} category
 */
export function getFoodCategoryAmount(stock, category) {
  return stock?.[category] ?? 0;
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
  const n = nonNegInt(amount);
  const current = createFoodStock(stock);
  const available = getFoodCategoryAmount(current, category);
  const taken = Math.min(available, n);
  return createFoodStock({
    wheat: current.wheat,
    carrot: current.carrot,
    cabbage: current.cabbage,
    fruit: current.fruit,
    game: current.game,
    [category]: available - taken,
    food: Math.max(0, current.food - taken),
  });
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
  const n = nonNegInt(amount);
  const current = createFoodStock(stock);
  return createFoodStock({
    wheat: current.wheat,
    carrot: current.carrot,
    cabbage: current.cabbage,
    fruit: current.fruit,
    game: current.game,
    [crop]: getCropAmount(current, crop) + n,
    food: current.food + n,
  });
}

/**
 * Cap total food at maxStock; scale all categories down proportionally if needed.
 * @returns {ReturnType<typeof createFoodStock>}
 */
export function capStockAt(stock, maxStock) {
  const cap = nonNegInt(maxStock);
  const normalized = createFoodStock(stock);
  if (normalized.food <= cap) {
    return normalized;
  }

  const totalUnits = FOOD_CATEGORIES.reduce(
    (sum, category) => sum + getFoodCategoryAmount(normalized, category),
    0,
  );
  if (totalUnits <= 0) {
    return createFoodStock({ ...normalized, food: cap });
  }

  const factor = cap / normalized.food;
  /** @type {Record<FoodCategory, number>} */
  const next = { wheat: 0, carrot: 0, cabbage: 0, fruit: 0, game: 0 };
  for (const category of FOOD_CATEGORIES) {
    next[category] = Math.round(getFoodCategoryAmount(normalized, category) * factor);
  }
  return createFoodStock(next);
}

function nonNegInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}
